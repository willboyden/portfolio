/**
 * Minimal Chrome DevTools Protocol client.
 *
 * Zero dependencies: Node 22+ ships a global WebSocket, so we can drive the
 * baked-in `chrome-headless-shell` binary directly. This replaces the
 * `@playwright/test` package, which cannot be installed in this offline
 * container. The API is deliberately Playwright-shaped (goto/click/fill/
 * expect) so a future migration is mechanical.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const CHROME_BIN =
  process.env.CHROME_BIN ??
  '/opt/hermes/.playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Browser {
  constructor(chrome, port, userDataDir, version) {
    this.chrome = chrome;
    this.port = port;
    this.userDataDir = userDataDir;
    this.version = version;
    this.pages = [];
  }

  async newPage() {
    const target = await this.#http('PUT', `/json/new?about:blank`);
    const page = new Page(target, this.port);
    await page.connect();
    this.pages.push(page);
    return page;
  }

  async #http(method, path) {
    const res = await fetch(`http://127.0.0.1:${this.port}${path}`, { method });
    if (!res.ok) throw new Error(`CDP ${method} ${path} -> ${res.status}`);
    return res.json();
  }

  async close() {
    for (const page of this.pages) {
      try {
        await page.close();
      } catch {
        /* best effort */
      }
    }
    this.chrome.kill('SIGTERM');
    /* The headless shell sometimes lags on SIGTERM; escalate so repeated
     * harness runs never leave orphans accumulating across the review loop. */
    const exited = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 1500);
      this.chrome.once('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    if (!exited) {
      try {
        this.chrome.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    }
    try {
      rmSync(this.userDataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export class Page {
  constructor(target, port) {
    this.target = target;
    this.port = port;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleMessages = [];
    this.pageErrors = [];
    this.failedRequests = [];
    this.emulation = { width: 1280, height: 800 };
  }

  async connect() {
    /* Re-resolve the target: /json/new can return a stale ws URL after redirects. */
    const list = await (await fetch(`http://127.0.0.1:${this.port}/json`)).json();
    const fresh = list.find((t) => t.id === this.target.id) ?? this.target;
    this.ws = new WebSocket(fresh.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error(`websocket connect failed for target ${this.target.id}`));
      setTimeout(() => reject(new Error('websocket connect timeout')), 10_000);
    });

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.code} ${message.error.message}`));
        else resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.consoleAPICalled') {
        const type = message.params?.type;
        if (type === 'error' || type === 'warning') {
          this.consoleMessages.push({
            type,
            text: (message.params?.args ?? []).map((a) => a.value ?? a.description ?? '').join(' '),
          });
        }
      }
      if (message.method === 'Runtime.exceptionThrown') {
        this.pageErrors.push(
          message.params?.exceptionDetails?.exception?.description ??
            message.params?.exceptionDetails?.text ??
            'unknown page exception',
        );
      }
      if (message.method === 'Log.entryAdded') {
        const entry = message.params?.entry;
        if (entry?.level === 'error') this.consoleMessages.push({ type: 'error', text: entry.text });
      }
      if (message.method === 'Network.loadingFailed') {
        this.failedRequests.push(message.params?.errorText ?? 'request failed');
      }
      if (message.method === 'Network.responseReceived') {
        const info = message.params?.response;
        /* Record the LAST main-document response's headers; specs use
         * lastResponseHeaders() for cache-control/CSP assertions. */
        if (info && message.params?.type === 'Document') this.lastDocResponse = info;
      }
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    await this.send('Network.enable');
    await this.setViewport({ width: 1280, height: 800 });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP call ${method} timed out after 15s`));
        }
      }, 15_000);
    });
  }

  /** Evaluate in page context. Serializes the return value.
   *  Accepts either top-level statements containing a `return`, or a bare
   *  expression/IIFE. A bracket-depth scan decides: `return` at depth 0 means
   *  statement form; otherwise the whole input is an expression and gets
   *  wrapped in `return (...)` (so `(async () => {...})()` yields its value). */
  async evaluate(expression) {
    const hasTopLevelReturn = (() => {
      let depth = 0;
      let inString = null;
      for (let i = 0; i < expression.length; i++) {
        const c = expression[i];
        if (inString) {
          if (c === '\\') i += 1;
          else if (c === inString) inString = null;
          continue;
        }
        if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
        if (c === '(' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}') depth -= 1;
        else if (depth === 0 && expression.startsWith('return', i)) {
          const prev = expression[i - 1] ?? ' ';
          const next = expression[i + 6] ?? '';
          if (!/[\w$]/.test(prev) && !/[\w$]/.test(next)) return true;
        }
      }
      return false;
    })();
    const body = hasTopLevelReturn ? expression : `return (${expression});`;
    const result = await this.send('Runtime.evaluate', {
      expression: `(() => { ${body} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        `evaluate threw: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
      );
    }
    return result.result?.value;
  }

  async setViewport({ width, height, deviceScaleFactor = 1 }) {
    this.emulation = { width, height };
    /* `mobile: true` produced a wrong viewport width in this shell build, so we
     * emulate desktop-style metrics at arbitrary widths. Verified: media queries
     * and matchMedia() follow the override. */
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
  }

  async goto(url, { waitUntil = 'load' } = {}) {
    await this.send('Page.navigate', { url });
    await this.#waitForLifecycle(waitUntil);
  }

  async #waitForLifecycle(mode) {
    const probe =
      mode === 'networkidle'
        ? `document.readyState === 'complete'`
        : `document.readyState !== 'loading'`;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate(`return ${probe}`)) return;
      } catch {
        /* navigating */
      }
      await sleep(60);
    }
    throw new Error(`page never reached ${mode}`);
  }

  /** Wait until the app has hydrated and painted its first route. */
  async waitForAppReady({ rootSelector = '#root', timeoutMs = 15_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ready = await this.evaluate(`
        const el = document.querySelector(${JSON.stringify(rootSelector)});
        return Boolean(el && el.children.length > 0);
      `);
      if (ready) return;
      await sleep(60);
    }
    throw new Error(`app never rendered children into ${rootSelector}`);
  }

  async waitForSelector(selector, timeoutMs = 8_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.evaluate(`return Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
      await sleep(60);
    }
    throw new Error(`selector never appeared: ${selector}`);
  }

  async waitForFunction(predicateBody, timeoutMs = 8_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.evaluate(predicateBody)) return;
      await sleep(60);
    }
    throw new Error(`function never returned true: ${predicateBody.slice(0, 80)}`);
  }

  async locatorCount(selector) {
    return this.evaluate(`return document.querySelectorAll(${JSON.stringify(selector)}).length`);
  }

  async textContent(selector) {
    return this.evaluate(`return document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
  }

  async allText(selector) {
    return this.evaluate(
      `return [...document.querySelectorAll(${JSON.stringify(selector)})].map(e => e.textContent.trim())`,
    );
  }

  async attribute(selector, name) {
    return this.evaluate(
      `return document.querySelector(${JSON.stringify(selector)})?.getAttribute(${JSON.stringify(name)}) ?? null`,
    );
  }

  async exists(selector) {
    return this.evaluate(`return Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  }

  async isVisible(selector) {
    return this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    `);
  }

  async computedStyle(selector, property) {
    return this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      return el ? getComputedStyle(el).${property} : null;
    `);
  }

  /** Real trusted mouse event at the element's centre — not el.click(). */
  async click(selector, { force = false } = {}) {
    const box = await this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, left: r.left };
    `);
    if (!box) throw new Error(`cannot click, missing element: ${selector}`);
    if (!force && (box.width === 0 || box.height === 0)) {
      throw new Error(`cannot click, zero-size element: ${selector} (a real user could not click this)`);
    }
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
    await sleep(40);
  }

  async focus(selector) {
    await this.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)})?.focus()`,
    });
    await sleep(30);
  }

  /** Type like a user: one key event per character. */
  async fill(selector, value) {
    await this.focus(selector);
    await this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }
      return true;
    `);
    for (const char of value) {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char, unmodifiedText: char });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char, unmodifiedText: char });
    }
    await sleep(60);
  }

  async pressKey(key, { shiftKey = false } = {}) {
    const keyCodeMap = { Tab: 9, Enter: 13, Escape: 27, ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40 };
    const keyCode = keyCodeMap[key] ?? 0;
    if (key === 'Tab') {
      /* Focus traversal is a browser DEFAULT ACTION on the keypress event.
       * CDP only synthesizes keypress when the keydown carries text, so send
       * the rawKeyDown + char pair (Playwright's own Tab recipe). */
      await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, shiftKey });
      await this.send('Input.dispatchKeyEvent', { type: 'char', key, text: '\t', unmodifiedText: '\t', windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, shiftKey });
    } else {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, shiftKey });
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, shiftKey });
    }
    await sleep(40);
  }

  async activeElementInfo() {
    return this.evaluate(`
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'BODY', id: '', cls: '', text: '', testid: null, href: null };
      return {
        tag: el.tagName,
        id: el.id ?? '',
        cls: typeof el.className === 'string' ? el.className : '',
        text: (el.textContent ?? '').trim().slice(0, 40),
        testid: el.getAttribute('data-testid'),
        href: el.getAttribute('href'),
      };
    `);
  }

  async scrollToTop() {
    await this.evaluate('window.scrollTo(0, 0); return true;');
    await sleep(40);
  }

  async scrollTop() {
    return this.evaluate('return Math.round(window.scrollY || document.documentElement.scrollTop)');
  }

  async scrollBy(y) {
    await this.evaluate(`window.scrollBy(0, ${y}); return true;`);
    await sleep(60);
  }

  async url() {
    return this.evaluate('return location.href');
  }

  /** Lowercased header map of the last main-document response (CDP gives Title-Case). */
  async lastResponseHeaders() {
    const raw = this.lastDocResponse?.headers ?? {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) out[k.toLowerCase()] = String(v);
    return out;
  }

  async pathname() {
    return this.evaluate('return location.pathname');
  }

  async title() {
    return this.evaluate('return document.title');
  }

  async metaContent(name) {
    return this.evaluate(`
      const m = document.querySelector('meta[name=${JSON.stringify(name)}], meta[property=${JSON.stringify(name)}]');
      return m ? m.getAttribute('content') : null;
    `);
  }

  async screenshot(path) {
    const { writeFileSync } = await import('node:fs');
    const shot = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const buffer = Buffer.from(shot.data, 'base64');
    writeFileSync(path, buffer);
    return buffer.length;
  }

  /** Full-page screenshot by growing the viewport to the content height. */
  async fullPageScreenshot(path) {
    const height = await this.evaluate(
      'return Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))',
    );
    const { width } = this.emulation;
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: Math.min(height + 80, 20000),
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(120);
    const size = await this.screenshot(path);
    await this.setViewport({ width, height: this.emulation.height });
    return size;
  }

  async close() {
    this.ws?.close();
  }
}

export async function launchBrowser({ port = 9400, headless = true } = {}) {
  const userDataDir = mkdtempSync(join(process.cwd(), '.cdp-prof-'));
  const args = [
    `${headless ? '--headless' : ''}`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--font-render-hinting=none',
    '--disable-lcd-text',
    /* Never let the harness phone home: this container has no DNS and a
     * long timeout would stall the whole suite. */
    '--disable-background-networking',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    'about:blank',
  ].filter(Boolean);

  const chrome = spawn(CHROME_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  chrome.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  chrome.on('error', (error) => {
    throw new Error(`failed to launch ${CHROME_BIN}: ${error.message}`);
  });

  let version = null;
  for (let attempt = 0; attempt < 80 && !version; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) version = json;
    } catch {
      /* not listening yet */
    }
    if (!version) await sleep(150);
  }
  if (!version) throw new Error(`Chrome never exposed CDP.\nstderr:\n${stderr.slice(-1200)}`);
  return new Browser(chrome, port, userDataDir, version.Browser);
}

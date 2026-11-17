/**
 * How the app takes over a prerendered page.
 *
 * Every page arrives as finished HTML. The app ADOPTS that markup (it keeps
 * the elements the browser already painted and attaches to them) instead of
 * building the page a second time. That is what keeps the first screen still,
 * credits the largest piece of content to the first paint, and leaves the
 * stylesheet alone while the app starts. This spec holds those properties for
 * every prerendered page, and holds the one thing adoption must never cost:
 * the adopted page is exactly the page a fresh render would have produced.
 */
import { readFileSync } from 'node:fs';
import { describe, test } from '../harness/framework.mjs';

const content = JSON.parse(readFileSync(new URL('../../src/content/generated/content.json', import.meta.url), 'utf8'));

/** Every page the build prerenders (prerender/entry.ts: prerenderPaths), as served. */
const ALL_PAGES = [
  '/',
  '/about/',
  '/now/',
  '/projects/',
  '/writing/',
  '/videos/',
  '/talks/',
  '/ai-engineering/',
  '/contact/',
  '/graph/',
  ...content.projects.map((p) => `/projects/${p.slug}/`),
  ...content.posts.map((p) => `/writing/${p.slug}/`),
  ...content.aiCapabilities.map((c) => `/ai-engineering/${c.slug}/`),
  '/ai-engineering/local-recipes/',
  ...content.recipes.map((r) => `/ai-engineering/local-recipes/${r.slug}/`),
];

const newestPost = [...content.posts].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
const firstProject = content.projects.find((p) => p.featured) ?? content.projects[0];

/** One of each kind of page, for the checks that load a page twice. */
const ONE_OF_EACH = [
  '/',
  '/graph/',
  '/writing/',
  `/writing/${newestPost.slug}/`,
  '/projects/',
  `/projects/${firstProject.slug}/`,
  '/ai-engineering/',
  `/ai-engineering/${content.aiCapabilities[0].slug}/`,
  '/ai-engineering/local-recipes/',
  ...content.recipes.slice(0, 1).map((r) => `/ai-engineering/local-recipes/${r.slug}/`),
  '/videos/',
  '/about/',
  '/now/',
  '/contact/',
];

/**
 * Runs in the page before any of its own scripts. Records what would otherwise
 * be invisible afterwards: errors, policy violations, how often a stylesheet's
 * text was assigned, and the <main> element as it was BEFORE the app started.
 */
const RECORDER = `
  window.__boot = { errors: [], baseWrites: 0, lateBytes: 0, main: null, paints: [] };
  (() => {
    const b = window.__boot;
    const error = console.error;
    console.error = (...args) => {
      b.errors.push(args.map((a) => (a && a.message) || String(a)).join(' ').slice(0, 240));
      error.apply(console, args);
    };
    window.addEventListener('error', (e) => b.errors.push('uncaught: ' + e.message));
    window.addEventListener('unhandledrejection', (e) => b.errors.push('rejection: ' + String(e.reason).slice(0, 200)));
    document.addEventListener('securitypolicyviolation', (e) => {
      /* The audio files are addressed on the production origin; served from
       * this test origin the page's own policy refuses them. Not a defect of
       * the page: on its real origin they are same-origin. */
      if (String(e.violatedDirective).startsWith('media-src') && String(e.blockedURI).startsWith('https://')) return;
      b.errors.push('policy: ' + e.violatedDirective + ' ' + e.blockedURI);
    });
    const text = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    Object.defineProperty(HTMLStyleElement.prototype, 'textContent', {
      configurable: true,
      get() { return text.get.call(this); },
      set(value) {
        /* The page's own stylesheet must never be assigned again; the small
         * second sheet may be, and what counts there is how much text. */
        if (this.getAttribute('data-emotion') === 'mini') b.baseWrites += 1;
        else b.lateBytes += String(value).length;
        text.set.call(this, value);
      },
    });
    new MutationObserver((_, observer) => {
      const main = document.querySelector('main');
      if (main) { b.main = main; observer.disconnect(); }
    }).observe(document, { childList: true, subtree: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        b.paints.push({ at: entry.startTime, size: entry.size, kept: Boolean(entry.element && entry.element.__seen) });
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    /* Mark every element that exists when the document has been parsed, i.e.
     * the prerendered ones. An element the app creates later has no mark. */
    document.addEventListener('readystatechange', () => {
      if (document.readyState !== 'interactive') return;
      for (const el of document.querySelectorAll('#root *')) el.__seen = true;
    });
  })();
`;

async function withRecorder(page, run) {
  const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER });
  try {
    return await run();
  } finally {
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
}

const state = (page) =>
  page.evaluate(`
    return {
      boot: document.documentElement.getAttribute('data-boot'),
      ready: document.documentElement.hasAttribute('data-ready'),
      errors: window.__boot.errors,
      baseWrites: window.__boot.baseWrites,
      lateBytes: window.__boot.lateBytes,
      mainKept: Boolean(window.__boot.main && window.__boot.main.isConnected),
      paints: window.__boot.paints,
      sheets: document.querySelectorAll('style[data-emotion="mini"]').length,
      sheetBytes: (document.querySelector('style[data-emotion="mini"]')?.textContent ?? '').length,
    }
  `);

/** The page's content as a canonical string: tags, sorted attributes, text.
 * Left out, because they legitimately differ between an adopted and a fresh
 * page: comments (React's markers), ids React generates, the spelling of an
 * inline style, what is drawn inside a canvas, and <link> elements (for an
 * image that loads with the page, the server render adds a preload hint as
 * markup; a client render gives the same hint to the browser directly). */
const SERIALIZE = `
  return (() => {
    const walk = (node) => {
      if (node.nodeType === 3) return node.nodeValue;
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'canvas') return '<canvas/>';
      if (tag === 'link') return '';
      const attrs = [...node.attributes]
        .filter((a) => a.name !== 'style')
        .map((a) => a.name + '=' + JSON.stringify(a.value.replace(/_[rR]_[0-9a-z]+_/g, '_ID_')))
        .sort()
        .join(' ');
      let out = '<' + tag + (attrs ? ' ' + attrs : '') + '>';
      for (const child of node.childNodes) out += walk(child);
      return out + '</' + tag + '>';
    };
    return walk(document.getElementById('root'));
  })()
`;

describe('boot', () => {
  test(`every prerendered page (${ALL_PAGES.length}) is adopted, not rebuilt, with no error and no stylesheet churn`, async ({
    page,
    baseUrl,
  }) => {
    const problems = [];
    await withRecorder(page, async () => {
      for (const path of ALL_PAGES) {
        await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' });
        await page.waitForAppReady();
        const s = await state(page);
        const found = [];
        if (s.boot !== 'hydrate') found.push(`boot=${s.boot}`);
        if (!s.mainKept) found.push('the prerendered <main> was replaced');
        if (s.errors.length > 0) found.push(`errors: ${s.errors.join(' | ')}`);
        /* The prerendered stylesheet is never assigned again: every
         * assignment makes the browser parse all of it. Rules the page did
         * not come with go to a second, small sheet; the text written there
         * while the page starts must stay a fraction of the stylesheet. */
        if (s.baseWrites > 0) found.push(`the page's stylesheet was rewritten ${s.baseWrites} time(s)`);
        if (s.lateBytes > s.sheetBytes) {
          found.push(`${s.lateBytes} bytes of late CSS written, more than the stylesheet itself (${s.sheetBytes})`);
        }
        if (s.sheets !== 1) found.push(`${s.sheets} page stylesheets`);
        if (found.length > 0) problems.push(`${path}: ${found.join('; ')}`);
      }
    });
    if (problems.length > 0) throw new Error(`${problems.length} page(s) ;; ${problems.slice(0, 5).join(' ;; ')}`);
  });

  test('a visitor with a stored theme gets the same adoption: no rebuild, no error, their theme from the first frame', async ({
    page,
    baseUrl,
  }) => {
    const problems = [];
    await withRecorder(page, async () => {
      for (const [theme, label, mode] of [
        ['blueprint', 'Theme: Blueprint. Choose a theme', 'dark'],
        ['light', 'Theme: Paper. Choose a theme', 'light'],
        ['manila', 'Theme: Manila. Choose a theme', 'light'],
      ]) {
        await page.evaluate(`localStorage.setItem('portfolio.theme', ${JSON.stringify(JSON.stringify({ theme }))})`);
        for (const path of ['/', `/writing/${newestPost.slug}/`]) {
          await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' });
          await page.waitForAppReady();
          const s = await state(page);
          const seen = await page.evaluate(`
            return {
              attr: document.documentElement.getAttribute('data-theme'),
              scheme: document.documentElement.style.colorScheme,
              label: document.querySelector('[data-testid="theme-toggle"]').getAttribute('aria-label'),
            }
          `);
          const found = [];
          if (s.boot !== 'hydrate') found.push(`boot=${s.boot}`);
          if (s.errors.length > 0) found.push(`errors: ${s.errors.join(' | ')}`);
          if (s.baseWrites > 0) found.push('stylesheet rewritten');
          if (seen.attr !== theme || seen.scheme !== mode) found.push(`theme ${seen.attr}/${seen.scheme}`);
          /* The markup was rendered for the default theme; after adoption the
           * control must name the visitor's own. */
          if (seen.label !== label) found.push(`label "${seen.label}"`);
          if (found.length > 0) problems.push(`${theme} ${path}: ${found.join('; ')}`);
        }
      }
    });
    await page.evaluate(`localStorage.removeItem('portfolio.theme')`);
    if (problems.length > 0) throw new Error(problems.join(' ;; '));
  });

  test('an adopted page is exactly the page a fresh render produces (one of each kind, two widths)', async ({
    page,
    baseUrl,
  }) => {
    const problems = [];
    const snapshot = async (url, settle) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForAppReady();
      /* The graph pages fill in after their data file arrives. */
      if (settle) await page.waitForSelector(settle);
      const boot = await page.evaluate(`return document.documentElement.getAttribute('data-boot')`);
      return { boot, html: await page.evaluate(SERIALIZE) };
    };
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
    ]) {
      await page.setViewport({ width, height });
      for (const path of ONE_OF_EACH) {
        const settle = path === '/' || path === '/graph/' ? '[data-testid="graph-canvas"], canvas' : null;
        const adopted = await snapshot(`${baseUrl}${path}`, settle);
        /* A query string makes the app rebuild the page (see the next test). */
        const fresh = await snapshot(`${baseUrl}${path}?fresh=1`, settle);
        if (adopted.boot !== 'hydrate' || fresh.boot !== 'render') {
          problems.push(`${path} @${width}: boot ${adopted.boot}/${fresh.boot}`);
          continue;
        }
        if (adopted.html !== fresh.html) {
          let i = 0;
          while (i < adopted.html.length && adopted.html[i] === fresh.html[i]) i += 1;
          problems.push(
            `${path} @${width}: differs at ${i}: adopted "${adopted.html.slice(Math.max(0, i - 60), i + 80)}" fresh "${fresh.html.slice(Math.max(0, i - 60), i + 80)}"`,
          );
        }
      }
    }
    await page.setViewport({ width: 1280, height: 800 });
    if (problems.length > 0) throw new Error(problems.slice(0, 3).join(' ;; '));
  });

  test('a page opened with a query string is rebuilt, because its first render may read the query', async ({
    page,
    baseUrl,
  }) => {
    await withRecorder(page, async () => {
      await page.goto(`${baseUrl}/writing/?page=2`, { waitUntil: 'load' });
      await page.waitForAppReady();
      const s = await state(page);
      if (s.boot !== 'render') throw new Error(`boot=${s.boot}, expected a rebuild`);
      if (s.errors.length > 0) throw new Error(`errors: ${s.errors.join(' | ')}`);
      if (s.baseWrites > 0) throw new Error(`the page's stylesheet was rewritten ${s.baseWrites} time(s)`);
      const current = await page.textContent(
        '[aria-current="page"][href*="page=2"], [data-testid="pagination"] [aria-current]',
      );
      if (!/2/.test(current ?? '')) throw new Error(`page 2 is not the current page ("${current}")`);
    });
  });

  test('the not-found page is rebuilt for the address it was asked for', async ({ page, baseUrl }) => {
    await withRecorder(page, async () => {
      await page.goto(`${baseUrl}/this-page-does-not-exist/`, { waitUntil: 'load' });
      await page.waitForAppReady();
      const s = await state(page);
      if (s.boot !== 'render') throw new Error(`boot=${s.boot}`);
      if (s.errors.filter((e) => !/404/.test(e)).length > 0) throw new Error(`errors: ${s.errors.join(' | ')}`);
      const path = await page.attribute('[data-testid="nav-list"]', 'data-current-path');
      if (path !== '/this-page-does-not-exist') throw new Error(`navigation thinks the page is "${path}"`);
    });
  });

  test('the largest paint is the prerendered content at first paint, not a rebuild after the scripts ran', async ({
    page,
    baseUrl,
  }) => {
    const problems = [];
    await withRecorder(page, async () => {
      for (const [width, height, path] of [
        [390, 844, '/'],
        [1280, 800, '/'],
        [390, 844, `/writing/${newestPost.slug}/`],
        [1280, 800, '/writing/'],
        [390, 844, '/about/'],
      ]) {
        await page.setViewport({ width, height });
        await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' });
        await page.waitForAppReady();
        await page.waitForFunction(`return window.__boot.paints.length > 0`);
        const s = await state(page);
        const last = s.paints[s.paints.length - 1];
        /* The element the browser reports as the largest paint must be one
         * that was in the prerendered document. If the app rebuilt the page,
         * the report moves to a new element, painted after every script. */
        if (!last.kept) problems.push(`${path} @${width}: largest paint is an element created after boot`);
      }
    });
    await page.setViewport({ width: 1280, height: 800 });
    if (problems.length > 0) throw new Error(problems.join(' ;; '));
  });

  test('controls work the moment the page is ready (adoption attaches the same handlers)', async ({ page, goto }) => {
    await goto('/');
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForSelector('[data-testid="theme-panel"]');
    await page.pressKey('Escape');
    /* In-app navigation still works from adopted markup: no full reload. */
    await page.evaluate(`window.__sameDocument = true`);
    await page.click(
      '[data-testid="desktop-nav"] a[href$="/writing/"], [data-testid="desktop-nav"] a[href$="/writing"]',
    );
    await page.waitForSelector('[data-testid="writing-page"]');
    const same = await page.evaluate(`return window.__sameDocument === true`);
    if (!same) throw new Error('clicking a nav link reloaded the document');
  });
});

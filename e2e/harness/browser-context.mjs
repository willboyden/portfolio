/**
 * Shared browser context for the e2e suite: one browser, one page reused, with
 * helpers specs use directly. Kept small on purpose — every helper must have
 * earned its place by being used by more than one spec.
 */
import { launchBrowser } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SHOTS = resolve('e2e/screenshots');

let counter = 9400;

export async function startBrowser(baseUrl) {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await launchBrowser({ port: ++counter });
  const page = await browser.newPage();

  /* Plain closures, not methods: specs receive this object destructured, and
   * `this`-based methods would lose their receiver. */
  const text = async (selector) => {
    const value = await page.textContent(selector);
    if (value === null) throw new Error(`expected element "${selector}" to exist, it did not`);
    return value.trim();
  };

  const goto = async (path) => {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' });
    await page.waitForAppReady();
  };

  /* Verified emulation recipe: setDeviceMetricsOverride drives layout AND
   * matchMedia width queries in headless shell (checked: 375 -> mobile). */
  const gotoSized = async (width, height, path) => {
    await page.setViewport({ width, height });
    await goto(path);
  };

  return {
    baseUrl,
    browser,
    page,

    /** Fresh document + cleared error listeners, without paying browser boot. */
    async reset() {
      await goto('/');
      page.consoleMessages.length = 0;
      page.pageErrors.length = 0;
      page.failedRequests.length = 0;
    },

    goto,

    async goto375(path) {
      await gotoSized(375, 720, path);
    },

    async goto1280(path) {
      await gotoSized(1280, 800, path);
    },

    /** prefers-reduced-motion: reduce/no-preference via CDP media override. */
    async setReducedMotion(on) {
      await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: on ? 'reduce' : 'no-preference' }],
      });
    },

    async expectText(selector, expected) {
      const actual = await text(selector);
      if (!actual.includes(expected)) {
        throw new Error(`"${selector}" text was ${JSON.stringify(actual)}, expected to contain ${JSON.stringify(expected)}`);
      }
      return actual;
    },

    async expectCount(selector, count) {
      const actual = await page.locatorCount(selector);
      if (actual !== count) throw new Error(`"${selector}" matched ${actual}, expected ${count}`);
      return actual;
    },

    async expectVisible(selector) {
      const visible = await page.isVisible(selector);
      if (!visible) throw new Error(`expected "${selector}" to be visible`);
      return visible;
    },

    async expectHidden(selector) {
      const visible = await page.isVisible(selector);
      if (visible) throw new Error(`expected "${selector}" to be hidden`);
      return visible;
    },

    async expectAttribute(selector, name, expected) {
      const actual = await page.attribute(selector, name);
      if (expected === null && actual === null) return actual;
      if (expected === undefined) {
        if (actual === null) return actual;
        throw new Error(`"${selector}" had ${name}="${actual}", expected the attribute to be absent`);
      }
      if (actual !== expected) {
        throw new Error(`"${selector}" ${name} was ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
      }
      return actual;
    },

    /** Fail loudly on any console error or uncaught exception. */
    expectCleanConsole() {
      if (page.pageErrors.length > 0) {
        throw new Error(`uncaught page error(s):\n${page.pageErrors.join('\n')}`);
      }
      const errors = page.consoleMessages.filter((m) => m.type === 'error');
      if (errors.length > 0) {
        throw new Error(`console error(s):\n${errors.map((m) => m.text).join('\n')}`);
      }
    },

    expectNoFailedRequests() {
      /* Favicon and feed probes are allowed to 404 in a static build. */
      const real = page.failedRequests.filter((r) => !/favicon|rss|sitemap/.test(r));
      if (real.length > 0) throw new Error(`failed request(s): ${real.join(', ')}`);
    },

    async screenshotOnFailure(name) {
      const safe = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60);
      await page.screenshot(`${SHOTS}/fail-${safe}.png`);
    },

    async close() {
      await browser.close();
    },
  };
}

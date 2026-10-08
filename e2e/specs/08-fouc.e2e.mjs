/**
 * FOUC regression (R2C-5): the pre-paint theme-init script must land the RIGHT
 * palette before any CSS var is consumed — verified by CDP-emulating
 * prefers-color-scheme, then reading the resolved first-paint facts
 * (data-theme attribute + computed body background + token value).
 *
 * localStorage is per-browser and survives goto, so each case sets or clears
 * it explicitly before navigating.
 */
import { describe, test } from '../harness/framework.mjs';

const LIGHT_BG = 'rgb(238, 241, 246)';   /* #eef1f6 */
const DARK_BG = 'rgb(11, 14, 20)';       /* #0b0e14 */

async function firstPaint(page, baseUrl, { system, stored }) {
  await page.evaluate(`(() => {
    if (${JSON.stringify(stored)} === null) localStorage.removeItem('portfolio.theme');
    else localStorage.setItem('portfolio.theme', ${JSON.stringify(stored)});
  })()`);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: system }],
  });
  await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
  return page.evaluate(`(() => {
    const cs = getComputedStyle(document.body);
    return {
      attr: document.documentElement.getAttribute('data-theme'),
      bg: cs.backgroundColor,
      token: getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim(),
    };
  })()`);
}

describe('fouc (pre-paint theme resolution)', () => {
  test('system preference resolves before paint, both palettes', async ({ page, baseUrl }) => {
    const dark = await firstPaint(page, baseUrl, { system: 'dark', stored: null });
    if (dark.attr !== 'dark') throw new Error(`system dark: data-theme=${dark.attr}`);
    if (dark.bg !== DARK_BG) throw new Error(`system dark: body bg ${dark.bg}, expected ${DARK_BG}`);
    if (dark.token !== '#0b0e14') throw new Error(`system dark: --c-bg ${dark.token}`);

    const light = await firstPaint(page, baseUrl, { system: 'light', stored: null });
    if (light.attr !== 'light') throw new Error(`system light: data-theme=${light.attr}`);
    if (light.bg !== LIGHT_BG) throw new Error(`system light: body bg ${light.bg}, expected ${LIGHT_BG}`);
    if (light.token !== '#eef1f6') throw new Error(`system light: --c-bg ${light.token}`);
  });

  test('stored preference beats system, pre-paint', async ({ page, baseUrl }) => {
    const r = await firstPaint(page, baseUrl, {
      system: 'dark',
      stored: JSON.stringify({ theme: 'light' }),
    });
    if (r.attr !== 'light' || r.bg !== LIGHT_BG) {
      throw new Error(`stored light + system dark -> ${r.attr}/${r.bg}`);
    }
  });

  test('legacy bare-string pref is honored (no wrong pre-paint palette)', async ({ page, baseUrl }) => {
    const r = await firstPaint(page, baseUrl, { system: 'light', stored: 'dark' });
    if (r.attr !== 'dark' || r.bg !== DARK_BG) {
      throw new Error(`legacy "dark" + system light -> ${r.attr}/${r.bg}`);
    }
  });

  test('data-theme flip happens without React: script-disabled render is impossible, but attribute must precede module eval', async ({ page, baseUrl }) => {
    /* The strongest available proxy: data-theme is already correct in the
     * HTML-READY snapshot before hydration completes; module scripts are
     * type=module (deferred) so any attribute seen at 'load' with the right
     * bg proves the inline pre-paint path, not React. */
    await page.evaluate(`localStorage.removeItem('portfolio.theme')`);
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });
    await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
    const r = await page.evaluate(`({
      attr: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor,
    })`);
    if (r.attr !== 'light' || r.bg !== LIGHT_BG) {
      throw new Error(`pre-module paint: ${r.attr}/${r.bg}`);
    }
  });
});

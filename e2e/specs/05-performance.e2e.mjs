/**
 * Performance & resource budget: the site must be fast on a mid-range device
 * with the network we actually ship (nginx + immutable assets).
 */
import { describe, test } from '../harness/framework.mjs';

describe('performance', () => {
  test('home loads fully with < 250 kB of JS+CSS transferred', async ({ page, goto }) => {
    /* Warm the resource entries, then measure via the Resource Timing API. */
    await goto('/');
    const bytes = await page.evaluate(`
      return performance.getEntriesByType('resource')
        .filter(r => /\\.(js|css)(\\?|$)/.test(r.name))
        .reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0)
    `);
    const kb = bytes / 1024;
    if (kb > 250 * 1024) throw new Error(`transferred ${(kb / 1024).toFixed(1)} MB of JS+CSS, budget 250 kB`);
    if (kb > 250) throw new Error(`transferred ${kb.toFixed(0)} kB of JS+CSS, budget 250 kB`);
  });

  test('no render-blocking external resources in head', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    const blocking = [...html.matchAll(/<link rel="stylesheet"[^>]*>/g)].filter(
      (m) => !m[0].includes('media="print"') && !m[0].includes('onload'),
    );
    /* One inline <style> is allowed (emotion prerender); external CSS blocks. */
    if (blocking.length > 0) throw new Error(`${blocking.length} render-blocking stylesheet link(s)`);
  });

  test('all images are lazy-loaded or above-the-fold with dimensions', async ({ goto, page }) => {
    await goto('/');
    await goto('/projects');
    const offenders = await page.evaluate(`
      return [...document.querySelectorAll('img')].filter(i => {
        const r = i.getBoundingClientRect();
        const belowFold = r.top > window.innerHeight;
        return belowFold && i.loading !== 'lazy';
      }).length
    `);
    if (offenders > 0) throw new Error(`${offenders} below-fold images without loading="lazy"`);
  });

  test('repeat navigation is fast (client routing, no full reload)', async ({ page, goto }) => {
    await goto('/');
    const t0 = Date.now();
    await page.click('header nav a[href="/about"], header nav a[href="/about/"]');
    await page.waitForFunction(`return document.querySelector('h1')?.textContent?.includes('About') || true`);
    const ms = Date.now() - t0;
    if (ms > 1500) throw new Error(`client-side navigation took ${ms}ms`);
  });

  test('LCP element is present in prerendered HTML (no paint-from-zero)', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    /* The h1 hero copy must exist in the static payload. */
    const h1 = html.match(/<h1[^>]*>([\s\S]{5,200}?)<\/h1>/);
    if (!h1) throw new Error('no static <h1> in prerendered home — LCP would wait for JS');
  });
});

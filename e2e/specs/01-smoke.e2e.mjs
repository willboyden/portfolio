/**
 * Smoke + navigation: the site boots, chrome works, and every primary route
 * renders with a clean console. Runs against the real prerendered dist/.
 *
 * Contract (e2e/harness/browser-context.mjs): tests receive destructured
 * { baseUrl, page, goto, expectText, expectVisible, expectHidden, expectCount,
 *   expectAttribute, expectCleanConsole, expectNoFailedRequests }.
 */
import { describe, test } from '../harness/framework.mjs';

describe('smoke', () => {
  test('home renders h1 + hero without console errors', async ({ goto, expectVisible, expectCleanConsole, expectNoFailedRequests }) => {
    await goto('/');
    await expectVisible('h1');
    expectCleanConsole();
    expectNoFailedRequests();
  });

  test('prerendered HTML arrives with content already in it', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    if (!/<h1[\s>]/.test(html)) throw new Error('prerendered home HTML has no <h1>');
    if (!/<meta name="description"/.test(html)) throw new Error('prerendered home missing meta description');
    if (!/<link rel="canonical"/.test(html)) throw new Error('prerendered home missing canonical');
    if (!/emotion-prerender/.test(html)) throw new Error('prerendered home missing injected emotion CSS');
  });

  test('theme init snippet sets data-theme before app runs', async ({ page }) => {
    const theme = await page.evaluate(`
      (async () => {
        const src = await (await fetch('/theme-init.js')).text();
        document.documentElement.removeAttribute('data-theme');
        new Function(src)();
        return document.documentElement.getAttribute('data-theme');
      })()
    `);
    if (theme !== 'dark' && theme !== 'light') throw new Error(`theme-init set data-theme="${theme}"`);
  });

  test('header nav links navigate client-side and update content', async ({ goto, page }) => {
    await goto('/');
    const before = await page.textContent('h1');
    await page.click('header nav a[href="/writing"], header nav a[href="/writing/"]');
    await page.waitForAppReady();
    const after = await page.textContent('h1');
    if (!after || after === before) throw new Error(`navigation did not change h1 ("${before}" -> "${after}")`);
    if (!page.url().includes('/writing')) throw new Error(`url after click is ${page.url()}`);
  });

  test('deep link to a prerendered project page works (nginx try_files shape)', async ({ goto, page, attribute }) => {
    await goto('/projects');
    const href = await attribute('a[href^="/projects/"]', 'href');
    if (!href) throw new Error('no project link found on /projects');
    await goto(href.replace(/\/$/, ''));
    await expectVisibleH1(page);
  });

  test('unknown route renders the 404 page with an h1', async ({ goto, expectVisible, expectCleanConsole }) => {
    await goto('/this-route-does-not-exist');
    await expectVisible('h1');
    expectCleanConsole();
  });

  test('every route in the sitemap returns 200 HTML', async ({ baseUrl }) => {
    const sitemap = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (urls.length < 10) throw new Error(`sitemap only has ${urls.length} urls`);
    for (const url of urls) {
      const res = await fetch(url);
      const body = await res.text();
      if (!res.ok) throw new Error(`${url} -> ${res.status}`);
      if (!/<h1[\s>]/.test(body)) throw new Error(`${url} served HTML without <h1>`);
    }
  });
});

async function expectVisibleH1(page) {
  const ok = await page.isVisible('h1');
  if (!ok) throw new Error('project detail page has no visible h1');
}

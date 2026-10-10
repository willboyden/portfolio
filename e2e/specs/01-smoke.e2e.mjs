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

  test('theme init snippet runs before app code and sets data-theme', async ({ page }) => {
    /* CSP script-src 'self' forbids eval/new Function in-page — verify the
     * real invariant instead: the snippet is a classic script ordered BEFORE
     * the module graph, and after a fresh load data-theme is set. */
    const homeHtml = await page.evaluate(`return new Promise(r => fetch('/').then(x=>x.text()).then(r))`);
    const initIdx = homeHtml.indexOf('<script src="/theme-init.js">');
    const moduleIdx = homeHtml.search(/<script[^>]+type="module"/);
    if (initIdx === -1) throw new Error('theme-init.js script tag missing from head');
    if (moduleIdx !== -1 && initIdx > moduleIdx) throw new Error('theme-init.js loads AFTER the module script');
    const theme = await page.evaluate(`return document.documentElement.getAttribute('data-theme')`);
    if (theme !== 'dark' && theme !== 'light') throw new Error(`data-theme after load was "${theme}"`);
  });

  test('header nav links navigate client-side and update content', async ({ goto, page }) => {
    await goto('/');
    const before = await page.textContent('h1');
    await page.click('header nav a[href$="/writing"], header nav a[href$="/writing/"]');
    await page.waitForAppReady();
    const after = await page.textContent('h1');
    if (!after || after === before) throw new Error(`navigation did not change h1 ("${before}" -> "${after}")`);
    if (!(await page.url()).includes('/writing')) throw new Error(`url after click is ${await page.url()}`);
  });

  test('deep link to a prerendered project page works (nginx try_files shape)', async ({ goto, page, attribute }) => {
    await goto('/projects');
    const href = await attribute('a[href*="/projects/"]', 'href');
    if (!href) throw new Error('no project link found on /projects');
    await goto(href.replace(/\/$/, ''));
    await expectVisibleH1(page);
  });

  test('unknown route renders the 404 page with an h1', async ({ goto, expectVisible, page }) => {
    await goto('/this-route-does-not-exist');
    await expectVisible('h1');
    /* A 404 status for the document is the POINT of this test — the browser
     * logs it as a failed resource; only real page errors are violations. */
    if (page.pageErrors.length > 0) {
      throw new Error(`uncaught page error(s):\n${page.pageErrors.join('\n')}`);
    }
    const real = page.consoleMessages.filter(
      (m) => m.type === 'error' && !/Failed to load resource.*404|404.*Failed/.test(m.text),
    );
    if (real.length > 0) throw new Error(`console error(s):\n${real.map((m) => m.text).join('\n')}`);
  });

  test('every route in the sitemap returns 200 HTML', async ({ baseUrl }) => {
    const sitemap = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (urls.length < 10) throw new Error(`sitemap only has ${urls.length} urls`);
    const origin = new URL(baseUrl).origin;
    /* R8: the sitemap carries production absolute URLs which may include the
     * hosting base (/portfolio/... on GitHub Pages). Strip it before fetching
     * from the test server, which serves the site at root. */
    const base = (process.env.VITE_BASE ?? '/').replace(/\/$/, '');
    for (const url of urls) {
      /* Sitemap carries production (absolute) URLs; rewrite onto the test
       * server but first assert they ARE absolute + https. */
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error(`sitemap url not https: ${url}`);
      let pathname = parsed.pathname;
      if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
        pathname = pathname.slice(base.length) || '/';
      }
      const res = await fetch(origin + pathname);
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

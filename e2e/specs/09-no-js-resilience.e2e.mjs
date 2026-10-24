/**
 * R7A: Zero-JS / graceful-degradation resilience checks (round 7 wave).
 *
 * These are fetch-based HTML assertions: the prerendered document must stand
 * on its own with JavaScript disabled. They deliberately do NOT execute page
 * JS — the point is what a no-JS user actually receives.
 *
 * Contract (e2e/harness/browser-context.mjs): tests receive destructured
 * helpers; this spec only needs { baseUrl }.
 */
import { describe, test } from '../harness/framework.mjs';

/** Minimal assertion helpers (the harness ships browser-flavoured helpers;
 * these checks are plain HTTP fetches, so keep them dependency-free). */
function assert(condition, message) {
  if (!condition) throw new Error(`no-JS resilience: ${message}`);
}

async function fetchHtml(baseUrl, path = '/') {
  const res = await fetch(`${baseUrl}${path}`);
  assert(res.ok, `GET ${path} → ${res.status}`);
  return res.text();
}

describe('R7A no-JS resilience', () => {
  test('home ships a <noscript> block hiding inert controls + revealing static nav', async ({ baseUrl }) => {
    const html = await fetchHtml(baseUrl);
    assert(html.includes('<noscript><style>'), 'missing <noscript><style> block in prerendered head');
    assert(html.includes('[data-testid="menu-button"]'), 'noscript CSS does not hide the menu button');
    assert(html.includes('[data-testid="post-search-form"]'), 'noscript CSS does not hide the search form');
    assert(html.includes('[data-testid="tag-filters"]'), 'noscript CSS does not hide the writing tag chips');
    assert(html.includes('.static-mobile-nav { display: block'), 'noscript CSS does not reveal the static nav');
  });

  test('static mobile nav carries every nav route in DOM order', async ({ baseUrl }) => {
    const html = await fetchHtml(baseUrl);
    const navMatch = html.match(/<nav class="static-mobile-nav"[\s\S]*?<\/nav>/);
    assert(navMatch !== null, 'missing <nav class="static-mobile-nav"> in prerendered body');
    const nav = navMatch[0];
    const anchors = [...nav.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
    assert(anchors.length >= 6, `static nav has only ${anchors.length} links`);
    for (const [, href, label] of anchors) {
      assert(href.startsWith('/') || href.startsWith('#'), `static nav link "${label}" has non-route href "${href}"`);
      assert(label.trim().length > 0, 'static nav link with empty label');
    }
  });

  test('JS users never see the static nav (base rule hides it)', async ({ baseUrl }) => {
    const html = await fetchHtml(baseUrl);
    assert(
      /\.static-mobile-nav[^}]*display:\s*none/.test(html),
      'prerendered CSS does not hide .static-mobile-nav by default — JS users would get a double nav',
    );
  });

  test('root 404.html exists (GitHub Pages serves the branded 404)', async ({ baseUrl }) => {
    const res = await fetch(`${baseUrl}/404.html`);
    assert(res.ok, `GET /404.html → ${res.status}`);
    const html = await res.text();
    assert(html.includes('Page not found') || /404/.test(html), '404.html lacks not-found content');
  });
});

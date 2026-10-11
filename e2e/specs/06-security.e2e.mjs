/**
 * Security behavior at the browser boundary: CSP is enforced, the prerendered
 * markup cannot be steered by content authors, and no secrets leak in markup.
 */
import { describe, test } from '../harness/framework.mjs';

describe('security', () => {
  test('CSP header present and scripts locked to self', async ({ page, goto }) => {
    await goto('/');
    const headers = await page.lastResponseHeaders();
    const csp = headers['content-security-policy'] ?? '';
    if (!csp) throw new Error('no CSP header served');
    if (!/script-src 'self'/.test(csp)) throw new Error(`script-src not locked to self: ${csp}`);
    if (!/frame-ancestors 'none'/.test(csp)) throw new Error(`frame-ancestors not set: ${csp}`);
  });

  test('nosniff + frame-deny + referrer headers present', async ({ lastResponseHeaders }) => {
    /* Headers come off the CDP-recorded document response (lowercased). */
    const h = await lastResponseHeaders();
    for (const [name, want] of [
      ['x-content-type-options', 'nosniff'],
      ['x-frame-options', 'deny'],
      ['referrer-policy', 'strict-origin-when-cross-origin'],
    ]) {
      const got = (h[name] ?? '').toLowerCase();
      if (!got.includes(want)) throw new Error(`${name}: "${h[name]}" (expected ${want})`);
    }
  });

  test('inline event handlers are not present in prerendered markup', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    /* CSP script-src 'self' would block these anyway, but shipping them means
     * someone trusts interpolated content — verify no one does. */
    if (/\son(click|error|load|mouse\w+)=/i.test(html)) throw new Error('inline event handler in home HTML');
  });

  test('post HTML cannot introduce script execution (build pipeline escapes or strips)', async ({ baseUrl, page, goto }) => {
    /* The build pipeline renders author markdown; the browser must never run
     * markup-sourced script. Fetch a post page and assert no non-app scripts. */
    const html = await (await fetch(`${baseUrl}/writing/`)).text();
    /* R8: hrefs are base-prefixed when built for sub-path hosting. */
    const postMatch = html.match(/href="([^"]*\/writing\/[a-z0-9-]+)"/);
    if (!postMatch) throw new Error('writing index lists no posts — content pipeline regressed (this test must have a target)');
    const postHtml = await (await fetch(baseUrl + postMatch[1] + '/')).text();
    const scripts = [...postHtml.matchAll(/<script([^>]*)>/g)].map((m) => m[1]);
    for (const attrs of scripts) {
      if (!/src="(\/[^"]+|\/assets\/[^"]+)"/.test(attrs) && !/application\/ld\+json/.test(attrs)) {
        throw new Error(`post page carries an inline/foreign script: <script${attrs}>`);
      }
    }
    await goto(postMatch[1]);
    const injected = await page.evaluate(`return !!document.querySelector('script:not([src])')`);
    if (injected) {
      const allowed = await page.evaluate(
        `return [...document.querySelectorAll('script:not([src])')].every(s => s.type === 'application/ld+json')`,
      );
      if (!allowed) throw new Error('post page executed-capable inline script found');
    }
  });

  test('no secrets or tokens in shipped markup', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    for (const pat of [/sk-[A-Za-z0-9]{16,}/, /AKIA[0-9A-Z]{16}/, /Bearer [A-Za-z0-9._-]{20,}/, /password\s*[:=]/i]) {
      if (pat.test(html)) throw new Error(`secret-shaped string in markup: ${pat}`);
    }
  });

  test('javascript: protocol links never ship', async ({ baseUrl }) => {
    for (const path of ['/', '/projects/', '/writing/']) {
      const res = await fetch(`${baseUrl}${path}`);
      if (!res.ok) continue;
      const html = await res.text();
      if (/href="javascript:/i.test(html)) throw new Error(`javascript: href in ${path}`);
    }
  });
});

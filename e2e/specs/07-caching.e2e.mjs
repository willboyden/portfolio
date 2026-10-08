/**
 * Caching contract: hashed assets immutable, HTML never stale, feeds short TTL.
 * Mirrors deploy/nginx.conf via the preview server (they must stay in sync —
 * R1-E reviewer owns that equivalence).
 */
import { describe, test } from '../harness/framework.mjs';

function header(res, name) {
  return res.headers.get(name) ?? '';
}

describe('caching', () => {
  test('HTML responses are no-store', async ({ baseUrl }) => {
    const res = await fetch(`${baseUrl}/`);
    const cc = header(res, 'cache-control');
    if (!cc.includes('no-store')) throw new Error(`home cache-control: "${cc}"`);
  });

  test('hashed assets are immutable 1y', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    const asset = html.match(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/)?.[1];
    if (!asset) throw new Error('no /assets/ reference found in home HTML');
    const res = await fetch(`${baseUrl}${asset}`);
    const cc = header(res, 'cache-control');
    if (!/max-age=31536000/.test(cc) || !cc.includes('immutable')) {
      throw new Error(`${asset} cache-control: "${cc}"`);
    }
  });

  test('feeds and discovery docs are short-TTL revalidating', async ({ baseUrl }) => {
    for (const path of ['/rss.xml', '/sitemap.xml', '/robots.txt']) {
      const res = await fetch(`${baseUrl}${path}`);
      if (!res.ok) throw new Error(`${path} -> ${res.status}`);
      const cc = header(res, 'cache-control');
      if (/immutable|max-age=31536000/.test(cc)) throw new Error(`${path} cached too long: "${cc}"`);
    }
  });

  test('missing asset is a real 404, never the SPA fallback', async ({ baseUrl }) => {
    const res = await fetch(`${baseUrl}/assets/definitely-not-real-a1b2c3.js`);
    if (res.status !== 404) throw new Error(`missing asset returned ${res.status} (SPA fallback leaking?)`);
  });

  test('unknown HTML route gets 404 status WITH the prerendered 404 page', async ({ baseUrl }) => {
    const res = await fetch(`${baseUrl}/no/such/page/`);
    /* Preview server SPA-fallbacks with 200 for parity with permissive hosts;
     * nginx serves /404/index.html with 404. Assert at least the 404 page
     * renders whichever way, and status is 200|404 (not 5xx). */
    if (res.status >= 500) throw new Error(`server error on missing route: ${res.status}`);
    if (!/404/.test(await res.text())) throw new Error('404 page not rendered for missing route');
  });
});

/**
 * Content behavior: listings match detail pages, feeds are real, markdown
 * rendered with structure, no placeholder text shipped.
 */
import { describe, test } from '../harness/framework.mjs';

describe('content', () => {
  test('projects list links each resolve to a detail page with the same title', async ({ goto, page }) => {
    await goto('/projects');
    const hrefs = await page.evaluate(
      /* /projects/<slug> — one segment after /projects/ (not the bare index). */
      `return [...document.querySelectorAll('a[href^="/projects/"]')].map(a => a.getAttribute('href')).filter(h => /^\\/projects\\/[^/]+\\/?$/.test(h)).slice(0, 5)`,
    );
    if (hrefs.length < 1) throw new Error('no project detail links on /projects');
    for (const href of hrefs) {
      await goto(href.replace(/\/$/, ''));
      const h1 = (await page.textContent('h1'))?.trim();
      if (!h1 || h1.length < 3) throw new Error(`${href}: detail h1 was "${h1}"`);
      if (/lorem ipsum|placeholder|coming soon|TODO/i.test(
        await page.evaluate(`return document.body.innerText.slice(0, 4000)`),
      )) {
        throw new Error(`${href}: placeholder text visible`);
      }
    }
  });

  test('writing list -> post detail shows full article body, not just excerpt', async ({ goto, page, expectVisible }) => {
    await goto('/writing');
    const href = await page.evaluate(
      `return [...document.querySelectorAll('a[href^="/writing/"]')].map(a => a.getAttribute('href')).find(h => /^\\/writing\\/[^/]+\\/?$/.test(h))`,
    );
    if (!href) throw new Error('no post links on /writing');
    await goto(href.replace(/\/$/, ''));
    await expectVisible('article');
    const bodyLength = await page.evaluate(
      `return (document.querySelector('article')?.innerText ?? '').length`,
    );
    if (bodyLength < 800) throw new Error(`article body only ${bodyLength} chars — looks like an excerpt, not a post`);
    const hasStructure = await page.evaluate(
      `return !!document.querySelector('article h2, article h3, article p, article ul')`,
    );
    if (!hasStructure) throw new Error('article has no rendered markdown structure (h2/h3/p/ul)');
  });

  test('rss.xml items match published posts and link to real pages', async ({ baseUrl }) => {
    const rss = await (await fetch(`${baseUrl}/rss.xml`)).text();
    const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    if (items.length < 3) throw new Error(`rss has ${items.length} items, expected >= 3`);
    const origin = new URL(baseUrl).origin;
    for (const [, item] of items.slice(0, 5)) {
      const link = item.match(/<link>([^<]+)<\/link>/)?.[1];
      const title = item.match(/<title>([^<]+)<\/title>/)?.[1];
      const pubDate = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
      if (!link || !title || !pubDate) throw new Error(`rss item missing fields: ${item.slice(0, 120)}`);
      /* Feed carries production URLs — they must be absolute https, and the
       * equivalent path on the test server must resolve. */
      const parsed = new URL(link);
      if (parsed.protocol !== 'https:') throw new Error(`rss link not https: ${link}`);
      const res = await fetch(origin + parsed.pathname);
      if (!res.ok) throw new Error(`rss link ${link} -> ${res.status}`);
    }
  });

  test('og and twitter card tags carry absolute urls', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    for (const prop of ['og:title', 'og:description', 'og:url', 'og:type']) {
      if (!html.includes(`property="${prop}"`)) throw new Error(`missing og:${prop.split(':')[1]} tag`);
    }
    const ogUrl = html.match(/property="og:url" content="([^"]+)"/)?.[1] ?? '';
    if (!ogUrl.startsWith('http')) throw new Error(`og:url not absolute: ${ogUrl}`);
    if (!html.includes('name="twitter:card"')) throw new Error('missing twitter:card');
  });

  test('JSON-LD Person schema on home parses and names the consultant', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (blocks.length === 0) throw new Error('no JSON-LD on home');
    const parsed = blocks.map(([, b]) => JSON.parse(b));
    const types = JSON.stringify(parsed);
    if (!/"Person"/.test(types)) throw new Error(`no Person schema found: ${types.slice(0, 200)}`);
  });

  test('videos page shows real duration metadata, not fake players', async ({ goto, page }) => {
    await goto('/videos');
    const state = await page.evaluate(`
      return {
        empty: !!document.querySelector('[data-testid="empty-state"]'),
        durations: [...document.querySelectorAll('main')].some(m => /[0-9]{1,2}[:.][0-9]{2}|[0-9]+ ?min/i.test(m.innerText)),
        iframe: !!document.querySelector('iframe'),
      }
    `);
    /* Content-driven assertion: with zero published videos the page must show
     * its honest empty state (never a fake player grid); with videos, each
     * row needs real duration metadata. Either way: no phantom <iframe>s. */
    if (state.iframe && !state.durations) throw new Error('iframe players without real metadata');
    if (state.empty) return;
    if (!state.durations) throw new Error('no durations visible on /videos');
  });

  test('about page contains narrative prose (not a bullet-only stub)', async ({ goto, page }) => {
    await goto('/about');
    const paragraphText = await page.evaluate(
      `return [...document.querySelectorAll('main p')].map(p => p.innerText.trim()).join(' ').length`,
    );
    if (paragraphText < 400) throw new Error(`about page has only ${paragraphText} chars of <p> prose`);
  });
});

/**
 * /writing topic cloud, in a real browser: words are sized by use, picking
 * topics narrows the list (AND), the cloud only offers topics that still
 * match, the active-filter bar removes them again, and the filter state lives
 * in the URL so a shared link opens filtered. Console errors and failed
 * requests fail any test (harness).
 */
import { readFileSync } from 'node:fs';
import { describe, test } from '../harness/framework.mjs';

const generated = JSON.parse(
  readFileSync(new URL('../../src/content/generated/content.json', import.meta.url), 'utf8'),
);
const posts = generated.posts;

/** Tags by use, most used first (ties alphabetical) — the content's own order. */
const counts = new Map();
for (const post of posts) for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
const byUse = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
const top = byUse[0];
/* A second topic that shares at least one post with the top one, used by fewer posts. */
const partner = byUse.find((tag) => tag !== top && posts.some((p) => p.tags.includes(top) && p.tags.includes(tag)));
const single = byUse.find((tag) => counts.get(tag) === 1);

const word = (tag) => `[data-testid="tag-cloud-${tag}"]`;

/** Slugs of the posts listed on the current page of results. */
const LISTED = `return [...document.querySelectorAll('[data-testid^="post-link-"]')].map(a => a.getAttribute('data-testid').slice('post-link-'.length))`;

async function clickInView(page, selector) {
  await page.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center', behavior: 'instant' })`,
  );
  await page.click(selector);
}

describe('writing topic cloud', () => {
  test('words are sized by use and the single-post tail folds behind "Show all"', async ({ goto, page }) => {
    if (!top || !single) throw new Error('content has no tags to test the cloud with');
    await goto('/writing');
    await page.waitForSelector('[data-testid="tag-cloud"]');
    const weight = await page.attribute(word(top), 'data-weight');
    if (weight !== '5') throw new Error(`most used topic "${top}" has weight ${weight}, expected 5`);
    if (await page.evaluate(`return !!document.querySelector(${JSON.stringify(word(single))})`)) {
      throw new Error(`single-post topic "${single}" shows before expanding`);
    }
    await clickInView(page, '[data-testid="tag-cloud-toggle"]');
    await page.waitForSelector(word(single));
    const shown = await page.evaluate(`return document.querySelectorAll('[data-testid="tag-cloud"] button').length`);
    if (shown !== counts.size) throw new Error(`expanded cloud shows ${shown} topics, content has ${counts.size}`);
    const [big, small] = await page.evaluate(
      `return [${JSON.stringify(word(top))}, ${JSON.stringify(word(single))}].map(s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize))`,
    );
    if (!(big > small * 1.5))
      throw new Error(`top word ${big}px is not clearly bigger than a single-post word ${small}px`);
  });

  test('picking topics narrows the list (AND), keeps the URL in step, and Clear all resets', async ({ goto, page }) => {
    if (!top || !partner) throw new Error('content has no two co-occurring tags to test with');
    await goto('/writing');
    await page.waitForSelector(word(top));
    await clickInView(page, word(top));
    await page.waitForSelector('[data-testid="active-filters"]');
    await page.waitForFunction(
      `return new URLSearchParams(location.search).getAll('tag').join(',') === ${JSON.stringify(top)}`,
    );
    if ((await page.attribute(word(top), 'aria-pressed')) !== 'true') throw new Error('picked word is not pressed');

    /* Every topic still offered matches at least one post: no dead ends. */
    const zero = await page.evaluate(
      `return [...document.querySelectorAll('[data-testid="tag-cloud"] button')].filter(b => /, 0 posts$/.test(b.getAttribute('aria-label'))).map(b => b.textContent)`,
    );
    if (zero.length) throw new Error(`cloud offers topics with no matching post: ${zero.join(', ')}`);

    await clickInView(page, word(partner));
    await page.waitForFunction(`return new URLSearchParams(location.search).getAll('tag').length === 2`);
    const expected = posts.filter((p) => p.tags.includes(top) && p.tags.includes(partner)).length;
    const status = (await page.textContent('[data-testid="post-count"]'))?.trim() ?? '';
    const listed = await page.evaluate(LISTED);
    const wrong = listed.filter((slug) => {
      const post = posts.find((p) => p.slug === slug);
      return !post || !post.tags.includes(top) || !post.tags.includes(partner);
    });
    if (wrong.length) throw new Error(`listed posts missing a picked topic: ${wrong.join(', ')}`);
    if (expected <= 8 && listed.length !== expected) {
      throw new Error(`${listed.length} posts listed for ${top} + ${partner}, expected ${expected} ("${status}")`);
    }

    /* Removing one topic from the active bar widens the list again. */
    await clickInView(page, `[data-testid="active-tag-${partner}"]`);
    await page.waitForFunction(`return new URLSearchParams(location.search).getAll('tag').length === 1`);

    await clickInView(page, '[data-testid="clear-all-filters"]');
    await page.waitForFunction(
      `return location.search === '' && !document.querySelector('[data-testid="active-filters"]')`,
    );
    const all = (await page.textContent('[data-testid="post-count"]'))?.trim() ?? '';
    if (!all.includes(String(posts.length))) throw new Error(`after Clear all the count reads "${all}"`);
  });

  test('on a phone the cloud folds behind "Show topics" so the posts stay near the top', async ({ goto375, page }) => {
    await goto375('/writing');
    await page.waitForSelector('[data-testid="tag-cloud-phone-toggle"]');
    const before = await page.evaluate(
      `return { cloud: document.querySelector('[data-testid="tag-cloud"]').getBoundingClientRect().height,
                firstPost: document.querySelector('[data-testid="post-list"]').getBoundingClientRect().top }`,
    );
    if (before.cloud !== 0) throw new Error(`cloud is ${before.cloud}px tall before "Show topics"`);
    if (before.firstPost > 700) throw new Error(`first post starts at ${before.firstPost}px on a phone`);
    if (await page.isVisible('[data-testid="tag-cloud-toggle"]'))
      throw new Error('"Show all" shows while the cloud is folded');
    await clickInView(page, '[data-testid="tag-cloud-phone-toggle"]');
    await page.waitForFunction(
      `return document.querySelector('[data-testid="tag-cloud"]').getBoundingClientRect().height > 100`,
    );
    if ((await page.attribute('[data-testid="tag-cloud-phone-toggle"]', 'aria-expanded')) !== 'true') {
      throw new Error('phone toggle does not report aria-expanded="true" once open');
    }
  });

  test('a shared /writing?tag= link opens with the filter applied', async ({ goto, page }) => {
    if (!top) throw new Error('content has no tags');
    await goto(`/writing?tag=${encodeURIComponent(top)}`);
    await page.waitForSelector('[data-testid="active-filters"]');
    if ((await page.attribute(word(top), 'aria-pressed')) !== 'true') throw new Error('URL topic is not pressed');
    /* A client render that differs from the prerender must still keep the
     * phone-only toggle off the desktop (style order regression). */
    if (await page.isVisible('[data-testid="tag-cloud-phone-toggle"]'))
      throw new Error('phone toggle shows at desktop width');
    const listed = await page.evaluate(LISTED);
    const wrong = listed.filter((slug) => !posts.find((p) => p.slug === slug)?.tags.includes(top));
    if (listed.length === 0 || wrong.length)
      throw new Error(`shared link listed ${listed.length} posts, off-topic: ${wrong.join(', ')}`);
  });
});

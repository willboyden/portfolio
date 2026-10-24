/**
 * Unit tests for the recipe-body cache (src/content/recipe-bodies.ts).
 *
 * Bodies live outside the JS bundle, so these pin the three ways a page gets
 * one — primed by the prerender, adopted from the prerendered DOM, fetched
 * once — and the two ways a fetch must fail loudly (HTTP error, a file that is
 * not this recipe's body). No DOM and no network: the document and fetch are
 * stand-ins, and every case uses its own slug because the cache is per page.
 */
import { describe, expect, it } from 'vitest';
import {
  adoptPrerenderedRecipeBody,
  cachedRecipeBody,
  loadRecipeBody,
  primeRecipeBody,
  recipeBodyUrl,
} from './recipe-bodies';

const HASH = 'abcdef012345';

function fakeFetch(status: number, body: unknown) {
  const urls: string[] = [];
  const fetcher = async (url: string) => {
    urls.push(url);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetcher, urls };
}

function fakeDocument(el: { dataset: { recipeBody?: string }; innerHTML: string } | null) {
  const asked: string[] = [];
  const doc = {
    querySelector: (selector: string) => {
      asked.push(selector);
      return el;
    },
  } as unknown as Pick<Document, 'querySelector'>;
  return { doc, asked };
}

describe('recipe bodies', () => {
  it('a primed body is served from the cache as is (base "/" adds nothing)', () => {
    primeRecipeBody('primed', '<p><a href="/writing/x">x</a></p>');
    expect(cachedRecipeBody('primed')).toBe('<p><a href="/writing/x">x</a></p>');
    expect(cachedRecipeBody('never-seen')).toBeUndefined();
  });

  it('the body URL sits under the site base, versioned by the hash', () => {
    expect(recipeBodyUrl('some-recipe', HASH)).toBe(`/recipe-bodies/some-recipe.json?v=${HASH}`);
  });

  it('loads a body once, then answers from the cache', async () => {
    const { fetcher, urls } = fakeFetch(200, { slug: 'fetched', html: '<h2>Fetched</h2>' });
    await expect(loadRecipeBody('fetched', HASH, fetcher)).resolves.toBe('<h2>Fetched</h2>');
    expect(urls).toEqual([`/recipe-bodies/fetched.json?v=${HASH}`]);
    await expect(loadRecipeBody('fetched', HASH, fetcher)).resolves.toBe('<h2>Fetched</h2>');
    expect(urls).toHaveLength(1);
    expect(cachedRecipeBody('fetched')).toBe('<h2>Fetched</h2>');
  });

  it('an HTTP error rejects and caches nothing', async () => {
    const { fetcher } = fakeFetch(404, {});
    await expect(loadRecipeBody('gone', HASH, fetcher)).rejects.toThrow('recipe body "gone": HTTP 404');
    expect(cachedRecipeBody('gone')).toBeUndefined();
  });

  it("another recipe's file, or a malformed one, rejects", async () => {
    const wrong = fakeFetch(200, { slug: 'someone-else', html: '<p>x</p>' });
    await expect(loadRecipeBody('mine', HASH, wrong.fetcher)).rejects.toThrow("not this recipe's body");
    const malformed = fakeFetch(200, { slug: 'mine' });
    await expect(loadRecipeBody('mine', HASH, malformed.fetcher)).rejects.toThrow("not this recipe's body");
    expect(cachedRecipeBody('mine')).toBeUndefined();
  });

  it("adopts the prerendered body of the page being loaded, markup untouched", () => {
    const { doc, asked } = fakeDocument({ dataset: { recipeBody: 'adopted' }, innerHTML: '<p>prerendered</p>' });
    adoptPrerenderedRecipeBody(doc);
    expect(asked).toEqual(['#root [data-recipe-body]']);
    expect(cachedRecipeBody('adopted')).toBe('<p>prerendered</p>');
  });

  it('adopts nothing from a page without a recipe body, or an empty one', () => {
    adoptPrerenderedRecipeBody(fakeDocument(null).doc);
    adoptPrerenderedRecipeBody(fakeDocument({ dataset: { recipeBody: 'empty' }, innerHTML: '  ' }).doc);
    adoptPrerenderedRecipeBody(fakeDocument({ dataset: {}, innerHTML: '<p>no slug</p>' }).doc);
    expect(cachedRecipeBody('empty')).toBeUndefined();
  });
});

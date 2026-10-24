/**
 * Unit tests for the post-body cache (src/content/post-bodies.ts).
 *
 * Bodies live outside the JS bundle, so these pin the three ways a page gets
 * one — primed by the prerender, adopted from the prerendered DOM, fetched
 * once — and the two ways a fetch must fail loudly (HTTP error, a file that is
 * not this post's body). No DOM and no network: the document and fetch are
 * stand-ins, and every case uses its own slug because the cache is per page.
 */
import { describe, expect, it } from 'vitest';
import {
  adoptPrerenderedPostBody,
  cachedPostBody,
  loadPostBody,
  postBodyUrl,
  primePostBody,
} from './post-bodies';

const HASH = 'abcdef012345';

function fakeFetch(status: number, body: unknown) {
  const urls: string[] = [];
  const fetcher = async (url: string) => {
    urls.push(url);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetcher, urls };
}

function fakeDocument(el: { dataset: { postBody?: string }; innerHTML: string } | null) {
  const asked: string[] = [];
  const doc = {
    querySelector: (selector: string) => {
      asked.push(selector);
      return el;
    },
  } as unknown as Pick<Document, 'querySelector'>;
  return { doc, asked };
}

describe('post bodies', () => {
  it('a primed body is served from the cache as is (base "/" adds nothing)', () => {
    primePostBody('primed', '<p><a href="/projects/x">x</a></p>');
    expect(cachedPostBody('primed')).toBe('<p><a href="/projects/x">x</a></p>');
    expect(cachedPostBody('never-seen')).toBeUndefined();
  });

  it('the body URL sits under the site base, versioned by the hash', () => {
    expect(postBodyUrl('some-post', HASH)).toBe(`/post-bodies/some-post.json?v=${HASH}`);
  });

  it('loads a body once, then answers from the cache', async () => {
    const { fetcher, urls } = fakeFetch(200, { slug: 'fetched', html: '<h2>Fetched</h2>' });
    await expect(loadPostBody('fetched', HASH, fetcher)).resolves.toBe('<h2>Fetched</h2>');
    expect(urls).toEqual([`/post-bodies/fetched.json?v=${HASH}`]);
    await expect(loadPostBody('fetched', HASH, fetcher)).resolves.toBe('<h2>Fetched</h2>');
    expect(urls).toHaveLength(1);
    expect(cachedPostBody('fetched')).toBe('<h2>Fetched</h2>');
  });

  it('an HTTP error rejects and caches nothing', async () => {
    const { fetcher } = fakeFetch(404, {});
    await expect(loadPostBody('gone', HASH, fetcher)).rejects.toThrow('post body "gone": HTTP 404');
    expect(cachedPostBody('gone')).toBeUndefined();
  });

  it("another post's file, or a malformed one, rejects", async () => {
    const wrong = fakeFetch(200, { slug: 'someone-else', html: '<p>x</p>' });
    await expect(loadPostBody('mine', HASH, wrong.fetcher)).rejects.toThrow("not this post's body");
    const malformed = fakeFetch(200, { slug: 'mine' });
    await expect(loadPostBody('mine', HASH, malformed.fetcher)).rejects.toThrow("not this post's body");
    expect(cachedPostBody('mine')).toBeUndefined();
  });

  it('adopts the prerendered body of the page being loaded, markup untouched', () => {
    const { doc, asked } = fakeDocument({ dataset: { postBody: 'adopted' }, innerHTML: '<p>prerendered</p>' });
    adoptPrerenderedPostBody(doc);
    expect(asked).toEqual(['#root [data-post-body]']);
    expect(cachedPostBody('adopted')).toBe('<p>prerendered</p>');
  });

  it('adopts nothing from a page without a post body, or an empty one', () => {
    adoptPrerenderedPostBody(fakeDocument(null).doc);
    adoptPrerenderedPostBody(fakeDocument({ dataset: { postBody: 'empty' }, innerHTML: '  ' }).doc);
    adoptPrerenderedPostBody(fakeDocument({ dataset: {}, innerHTML: '<p>no slug</p>' }).doc);
    expect(cachedPostBody('empty')).toBeUndefined();
  });
});

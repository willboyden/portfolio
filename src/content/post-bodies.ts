/**
 * Writing: the post bodies, kept out of the JS bundle (as recipe bodies are,
 * src/content/recipe-bodies.ts).
 *
 * Posts were most of the bundle every page loads: with twelve posts their
 * content was 77 kB of the 220 kB JS budget (gzipped), and a six-post series
 * took it past the budget (2026-10-24). Now scripts/build-content.mjs writes
 * each body to public/post-bodies/<slug>.json and this module hands it to the
 * page from one of three places:
 *
 *   1. the prerender (prerender/entry.ts) reads every body file and primes it,
 *      so the static HTML carries the post for no-JS readers, crawlers and feeds;
 *   2. the client's first load adopts that prerendered body from the DOM
 *      (src/main.tsx) before the replace-render throws the server markup away;
 *   3. a client-side visit fetches the file once (same origin, CSP
 *      connect-src 'self'); `bodyHash` versions the URL across deploys.
 *
 * The cache holds HTML ready to inject: base path already applied (rebaseHtml
 * is not idempotent, so DOM-adopted markup is stored as it is).
 */
import { PostBodySchema } from './schema';
import { rebaseHtml, withBase } from 'app/lib/seo';

const bodies = new Map<string, string>();

/** Store a body as the build wrote it (root-absolute links, no base yet). */
export function primePostBody(slug: string, rawHtml: string): void {
  bodies.set(slug, rebaseHtml(rawHtml));
}

/** The body for `slug` if this page already has it, ready to inject. */
export function cachedPostBody(slug: string): string | undefined {
  return bodies.get(slug);
}

/** Where a post's body file is served, versioned by its hash. */
export function postBodyUrl(slug: string, bodyHash: string): string {
  return withBase(`/post-bodies/${slug}.json?v=${bodyHash}`);
}

/** Keep the prerendered body of the page being loaded (call before the first
 * client render). Its markup already carries the base path. `doc` is the page's
 * document; unit tests pass a stand-in (they run without a DOM). */
export function adoptPrerenderedPostBody(doc: Pick<Document, 'querySelector'>): void {
  const el = doc.querySelector<HTMLElement>('#root [data-post-body]');
  const slug = el?.dataset.postBody;
  if (el && slug && el.innerHTML.trim() !== '') bodies.set(slug, el.innerHTML);
}

/** The body for `slug`: from the cache, else fetched once from its file. Rejects
 * on HTTP errors and on a file that is not this post's body. */
export async function loadPostBody(
  slug: string,
  bodyHash: string,
  fetcher: (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>> = (url) => fetch(url),
): Promise<string> {
  const cached = bodies.get(slug);
  if (cached !== undefined) return cached;
  const res = await fetcher(postBodyUrl(slug, bodyHash));
  if (!res.ok) throw new Error(`post body "${slug}": HTTP ${res.status}`);
  const parsed = PostBodySchema.safeParse(await res.json());
  if (!parsed.success || parsed.data.slug !== slug) {
    throw new Error(`post body "${slug}": the file is not this post's body`);
  }
  primePostBody(slug, parsed.data.html);
  return bodies.get(slug) as string;
}

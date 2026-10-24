/**
 * AI Engineering › Local recipes: the recipe bodies, kept out of the JS bundle.
 *
 * A recipe body is long (the first one is 33 kB of HTML) and every one used to
 * ship in the bundle every page loads, against the site's 220 kB JS budget. Now
 * scripts/build-content.mjs writes each body to public/recipe-bodies/<slug>.json
 * and this module hands it to the page from one of three places:
 *
 *   1. the prerender (prerender/entry.ts) reads every body file and primes it,
 *      so the static HTML carries the recipe for no-JS readers and crawlers;
 *   2. the client's first load adopts that prerendered body from the DOM
 *      (src/main.tsx) before the replace-render throws the server markup away;
 *   3. a client-side visit fetches the file once (same origin, CSP
 *      connect-src 'self'); `bodyHash` versions the URL across deploys.
 *
 * The cache holds HTML ready to inject: base path already applied (rebaseHtml
 * is not idempotent, so DOM-adopted markup is stored as it is).
 */
import { RecipeBodySchema } from './schema';
import { rebaseHtml, withBase } from 'app/lib/seo';

const bodies = new Map<string, string>();

/** Store a body as the build wrote it (root-absolute links, no base yet). */
export function primeRecipeBody(slug: string, rawHtml: string): void {
  bodies.set(slug, rebaseHtml(rawHtml));
}

/** The body for `slug` if this page already has it, ready to inject. */
export function cachedRecipeBody(slug: string): string | undefined {
  return bodies.get(slug);
}

/** Where a recipe's body file is served, versioned by its hash. */
export function recipeBodyUrl(slug: string, bodyHash: string): string {
  return withBase(`/recipe-bodies/${slug}.json?v=${bodyHash}`);
}

/** Keep the prerendered body of the page being loaded (call before the first
 * client render). Its markup already carries the base path. `doc` is the page's
 * document; unit tests pass a stand-in (they run without a DOM). */
export function adoptPrerenderedRecipeBody(doc: Pick<Document, 'querySelector'>): void {
  const el = doc.querySelector<HTMLElement>('#root [data-recipe-body]');
  const slug = el?.dataset.recipeBody;
  if (el && slug && el.innerHTML.trim() !== '') bodies.set(slug, el.innerHTML);
}

/** The body for `slug`: from the cache, else fetched once from its file. Rejects
 * on HTTP errors and on a file that is not this recipe's body. */
export async function loadRecipeBody(
  slug: string,
  bodyHash: string,
  fetcher: (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>> = (url) => fetch(url),
): Promise<string> {
  const cached = bodies.get(slug);
  if (cached !== undefined) return cached;
  const res = await fetcher(recipeBodyUrl(slug, bodyHash));
  if (!res.ok) throw new Error(`recipe body "${slug}": HTTP ${res.status}`);
  const parsed = RecipeBodySchema.safeParse(await res.json());
  if (!parsed.success || parsed.data.slug !== slug) {
    throw new Error(`recipe body "${slug}": the file is not this recipe's body`);
  }
  primeRecipeBody(slug, parsed.data.html);
  return bodies.get(slug) as string;
}

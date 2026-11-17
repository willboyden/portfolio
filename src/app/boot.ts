/**
 * How the browser takes over the page it was served.
 *
 * Every page is prerendered to static HTML, and that HTML is what the visitor
 * sees first. When the app starts it can either ADOPT that markup (hydrate:
 * keep every element, attach behaviour to it) or REPLACE it (render: build the
 * page again and swap it in).
 *
 * Adopting is the better start whenever it is safe. The elements the browser
 * already painted stay the same elements, so nothing flickers, the largest
 * piece of content counts as painted when it first appeared (not when the
 * script got round to rebuilding it), and the work can be split into small
 * steps that never hold the page up.
 *
 * It is safe only when the app's first render will produce exactly what the
 * server produced. `bootMode` decides that from facts, and falls back to
 * replacing the page whenever there is any doubt: replacing is always correct,
 * only slower.
 */

export type BootMode = 'hydrate' | 'render';

export interface BootFacts {
  /** `data-prerendered` on the mount element: the app path the served HTML
   * was rendered for. `null` when the page was not prerendered (dev server). */
  prerenderedPath: string | null;
  /** Whether the mount element has any markup to adopt. */
  hasMarkup: boolean;
  /** The app-relative path in the address bar (hosting base stripped). */
  pathname: string;
  /** `location.search`: '' when there is none. */
  search: string;
}

/** `/writing/` and `/writing` are one page; the root stays `/`. */
export function trimPath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function bootMode(facts: BootFacts): BootMode {
  /* Nothing to adopt: the dev server's empty mount element. */
  if (facts.prerenderedPath === null || !facts.hasMarkup) return 'render';

  /* The server never sees a query string, and some pages read theirs on the
   * first render (a filtered or paged list): their first render would differ
   * from the markup. */
  if (facts.search !== '') return 'render';

  /* The markup must be THIS page's. The host answers every unknown address
   * with its not-found page, which was rendered for another path than the one
   * in the address bar: even when the app would also show "not found" there,
   * parts of the page print or compare the path (the navigation does), and
   * adopted markup keeps the attributes it came with. Replacing is exact. */
  return trimPath(facts.prerenderedPath) === trimPath(facts.pathname) ? 'hydrate' : 'render';
}

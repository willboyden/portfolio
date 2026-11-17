/**
 * The app's start: everything the browser does to take the page over.
 *
 * src/main.tsx (the entry script) imports this module only after the browser
 * has painted the prerendered page, so nothing here stands between the visitor
 * and the first paint.
 */
import { startTransition } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { adoptPrerenderedStyleSheet } from '@emotion/react';
import { readBrowserLocation } from '@portfolio/router';
import { createApp } from './App';
import { bootMode, type BootMode } from './boot';
import { contentHash } from '../content';
import { knowledgeGraphOnce } from '../content/knowledge-graph';
import { adoptPrerenderedRecipeBody } from '../content/recipe-bodies';
import { adoptPrerenderedPostBody } from '../content/post-bodies';

const mount = document.getElementById('root');
if (!mount) throw new Error('missing #root mount element');
const container: HTMLElement = mount;

/* R1A-10: adopt the prerendered critical CSS <style> as the sheet. It is never
 * written to again (vendor/emotion: the base), so the document does not carry
 * its stylesheet twice and nothing the server styled can lose its styles. */
adoptPrerenderedStyleSheet();

/* Neither a recipe's body nor a post's is in the JS bundle
 * (src/content/recipe-bodies.ts, src/content/post-bodies.ts). Keep the
 * prerendered copy, so the first render has the same body the markup has and
 * the page neither flashes empty nor fetches what it already holds. */
adoptPrerenderedRecipeBody(document);
adoptPrerenderedPostBody(document);

/* What happened, readable from outside (the browser suite checks every page):
 * data-boot is `pending` from the entry script until this module decides, then
 * `hydrate` or `render` (and `recovered` if React had to rebuild after all);
 * the app shell adds data-ready when its first commit is in. */
const html = document.documentElement;

/*
 * Take the page over (src/app/boot.ts has the reasoning).
 *
 * Normally the prerendered markup is ADOPTED: every element the browser
 * already painted stays in place and React attaches to it. The work runs as a
 * transition, which React splits into short steps, so it never blocks the
 * page for long. The theme, reduced-motion and date hooks all answer with the
 * server's values during this pass and correct themselves right after.
 *
 * When the first render could differ from the markup (a query string, the
 * not-found page, a page that was not prerendered), the markup is REPLACED
 * instead, as this file always did: correct in every case, one extra paint.
 */
function start(mode: BootMode): void {
  html.setAttribute('data-boot', mode);
  if (mode === 'hydrate') {
    startTransition(() => {
      hydrateRoot(container, createApp(), {
        onRecoverableError(error) {
          /* React rebuilt part of the page because the markup and the first
           * render disagreed. The page is right either way; say so, loudly. */
          html.setAttribute('data-boot', 'recovered');
          console.error(error);
        },
      });
    });
  } else {
    createRoot(container).render(createApp());
  }
}

const mode = bootMode({
  prerenderedPath: container.getAttribute('data-prerendered'),
  hasMarkup: container.firstElementChild !== null,
  pathname: readBrowserLocation().pathname,
  search: window.location.search,
});

if (mode === 'hydrate' && container.querySelector('[data-await="knowledge-graph"]') !== null) {
  /* This page's markup includes the knowledge-graph explorer, rendered at
   * build time from a file the bundle does not carry. Adopting the page needs
   * the same data, so fetch it first: the prerendered page stays on screen
   * meanwhile, complete and styled. If the file cannot be had, rebuild the
   * page instead; it then shows its "did not load" state. */
  void knowledgeGraphOnce(contentHash).then((graph) => start(graph ? 'hydrate' : 'render'));
} else {
  start(mode);
}

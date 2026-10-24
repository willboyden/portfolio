/**
 * Prerender entry — built by vite into prerender/entry.mjs (node target).
 *
 * Exports consumed by scripts/prerender.mjs:
 *   prerenderPaths(): string[]
 *   renderRoute(path): { html: string; cssErrors: string[] }
 *   siteMeta, feedItems, sitemapPaths
 *
 * The app shell (src/app/App.tsx) exports `createApp(path)` so the same tree
 * renders on both sides of the build.
 *
 * R7A-3: root-absolute URLs are made base-path-aware via withBase().
 * import.meta.env.BASE_URL is set by Vite at build time (e.g. /portfolio/ or /).
 */
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createApp } from '../src/app/App.tsx';
import { __sheetCss, __resetSheet } from '@emotion-mini/core';
import { buildHead, SITE } from '../src/lib/seo.ts';
import { metaFor } from '../src/lib/route-meta.ts';
import { content } from '../src/content/index.ts';
import { availableNavItems } from '../src/components/layout/Nav';

/** R7A-3: prepend BASE_URL to root-absolute paths so they resolve under
 * GitHub Pages subpaths (e.g. BASE_URL='/portfolio/' → /portfolio/rss.xml). */
function withBase(path: string): string {
  // $FlowFixMe $TSIgnoreMe — import.meta.env available at runtime via Vite build.
  const base = (import.meta.env as Record<string, unknown>).BASE_URL ?? '/';
  return base.replace(/\/$/, '') + path;
}

export function prerenderPaths(): string[] {
  return [
    '/',
    '/about',
    '/now',
    '/projects',
    '/writing',
    '/videos',
    '/talks',
    '/ai-engineering',
    '/contact',
    /* nginx error_page serves /404/index.html — rendered via the router
     * fallback since no route matches the path. */
    '/404',
    ...content.projects.map((p) => `/projects/${p.slug}`),
    ...content.posts.map((p) => `/writing/${p.slug}`),
    /* R9: capability detail pages (hub + per-capability). */
    ...content.aiCapabilities.map((c) => `/ai-engineering/${c.slug}`),
  ];
}

/* R2C-4: /404 renders (nginx needs the file) but is NOT discoverable — no
 * sitemap entry, noindex via PageMeta below. */
export const sitemapPaths = prerenderPaths().filter((p) => p !== '/404');

/* R8A-3: per-URL lastmod from the entry's own content date — one global
 * lastmod told crawlers every page changed whenever any content did. Routes
 * without a single content item (home, about, now, contact, section indexes)
 * fall back to the prerender script's git-derived global lastmod. */
/* R9A-3: per-URL lastmod from the entry's own content date — one global
 * lastmod told crawlers every page changed whenever any content did.
 * R9A-11: /now gets the newest content date too (it must not be coarser
 * than the dateModified the page itself ships). */
const newestContentDateForSitemap = [...content.projects, ...content.posts]
  .map((i) => i.date)
  .sort()
  .at(-1);

export const sitemapDates: Record<string, string> = {
  '/now': newestContentDateForSitemap ?? '2026-01-01',
  ...Object.fromEntries(content.projects.map((p) => [`/projects/${p.slug}`, p.date])),
  ...Object.fromEntries(content.posts.map((p) => [`/writing/${p.slug}`, p.date])),
  ...Object.fromEntries(content.aiCapabilities.map((c) => [`/ai-engineering/${c.slug}`, c.date])),
};

export const siteMeta = {
  title: SITE.title,
  description: SITE.description,
  shortTitle: SITE.shortTitle ?? 'Portfolio',
  /* R2C-1: single source of truth for the absolute origin — sitemap/robots/RSS
   * must match the canonical host exactly (was a divergent example.com env
   * default that pointed every discovery doc at a domain we don't own). */
  url: SITE.url.replace(/\/$/, ''),
};

export const feedItems = content.posts
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .map((post) => ({
    slug: post.slug,
    title: post.title,
    summary: post.excerpt || post.summary,
    date: post.date,
    tags: post.tags,
    path: `/writing/${post.slug}`,
  }));

const CLIENT_SCRIPT = '/src/main.tsx';

export function renderRoute(path: string): { html: string; cssErrors: string[] } {
  __resetSheet();
  const body = renderToStaticMarkup(createApp(path));
  const css = __sheetCss();

  /* Emotion collected raw CSS text; catch anything that serialized wrong. */
  const cssErrors: string[] = [];
  if (/undefined|NaN|\[object Object\]/.test(css)) {
    const line = css.split('\n').find((l) => /undefined|NaN|\[object Object\]/.test(l)) ?? '';
    cssErrors.push(line.slice(0, 160));
  }

  /* R2C-3: identical meta the client will apply on hydration/navigation. */
  const meta = metaFor(path);

  const head = buildHead(meta).join('\n    ');
  const scriptSrc = import.meta.env?.PROD ? assetHref() : CLIENT_SCRIPT;
  /* R2C-7: re-emit vite's modulepreload hints for the entry's imported
   * chunks — without them the 3 JS chunks load as a serial discovery
   * waterfall (entry -> react -> vendor). */
  const preloads = import.meta.env?.PROD
    ? chunkHrefs()
        .filter((href) => href !== scriptSrc)
        .map((href) => `    <link rel="modulepreload" href="${href}" />`)
        .join('\n')
    : '';

  /* Same items as the JS nav (empty sections stay out), base-prefixed: a bare
   * item.to 404'd on every page when the site is served under /portfolio/. */
  const staticNav = availableNavItems()
    .map((item) => `<a href="${withBase(item.to)}" class="nav-link">${item.label}</a>`)
    .join('');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <!-- R7A-8: Without JS the page defaults dark (the :root tokens);
         theme-init.js resolves the light/dark palette at runtime. The
         theme-color media pairs cover browser chrome only, not the page
         background — an accepted trade-off (R7A-8 disposition: accept). -->
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0e14" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#eef1f6" />
${head}
    <link rel="icon" href="${withBase('/favicon.svg')}" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="${withBase('/apple-touch-icon.png')}" />
    <link rel="manifest" href="${withBase('/site.webmanifest')}" />
${preloads ? preloads + '\n' : ''}    <script src="${withBase('/theme-init.js')}"></script>
    <script src="${withBase('/spa-gate.js')}"></script>
    <style id="emotion-prerender">${css}</style>
    <!-- R7A-1/R7A-2: without JS the menu button, search form and tag chips
         are inert controls — hide them and reveal the static mobile nav so
         handheld no-JS users keep full navigation. -->
    <noscript><style>
      [data-testid="menu-button"] { display: none !important; }
      [data-testid="post-search-form"] { display: none !important; }
      [data-testid="tag-filters"] { display: none !important; }
      [data-testid="tag-filter"] { display: none !important; }
      .static-mobile-nav { display: block !important; }
    </style></noscript>
  </head>
  <body>
    <div id="root">${body}</div>

    <!-- R7A-1: static mobile nav — revealed when JS is disabled via noscript CSS -->
    <nav class="static-mobile-nav" aria-label="Primary">
      ${staticNav}
    </nav>
    <script type="module" src="${scriptSrc}"></script>
  </body>
</html>`;
  return { html, cssErrors };
}

/* The hashed entry filename is only knowable after the client build; vite
 * emits .vite/manifest.json (build.manifest) listing the entry chunk. */
function readManifest(): Record<string, { file?: string; src?: string }> | null {
  try {
    const manifestPath = new URL('../dist/.vite/manifest.json', import.meta.url);
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

/** Every JS asset in the manifest (entry + its imported chunks), as hrefs.
 * R8: base-prefixed for sub-path hosting (GitHub Pages). */
function chunkHrefs(): string[] {
  const manifest = readManifest();
  if (!manifest) return [];
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return Object.values(manifest)
    .flatMap((e) => (typeof e.file === 'string' && e.file.endsWith('.js') ? [`${base}/${e.file}`] : []));
}

function assetHref(): string {
  /* vite emits dist/.vite/manifest.json; with rollup input 'index.html' the
   * entry key IS 'index.html'. Fall back only if the manifest is missing.
   * R8: hrefs are base-relative (vite build --base wrote the manifest paths
   * WITH the base already? No — manifest paths are always 'assets/...'; the
   * base belongs in the emitted URL). */
  try {
    const manifestPath = new URL('../dist/.vite/manifest.json', import.meta.url);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const entry = manifest['index.html'] ?? manifest['src/main.tsx'];
    const file = entry?.file ?? entry?.src;
    if (typeof file === 'string' && file.startsWith('assets/')) {
      const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
      return `${base}/${file}`;
    }
  } catch {
    /* R3C-11: no silent fallback — a wrong entry href means a white page on
     * every route, which the href-only audit regex would never see. */
    throw new Error(
      'prerender: dist/.vite/manifest.json missing or has no index.html entry ' +
        '— run `vite build` before prerender (build.mjs chains these in order)',
    );
  }
}


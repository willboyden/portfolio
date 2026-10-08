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
 */
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createApp } from '../src/app/App.tsx';
import { __sheetCss, __resetSheet } from '@emotion-mini/core';
import { buildHead, SITE } from '../src/lib/seo.ts';
import { metaFor } from '../src/lib/route-meta.ts';
import { content } from '../src/content/index.ts';

export function prerenderPaths(): string[] {
  return [
    '/',
    '/about',
    '/now',
    '/projects',
    '/writing',
    '/videos',
    '/talks',
    '/contact',
    /* nginx error_page serves /404/index.html — rendered via the router
     * fallback since no route matches the path. */
    '/404',
    ...content.projects.map((p) => `/projects/${p.slug}`),
    ...content.posts.map((p) => `/writing/${p.slug}`),
  ];
}

/* R2C-4: /404 renders (nginx needs the file) but is NOT discoverable — no
 * sitemap entry, noindex via PageMeta below. */
export const sitemapPaths = prerenderPaths().filter((p) => p !== '/404');

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

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
${head}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/site.webmanifest" />
${preloads ? preloads + '\n' : ''}    <script src="/theme-init.js"></script>
    <style id="emotion-prerender">${css}</style>
  </head>
  <body>
    <div id="root">${body}</div>
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

/** Every JS asset in the manifest (entry + its imported chunks), as /hrefs. */
function chunkHrefs(): string[] {
  const manifest = readManifest();
  if (!manifest) return [];
  return Object.values(manifest)
    .flatMap((e) => (typeof e.file === 'string' && e.file.endsWith('.js') ? [`/${e.file}`] : []));
}

function assetHref(): string {
  /* vite emits dist/.vite/manifest.json; with rollup input 'index.html' the
   * entry key IS 'index.html'. Fall back only if the manifest is missing. */
  try {
    const manifestPath = new URL('../dist/.vite/manifest.json', import.meta.url);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const entry = manifest['index.html'] ?? manifest['src/main.tsx'];
    const file = entry?.file ?? entry?.src;
    if (typeof file === 'string' && file.startsWith('assets/')) return `/${file}`;
  } catch {
    /* fall through to the stable fallback */
  }
  return '/assets/index.js';
}


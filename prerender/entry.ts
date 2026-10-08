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
import { buildHead, SITE, pageMeta } from '../src/lib/seo.ts';
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

export const sitemapPaths = prerenderPaths();

export const siteMeta = {
  title: SITE.title,
  description: SITE.description,
  shortTitle: SITE.shortTitle ?? 'Portfolio',
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

  const meta = pageMeta({
    title: titleFor(path),
    description: descriptionFor(path),
    path,
    ...(path.startsWith('/writing/') && feedItems[0] ? publishedFor(path) : {}),
  });

  const head = buildHead(meta).join('\n    ');
  const scriptSrc = import.meta.env?.PROD ? assetHref() : CLIENT_SCRIPT;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
${head}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/site.webmanifest" />
    <script src="/theme-init.js"></script>
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
function assetHref(): string {
  try {
    const manifestPath = new URL('../dist/.vite/manifest.json', import.meta.url);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const entry = manifest['src/main.tsx'];
    if (entry?.file) return `/${entry.file}`;
  } catch {
    /* fall through to the stable fallback the client build also emits */
  }
  return '/assets/index.js';
}

function titleFor(path: string): string {
  if (path === '/') return `${SITE.title} — ${SITE.tagline}`;
  const seg = path.split('/')[1];
  const pageNames: Record<string, string> = {
    about: 'About',
    now: 'Now',
    projects: 'Projects',
    writing: 'Writing',
    videos: 'Videos',
    talks: 'Talks',
    contact: 'Contact',
  };
  if (seg === 'projects') {
    const slug = path.split('/')[2];
    if (slug) return `${content.projects.find((p) => p.slug === slug)?.title ?? 'Project'} — Projects`;
    return 'Projects';
  }
  if (seg === 'writing') {
    const slug = path.split('/')[2];
    if (slug) return `${content.posts.find((p) => p.slug === slug)?.title ?? 'Post'} — Writing`;
    return 'Writing';
  }
  return pageNames[seg] ? `${pageNames[seg]} — ${SITE.title}` : SITE.title;
}

function descriptionFor(path: string): string {
  if (path.startsWith('/projects/')) {
    const slug = path.split('/')[2];
    return content.projects.find((p) => p.slug === slug)?.summary ?? SITE.description;
  }
  if (path.startsWith('/writing/')) {
    const slug = path.split('/')[2];
    const post = content.posts.find((p) => p.slug === slug);
    return post?.excerpt || post?.summary || SITE.description;
  }
  return SITE.description;
}

function publishedFor(path: string): { publishedTime?: string; type: 'article' } | Record<string, never> {
  const slug = path.split('/')[2];
  const post = content.posts.find((p) => p.slug === slug);
  return post ? { publishedTime: post.date, type: 'article' as const } : {};
}

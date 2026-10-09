/**
 * App tree + route metadata — closes the coverage-inventory gap on
 * src/app/App.tsx (the real tree, not just pages in isolation) and
 * src/lib/route-meta.ts (the prerender/SPA single source of truth, R2C-3).
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { __resetSheet } from '@emotion-mini/core';
import { createApp } from './App';
import { titleFor, descriptionFor, ogImageFor, metaFor } from 'app/lib/route-meta';
import { content } from 'app/content';

const app = (path: string): string => {
  __resetSheet();
  return renderToStaticMarkup(createApp(path));
};

describe('createApp (full tree)', () => {
  it('renders the whole chrome + routed content for a section route', () => {
    const html = app('/projects');
    expect(html).toContain('<header');
    expect(html).toContain('<main');
    expect(html).toContain('<footer');
    expect(html).toContain('Projects');
    /* Content-driven nav (R2-A A7): zero videos -> no Videos tab. */
    expect(html).not.toContain('>Videos</a>');
  });

  it('renders a project detail route through the real router', () => {
    const slug = content.projects[0]?.slug;
    if (!slug) return; /* content pipeline empty — nothing to route */
    const html = app(`/projects/${slug}`);
    const project = content.projects.find((p) => p.slug === slug);
    expect(html).toContain(project?.title ?? slug);
  });

  it('routes an unknown path to the 404 view inside full chrome', () => {
    const html = app('/definitely-not-a-route');
    expect(html).toContain('<header');
    expect(html).toContain('data-testid="not-found"');
  });
});

describe('route-meta (shared prerender/SPA source, R2C-3)', () => {
  it('home title is bare so capTitle emits SITE.title unchanged (R2C-2)', () => {
    expect(titleFor('/')).toBe('');
    const m = metaFor('/');
    /* capTitle's empty-title path returns the full brand title verbatim —
     * no duplicated name, no mid-word ellipsis. */
    expect(m.titlePlain).toBe('William Boyden — AI Engineering & Technical Consulting');
    expect(m.titlePlain.match(/William Boyden/g)?.length).toBe(1);
    expect(m.titlePlain.length).toBeLessThanOrEqual(60);
  });

  it('every prerenderable route has a unique composed title', () => {
    const paths = [
      '/', '/about', '/now', '/projects', '/writing', '/videos', '/talks', '/contact', '/404',
      ...content.projects.map((p) => `/projects/${p.slug}`),
      ...content.posts.map((p) => `/writing/${p.slug}`),
    ];
    const titles = paths.map((p) => metaFor(p).titlePlain);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('404 is noindexed and excluded from indexable defaults', () => {
    expect(metaFor('/404').robots).toBe('noindex,nofollow');
    expect(metaFor('/about').robots).toBe('index,follow');
  });

  it('section routes carry their OG art; others fall back', () => {
    expect(ogImageFor('/projects')).toBe('/og/projects.png');
    expect(ogImageFor('/writing')).toBe('/og/writing.png');
    expect(ogImageFor('/about')).toBeUndefined();
    expect(metaFor('/projects').image).toContain('/og/projects.png');
  });

  it('detail descriptions come from content, fallbacks never empty', () => {
    const p = content.projects[0];
    if (p) expect(descriptionFor(`/projects/${p.slug}`)).toBe(p.summary);
    const post = content.posts[0];
    if (post) expect(descriptionFor(`/writing/${post.slug}`).length).toBeGreaterThan(0);
    expect(descriptionFor('/now').length).toBeGreaterThan(0);
  });

  it('post metas are article-typed with published time', () => {
    const post = content.posts[0];
    if (!post) return;
    const m = metaFor(`/writing/${post.slug}`);
    expect(m.type).toBe('article');
    expect(m.publishedTime).toBe(post.date);
  });
});

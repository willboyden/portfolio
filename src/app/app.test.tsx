/**
 * App tree + route metadata — closes the coverage-inventory gap on
 * src/app/App.tsx (the real tree, not just pages in isolation) and
 * src/lib/route-meta.ts (the prerender/SPA single source of truth, R2C-3).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { __resetSheet } from '@emotion-mini/core';
import { createApp } from './App';
import { titleFor, descriptionFor, ogImageFor, metaFor } from 'app/lib/route-meta';
import { content, RecipeBodySchema } from 'app/content';

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

  it('the AI hub lists every capability from real content (no mocks)', () => {
    /* The hub once read a content export that did not exist and always
     * rendered "still being written"; its mocked unit tests passed. */
    const html = app('/ai-engineering');
    expect(html).not.toContain('still being written');
    for (const cap of content.aiCapabilities) {
      expect(html).toContain(`data-testid="ai-capability-link-${cap.slug}"`);
      expect(html).toContain(`data-testid="ai-subnav-${cap.slug}"`);
    }
  });

  it('every capability page routes to its detail view, never the 404', () => {
    /* tech-stack and data-analytics were prerendered with no route. */
    for (const cap of content.aiCapabilities) {
      const html = app(`/ai-engineering/${cap.slug}`);
      expect(html, cap.slug).not.toContain('data-testid="not-found"');
      expect(html, cap.slug).toContain('data-testid="ai-detail-title"');
    }
  });

  it('routes an unknown path to the 404 view inside full chrome', () => {
    const html = app('/definitely-not-a-route');
    expect(html).toContain('<header');
    expect(html).toContain('data-testid="not-found"');
  });

  it('Local recipes: the index beats /ai-engineering/:slug, every recipe routes, unknown slugs 404', () => {
    const index = app('/ai-engineering/local-recipes');
    expect(index).not.toContain('data-testid="not-found"');
    expect(index).toContain('data-testid="recipes-title"');
    for (const recipe of content.recipes) {
      expect(index, recipe.slug).toContain(`data-testid="recipe-link-${recipe.slug}"`);
      const html = app(`/ai-engineering/local-recipes/${recipe.slug}`);
      expect(html, recipe.slug).not.toContain('data-testid="not-found"');
      expect(html, recipe.slug).toContain('data-testid="recipe-title"');
    }
    expect(app('/ai-engineering/local-recipes/no-such-recipe')).toContain('data-testid="not-found"');
  });

  it('the AI hub links the Local recipes subsection and each recipe (real content)', () => {
    const html = app('/ai-engineering');
    expect(html).toContain('data-testid="ai-subnav-local-recipes"');
    for (const recipe of content.recipes) {
      expect(html, recipe.slug).toContain(`data-testid="ai-hub-recipe-${recipe.slug}"`);
    }
  });

  it('recipe bodies stay out of the bundle: one committed body file per recipe, matching its bodyHash', () => {
    /* A recipe committed without its public/recipe-bodies file (or with a stale
     * one) would ship an empty or outdated page; the prerender refuses that too. */
    const dir = new URL('../../public/recipe-bodies/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    expect(files).toEqual(content.recipes.map((r) => `${r.slug}.json`).sort());
    for (const recipe of content.recipes) {
      expect(recipe, recipe.slug).not.toHaveProperty('html');
      const body = RecipeBodySchema.parse(JSON.parse(readFileSync(new URL(`${recipe.slug}.json`, dir), 'utf8')));
      expect(body.slug).toBe(recipe.slug);
      expect(createHash('sha256').update(body.html).digest('hex').slice(0, 12), recipe.slug).toBe(recipe.bodyHash);
    }
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
      '/ai-engineering/local-recipes',
      ...content.recipes.map((r) => `/ai-engineering/local-recipes/${r.slug}`),
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

  it('Local recipes meta: section title and description, recipes are dated articles, unknown slug is a 404 title', () => {
    expect(titleFor('/ai-engineering/local-recipes')).toBe('Local recipes — AI Engineering');
    expect(descriptionFor('/ai-engineering/local-recipes').length).toBeGreaterThan(20);
    expect(titleFor('/ai-engineering/local-recipes/no-such-recipe')).toBe('Page not found');
    const recipe = content.recipes[0];
    if (!recipe) return;
    const path = `/ai-engineering/local-recipes/${recipe.slug}`;
    expect(titleFor(path)).toBe(`${recipe.title} — Local recipes`);
    expect(descriptionFor(path)).toBe(recipe.summary);
    const m = metaFor(path);
    expect(m.type).toBe('article');
    expect(m.publishedTime).toBe(recipe.date);
  });
});

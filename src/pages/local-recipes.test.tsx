/**
 * Unit tests for AI Engineering › Local recipes (index + one recipe).
 *
 * Same posture as writing.test.tsx (CONTRACT §0: no jsdom): the SSR pass pins
 * STRUCTURE — one h1, breadcrumb hrefs, the subsection nav's aria-current,
 * the "at a glance" values, the build-time HTML landing inside Prose — and the
 * pure helpers are tested directly. `app/content` is mocked with a mutable
 * store so the empty state and the populated pages are both proven without
 * touching src/content/generated/content.json (app.test.tsx covers the real
 * bundle and routing).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterProvider, type RouteDefinition } from '@portfolio/router';
import { AppThemeProvider } from 'app/theme/ThemeProvider';
import type { Recipe } from 'app/content';

const H = vi.hoisted(() => ({ store: { recipes: [] as unknown[] } }));

vi.mock('app/content', () => ({
  content: { projects: [], posts: [], videos: [], talks: [], aiCapabilities: [], recipes: [] },
  getPost: () => undefined,
  postsByDate: () => [],
  aiCapabilitiesBySlug: () => [],
  getRecipe: (slug: string) => (H.store.recipes as Recipe[]).find((r) => r.slug === slug),
  recipesByDate: () => H.store.recipes as Recipe[],
}));

const { LocalRecipesIndex, RecipeDetailView, recipePath, recipeStatusLabel } = await import('./LocalRecipes');
const { AiEngineeringHub, aiRecipeList, LOCAL_RECIPES_PATH } = await import('./AiEngineering');

const makeRecipe = (over: Partial<Recipe> & { slug: string; title: string }): Recipe => ({
  summary: `Summary of ${over.title}. Measured.`,
  tags: ['vllm'],
  date: '2026-10-24',
  hardware: '4 × GB10',
  model: 'Some model, NVFP4',
  engine: 'vLLM nightly',
  status: 'in-use',
  results: [
    { label: 'Decode step', value: '~61 ms' },
    { label: 'Agent loop', value: '71 tok/s' },
  ],
  readingMinutes: 18,
  html: '<h2 id="what-runs">What runs</h2>\n<p>Body of the recipe.</p>',
  ...over,
});

const routes: RouteDefinition[] = [
  { path: '/ai-engineering', component: () => null },
  { path: '/ai-engineering/local-recipes', component: () => null },
  { path: '/ai-engineering/local-recipes/:slug', component: () => null },
];

function render(ui: ReactNode, path: string): string {
  return renderToStaticMarkup(
    createElement(AppThemeProvider, null, createElement(RouterProvider, { routes, initialPath: path }, ui)),
  );
}

const count = (html: string, needle: string): number => html.split(needle).length - 1;

beforeEach(() => {
  H.store.recipes = [];
});

describe('pure helpers', () => {
  it('recipePath nests under the subsection path', () => {
    expect(LOCAL_RECIPES_PATH).toBe('/ai-engineering/local-recipes');
    expect(recipePath('x-y')).toBe('/ai-engineering/local-recipes/x-y');
  });

  it('recipeStatusLabel is words, never colour alone', () => {
    expect(recipeStatusLabel('in-use')).toBe('In use');
    expect(recipeStatusLabel('retired')).toBe('Retired');
  });

  it('aiRecipeList narrows what the content API returns and survives an absent API', () => {
    expect(aiRecipeList(undefined)).toEqual([]);
    expect(aiRecipeList(() => 'nope')).toEqual([]);
    const good = { slug: 'a', title: 'A', summary: 'S' };
    expect(aiRecipeList(() => [good, { slug: 1 }, null])).toEqual([good]);
  });
});

describe('LocalRecipesIndex', () => {
  it('empty content renders the empty state, one h1, and no list', () => {
    const html = render(<LocalRecipesIndex />, LOCAL_RECIPES_PATH);
    expect(count(html, '<h1')).toBe(1);
    expect(html).toContain('data-testid="recipes-title"');
    expect(html).not.toContain('data-testid="recipes-list"');
    expect(html).toContain('First recipe being written');
  });

  it('lists each recipe with its link, glance values and status, newest first', () => {
    H.store.recipes = [
      makeRecipe({ slug: 'newer', title: 'Newer recipe', date: '2026-10-24' }),
      makeRecipe({ slug: 'older', title: 'Older recipe', date: '2026-09-01', status: 'retired' }),
    ];
    const html = render(<LocalRecipesIndex />, LOCAL_RECIPES_PATH);
    expect(count(html, '<h1')).toBe(1);
    expect(html).toContain('href="/ai-engineering/local-recipes/newer"');
    expect(html).toContain('href="/ai-engineering/local-recipes/older"');
    expect(html.indexOf('Newer recipe')).toBeLessThan(html.indexOf('Older recipe'));
    expect(html).toContain('4 × GB10');
    expect(html).toContain('~61 ms');
    expect(html).toContain('In use');
    expect(html).toContain('Retired');
    /* Breadcrumb back to the hub. */
    expect(html).toContain('href="/ai-engineering"');
  });

  it('the subsection nav marks Local recipes as the current page', () => {
    const html = render(<LocalRecipesIndex />, LOCAL_RECIPES_PATH);
    const link = [...html.matchAll(/<a\b[^>]*data-testid="ai-subnav-local-recipes"[^>]*>/g)][0]?.[0] ?? '';
    expect(link).toContain('aria-current="page"');
  });
});

describe('RecipeDetailView', () => {
  it('unknown slug renders NotFound, never crashes', () => {
    const html = render(<RecipeDetailView slug="missing" />, `${LOCAL_RECIPES_PATH}/missing`);
    expect(html).toContain('data-testid="not-found"');
  });

  it('renders title, crumbs, meta, glance block and the build-time body', () => {
    H.store.recipes = [makeRecipe({ slug: 'one', title: 'One recipe' })];
    const html = render(<RecipeDetailView slug="one" />, `${LOCAL_RECIPES_PATH}/one`);
    expect(count(html, '<h1')).toBe(1);
    expect(html).toContain('One recipe');
    expect(html).toContain('href="/ai-engineering"');
    expect(html).toContain(`href="${LOCAL_RECIPES_PATH}"`);
    expect(html).toContain('dateTime="2026-10-24"');
    expect(html).toContain('18 min read');
    expect(html).toContain('At a glance');
    for (const value of ['4 × GB10', 'Some model, NVFP4', 'vLLM nightly', '~61 ms', '71 tok/s']) {
      expect(html, value).toContain(value);
    }
    expect(html).toContain('<h2 id="what-runs">What runs</h2>');
    expect(html).toContain('data-testid="recipe-back"');
  });
});

describe('AI hub', () => {
  it('shows the Local recipes block only when recipes exist', () => {
    expect(render(<AiEngineeringHub />, '/ai-engineering')).not.toContain('data-testid="ai-hub-recipes"');
    H.store.recipes = [makeRecipe({ slug: 'one', title: 'One recipe' })];
    const html = render(<AiEngineeringHub />, '/ai-engineering');
    expect(html).toContain('data-testid="ai-hub-recipes"');
    expect(html).toContain('href="/ai-engineering/local-recipes/one"');
    expect(html).toContain('data-testid="ai-hub-recipes-all"');
  });
});

/**
 * Unit tests for the Writing index + PostDetail pages.
 *
 * No jsdom (CONTRACT §0): behaviour that depends on real events (typing into
 * the search box, clicking a page link) is decomposed into PURE functions —
 * filterPosts / paginate / tagsFromPosts / neighboursByDate / shareUrl — and
 * tested directly; the SSR pass pins STRUCTURE (labels, aria wiring, link
 * hrefs, heading order) via renderToStaticMarkup. Real interaction is the
 * CDP e2e suite's job.
 *
 * `app/content` is mocked with a mutable in-memory store so the same file can
 * prove BOTH the empty-content resilience path (EmptyState, no crash) and the
 * fully-populated listing/detail markup against inline fixtures — without
 * touching src/content/generated/content.json.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterProvider, type RouteDefinition } from '@portfolio/router';
import { AppThemeProvider } from 'app/theme/ThemeProvider';
import type { Post } from 'app/content';

/* Mutable fixture store shared with the hoisted mock. */
const { store } = vi.hoisted(() => ({ store: { posts: [] as unknown[] } }));

vi.mock('app/content', () => ({
  /* R6-C: PostDetail also reads `content.projects` for the related-project
   * cross-link block — the fixture store carries an empty project list. */
  content: { projects: [] as unknown[] },
  getPost: (slug: string) =>
    store.posts.find((p) => (p as { slug: string }).slug === slug) as never,
  postsByDate: () =>
    [...store.posts].sort((a, b) =>
      (a as { date: string }).date < (b as { date: string }).date ? 1 : -1,
    ) as never,
}));

/* Imports AFTER the mock declaration (vi.mock is hoisted by vitest anyway —
 * the ordering is for the reader, the factory closes over `store`). */
const { Writing, filterPosts, paginate, tagsFromPosts, POSTS_PER_PAGE } = await import('./Writing');
const { PostDetail, neighboursByDate, shareUrl } = await import('./PostDetail');

/* -------------------------------------------------------------------------- */
/* Fixtures + render helpers (style copied from layout.test.tsx)               */
/* -------------------------------------------------------------------------- */

const makePost = (over: Partial<Post> & { slug: string; title: string }): Post => ({
  summary: `Summary of ${over.title}`,
  excerpt: `Excerpt of ${over.title}`,
  tags: [],
  date: '2026-01-01',
  readingMinutes: 5,
  html: `<p>Body of ${over.title}</p>`,
  ...over,
});

const FIXTURES: Post[] = [
  makePost({ slug: 'rag-scale', title: 'RAG at Scale', tags: ['llm', 'retrieval'], date: '2026-06-01', series: 'LLM Ops', readingMinutes: 12 }),
  makePost({ slug: 'duckdb-io', title: 'DuckDB for Disk IO', summary: 'Columnar scans beat row stores', tags: ['duckdb', 'perf'], date: '2026-05-02', readingMinutes: 8 }),
  makePost({ slug: 'cafe-ocr', title: 'Café OCR Pipeline', tags: ['vision'], date: '2026-04-03', readingMinutes: 4 }),
  makePost({ slug: 'llm-evals', title: 'LLM Evals That Stick', tags: ['llm', 'evals'], date: '2026-03-04', readingMinutes: 6 }),
  makePost({ slug: 'legacy-rust', title: 'Old Rust Services', tags: ['rust'], date: '2024-01-01', readingMinutes: 3 }),
];

const routes: RouteDefinition[] = [
  { path: '/writing', component: () => null },
  { path: '/writing/:slug', component: () => null },
];

/** Provider stack: AppThemeProvider → RouterProvider(initialPath) → page. */
function render(ui: ReactNode, path = '/writing'): string {
  return renderToStaticMarkup(
    createElement(
      AppThemeProvider,
      null,
      createElement(RouterProvider, { routes, initialPath: path }, ui),
    ),
  );
}

function testids(html: string): string[] {
  return [...html.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1] as string);
}

function tags(html: string, tag: string): string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => m[0]);
}

beforeEach(() => {
  store.posts = [...FIXTURES];
});

/* -------------------------------------------------------------------------- */
/* paginate — pure paging math                                                 */
/* -------------------------------------------------------------------------- */

describe('paginate', () => {
  const nums = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

  it('slices page 1..N with 1-based bounds', () => {
    const items = nums(20);
    const p1 = paginate(items, 1);
    expect(p1.items).toEqual(nums(8));
    expect(p1).toMatchObject({ page: 1, pageCount: 3, total: 20, firstIndex: 1, lastIndex: 8 });

    const p2 = paginate(items, 2);
    expect(p2.items).toEqual(nums(16).slice(8));
    expect(p2).toMatchObject({ firstIndex: 9, lastIndex: 16 });

    const p3 = paginate(items, 3);
    expect(p3.items).toEqual(nums(20).slice(16));
    expect(p3).toMatchObject({ firstIndex: 17, lastIndex: 20 });
  });

  it('clamps out-of-range pages instead of crashing', () => {
    expect(paginate(nums(20), 0).page).toBe(1);
    expect(paginate(nums(20), -5).page).toBe(1);
    expect(paginate(nums(20), 99).page).toBe(3);
    expect(paginate(nums(20), 99).items).toEqual(nums(20).slice(16));
  });

  it('the empty list still has one (empty) page', () => {
    const empty = paginate([], 7);
    expect(empty.items).toEqual([]);
    expect(empty).toMatchObject({ page: 1, pageCount: 1, total: 0, firstIndex: 0, lastIndex: 0 });
  });

  it('respects a custom perPage and floors fractional pages', () => {
    const p = paginate(nums(5), 2.7, 2);
    expect(p.items).toEqual([3, 4]);
    expect(p).toMatchObject({ page: 2, pageCount: 3 });
  });
});

/* -------------------------------------------------------------------------- */
/* filterPosts / tagsFromPosts — search wiring over fixtures                   */
/* -------------------------------------------------------------------------- */

describe('filterPosts', () => {
  it('empty query returns every post, newest first (same code path as search)', () => {
    expect(filterPosts(FIXTURES, '', undefined).map((p) => p.slug)).toEqual([
      'rag-scale',
      'duckdb-io',
      'cafe-ocr',
      'llm-evals',
      'legacy-rust',
    ]);
  });

  it('matches title case- and diacritic-insensitively', () => {
    expect(filterPosts(FIXTURES, 'CAFE').map((p) => p.slug)).toEqual(['cafe-ocr']);
    expect(filterPosts(FIXTURES, 'café').map((p) => p.slug)).toEqual(['cafe-ocr']);
  });

  it('matches summary text and tag names', () => {
    expect(filterPosts(FIXTURES, 'columnar').map((p) => p.slug)).toEqual(['duckdb-io']);
    expect(filterPosts(FIXTURES, 'rust').map((p) => p.slug)).toEqual(['legacy-rust']);
  });

  it('combines a tag filter with a query (AND semantics)', () => {
    const tagOnly = filterPosts(FIXTURES, '', 'llm').map((p) => p.slug);
    expect(tagOnly).toEqual(['rag-scale', 'llm-evals']);
    expect(filterPosts(FIXTURES, 'scale', 'llm').map((p) => p.slug)).toEqual(['rag-scale']);
    expect(filterPosts(FIXTURES, 'scale', 'rust')).toEqual([]);
  });

  it('a query nothing matches yields zero posts', () => {
    expect(filterPosts(FIXTURES, 'zzz-nothing-here')).toEqual([]);
  });
});

describe('tagsFromPosts', () => {
  it('count desc, then alphabetical', () => {
    expect(tagsFromPosts(FIXTURES)).toEqual([
      'llm',
      'duckdb',
      'evals',
      'perf',
      'retrieval',
      'rust',
      'vision',
    ]);
  });

  it('no posts → no tags', () => {
    expect(tagsFromPosts([])).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* neighboursByDate / shareUrl (PostDetail helpers)                            */
/* -------------------------------------------------------------------------- */

describe('neighboursByDate', () => {
  it('middle post gets both neighbours by date order', () => {
    const n = neighboursByDate(FIXTURES, 'cafe-ocr');
    expect(n.previous?.slug).toBe('duckdb-io'); /* newer */
    expect(n.next?.slug).toBe('llm-evals'); /* older */
  });

  it('newest has no newer neighbour; oldest has no older neighbour', () => {
    expect(neighboursByDate(FIXTURES, 'rag-scale').previous).toBeUndefined();
    expect(neighboursByDate(FIXTURES, 'rag-scale').next?.slug).toBe('duckdb-io');
    expect(neighboursByDate(FIXTURES, 'legacy-rust').next).toBeUndefined();
    expect(neighboursByDate(FIXTURES, 'legacy-rust').previous?.slug).toBe('llm-evals');
  });

  it('unknown slug and single-post lists degrade to no navigation', () => {
    expect(neighboursByDate(FIXTURES, 'nope')).toEqual({ previous: undefined, next: undefined });
    const one = neighboursByDate([FIXTURES[0] as Post], 'rag-scale');
    expect(one.previous).toBeUndefined();
    expect(one.next).toBeUndefined();
  });
});

describe('shareUrl', () => {
  it('joins origin and slug, collapsing a trailing slash', () => {
    expect(shareUrl('https://example.com', 'x')).toBe('https://example.com/writing/x');
    expect(shareUrl('https://example.com/', 'x')).toBe('https://example.com/writing/x');
    expect(shareUrl('https://example.com///', 'x')).toBe('https://example.com/writing/x');
  });
});

/* -------------------------------------------------------------------------- */
/* Writing — SSR structure                                                     */
/* -------------------------------------------------------------------------- */

describe('Writing (SSR)', () => {
  it('empty content renders h1 + EmptyState without crashing', () => {
    store.posts = [];
    const html = render(<Writing />);
    expect(html).toContain('data-testid="writing-page"');
    expect(tags(html, 'h1')).toHaveLength(1);
    expect(html).toContain('>Writing</h1>');
    expect(html).toContain('data-testid="empty-state"');
    expect(html).toContain('No posts yet');
    expect(html).not.toContain('data-testid="pagination"');
  });

  it('search is a labelled form control, never placeholder-only', () => {
    const html = render(<Writing />);
    expect(html).toContain('role="search"');
    expect(html).toContain('<label');
    expect(html).toContain('for="post-search"');
    expect(html).toContain('Search posts by title, tag, or summary');
    const input = tags(html, 'input').find((t) => t.includes('id="post-search"'));
    expect(input).toContain('type="search"');
  });

  it('lists newest-first with at most 8 posts and links each title', () => {
    store.posts = Array.from({ length: 9 }, (_, i) =>
      makePost({ slug: `post-${i}`, title: `Post ${i}`, date: `2026-0${9 - (i % 9)}-1${i % 9}` }),
    );
    const html = render(<Writing />);
    const links = testids(html).filter((id) => id.startsWith('post-link-'));
    expect(links).toHaveLength(POSTS_PER_PAGE);
    expect(links[0]).toBe('post-link-post-0');
    expect(links).not.toContain('post-link-post-8'); /* page 2 material */
    expect(html).toContain('data-testid="pagination"');
    expect(html).toContain('href="/writing?page=2"');
  });

  it('below the page threshold, no pagination is rendered', () => {
    const html = render(<Writing />); /* 5 fixtures < 8 */
    expect(testids(html).filter((id) => id.startsWith('post-link-'))).toHaveLength(5);
    expect(html).not.toContain('data-testid="pagination"');
  });

  it('tag chips are aria-pressed toggles in a labelled group', () => {
    const html = render(<Writing />);
    expect(html).toContain('aria-label="Filter posts by tag"');
    const all = tags(html, 'button').find((t) => t.includes('tag-chip-all'));
    expect(all).toContain('aria-pressed="true"');
    expect(all).toContain('type="button"');
    const llm = tags(html, 'button').find((t) => t.includes('tag-chip-llm'));
    expect(llm).toContain('aria-pressed="false"');
  });

  it('result count is a polite live region', () => {
    const html = render(<Writing />);
    const status = tags(html, 'p').find((t) => t.includes('role="status"'));
    expect(status).toBeDefined();
    expect(html).toContain('Showing all 5 posts');
  });
});

/* -------------------------------------------------------------------------- */
/* PostDetail — SSR structure                                                  */
/* -------------------------------------------------------------------------- */

describe('PostDetail (SSR)', () => {
  it('unknown slug renders NotFound, never a crash or empty article', () => {
    const html = render(<PostDetail />, '/writing/not-a-real-post');
    expect(html).not.toContain('data-testid="post-article"');
    expect(html).not.toContain('data-testid="post-prose"');
    expect(html).not.toBe('');
  });

  it('renders back link, h1, meta row, and the build-validated HTML in Prose', () => {
    const html = render(<PostDetail />, '/writing/rag-scale');
    const back = tags(html, 'a').find((t) => t.includes('back-to-writing'));
    expect(back).toContain('href="/writing"');
    expect(tags(html, 'h1')).toHaveLength(1);
    expect(html).toContain('>RAG at Scale</h1>');
    expect(html).toContain('<time');
    expect(html).toContain('dateTime="2026-06-01"');
    expect(html).toContain('June 1, 2026');
    expect(html).toContain('12 min read');
    expect(html).toContain('data-testid="series-badge"');
    expect(html).toContain('LLM Ops');
    const prose = tags(html, 'div').find((t) => t.includes('data-prose'));
    expect(prose).toBeDefined();
    /* the injected body sits INSIDE the Prose wrapper */
    const bodyStart = html.indexOf('Body of RAG at Scale');
    const proseStart = html.indexOf('data-prose');
    expect(bodyStart).toBeGreaterThan(proseStart);
  });

  it('prev/next navigate by date order with real hrefs', () => {
    const html = render(<PostDetail />, '/writing/cafe-ocr');
    expect(html).toContain('aria-label="Post navigation"');
    const prev = tags(html, 'a').find((t) => t.includes('prev-post'));
    const next = tags(html, 'a').find((t) => t.includes('next-post'));
    expect(prev).toContain('href="/writing/duckdb-io"'); /* newer */
    expect(next).toContain('href="/writing/llm-evals"'); /* older */
  });

  it('newest post renders no previous link; oldest renders no next link', () => {
    const newest = render(<PostDetail />, '/writing/rag-scale');
    expect(newest).not.toContain('prev-post');
    expect(newest).toContain('next-post');
    const oldest = render(<PostDetail />, '/writing/legacy-rust');
    expect(oldest).not.toContain('next-post');
    expect(oldest).toContain('prev-post');
  });

  it('a lone post renders no post navigation at all', () => {
    store.posts = [FIXTURES[0] as Post];
    const html = render(<PostDetail />, '/writing/rag-scale');
    expect(html).not.toContain('data-testid="post-nav"');
  });

  it('copy-link is a labelled button with a live-region status', () => {
    const html = render(<PostDetail />, '/writing/rag-scale');
    const copy = tags(html, 'button').find((t) => t.includes('copy-link'));
    expect(copy).toContain('type="button"');
    expect(copy).toContain('aria-label="Copy link to this post"');
    expect(html).toContain('data-testid="share-status"');
    expect(html).toContain('role="status"');
  });

  it('no transient $ props leak into the DOM on either page', () => {
    expect(render(<Writing />)).not.toContain('$active');
    const detail = render(<PostDetail />, '/writing/rag-scale');
    expect(detail).not.toContain('$align');
  });
});

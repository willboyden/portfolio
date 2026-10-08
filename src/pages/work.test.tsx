/**
 * Unit tests for the work pages (Projects / ProjectDetail / Videos / Talks).
 *
 * ENVIRONMENT (CONTRACT §0): no jsdom — `environment: 'node'`, so pages are
 * rendered with react-dom/server and asserted as HTML strings. The provider
 * stack mirrors what App mounts: AppThemeProvider over RouterProvider pinned
 * with `initialPath` (the layout.test.tsx pattern).
 *
 * DATA: src/content/generated/content.json is EMPTY and owned by the content
 * pipeline — we must NOT touch it. Two-layer strategy:
 *   1. Empty-resilience: the live empty content.json is the fixture — every
 *      page must render an EmptyState + correct headings, never crash.
 *   2. Populated states: 'app/content' is intercepted with vi.mock behind a
 *      live store the tests fill with INLINE fixtures, so pages render fully
 *      (cards, hero markdown, groups, external anchors) without the pipeline
 *      file changing. Pure helpers (`visibleProjects`, `relatedProjects`,
 *      `splitByDate`, …) are additionally unit-tested directly.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterProvider, type RouteDefinition } from '@portfolio/router';
import { AppThemeProvider } from 'app/theme/ThemeProvider';
import type { Project, SiteContent, Talk, Video } from 'app/content';

/* Fixtures + live store must exist before the vi.mock factory is hoisted. */
const H = vi.hoisted(() => {
  const store = {
    projects: [] as unknown[],
    posts: [] as unknown[],
    videos: [] as unknown[],
    talks: [] as unknown[],
  };
  return { store };
});

vi.mock('app/content', () => ({
  content: H.store,
  getProject: (slug: string) =>
    (H.store.projects as { slug: string }[]).find((p) => p.slug === slug),
}));

/* Import pages AFTER the mock so they bind the intercepted module. */
import {
  Projects,
  ProjectCard,
  projectTagCounts,
  statusTone,
  visibleProjects,
} from './Projects';
import { ProjectDetail, projectLinkEntries, relatedProjects } from './ProjectDetail';
import { Videos, VideoRowItem, providerLabel, splitByDate, todayUtcIso } from './Videos';
import { Talks, talkResourceEntries, talksByDate } from './Talks';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const routes: RouteDefinition[] = [
  { path: '/', component: () => null },
  { path: '/projects', component: () => null },
  { path: '/projects/:slug', component: () => null },
  { path: '/videos', component: () => null },
  { path: '/talks', component: () => null },
  { path: '*', component: () => null },
];

/** Same provider shape the real app mounts, pinned to a test path. */
function render(ui: ReactNode, initialPath = '/'): string {
  return renderToStaticMarkup(
    createElement(
      AppThemeProvider,
      null,
      createElement(RouterProvider, { routes, initialPath }, ui),
    ),
  );
}

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/** Every http(s) anchor in the markup. */
function externalAnchors(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/g)].map((m) => m[0]);
}

/* Inline fixtures (content.json is never written — mocked store instead). */

const PROJECT_A: Project = {
  slug: 'alpha',
  title: 'Alpha',
  summary: 'First project.',
  tags: ['python', 'duckdb'],
  date: '2026-03-01',
  role: 'Lead engineer',
  status: 'shipped',
  period: '2025–2026',
  highlights: ['Shipped to 40k users'],
  stack: ['Python', 'DuckDB'],
  links: { source: 'https://example.com/alpha', demo: 'https://alpha.example.dev' },
  metrics: [{ label: 'p95', value: '12ms' }],
  featured: true,
  html: '<h2 id="overview">Overview</h2><p>Alpha body.</p>',
};

const PROJECT_B: Project = {
  ...PROJECT_A,
  slug: 'beta',
  title: 'Beta',
  summary: 'Second project.',
  tags: ['python', 'react'],
  date: '2025-01-15',
  status: 'active',
  links: { paper: 'https://example.com/beta.pdf' },
  metrics: [],
  featured: false,
  html: undefined,
};

const PROJECT_C: Project = {
  ...PROJECT_A,
  slug: 'gamma',
  title: 'Gamma',
  summary: 'Third project.',
  tags: ['rust'],
  date: '2024-06-01',
  status: 'archived',
  links: {},
  metrics: undefined,
  featured: false,
  html: undefined,
};

const VIDEO_FUTURE: Video = {
  slug: 'vid-future',
  title: 'Tomorrow key',
  summary: 'A premiere.',
  tags: [],
  date: '2099-01-01',
  url: 'https://www.youtube.com/watch?v=future',
  provider: 'youtube',
  duration: '42:11',
  event: 'FutureCon',
};

const VIDEO_PAST: Video = {
  slug: 'vid-past',
  title: 'Yesterday key',
  summary: 'A recording.',
  tags: [],
  date: '2020-01-01',
  url: 'https://vimeo.com/1',
  provider: 'vimeo',
  duration: '1:02:03',
  speakers: ['A. Rivera'],
  event: 'PastCon',
};

const VIDEO_OTHER: Video = {
  ...VIDEO_PAST,
  slug: 'vid-other',
  title: 'Podcast spot',
  url: 'https://example.com/clip',
  provider: 'other',
};

const TALK_1: Talk = {
  slug: 'talk-1',
  title: 'Fast engines',
  summary: 'Short blurb.',
  tags: ['duckdb'],
  date: '2026-05-04',
  event: 'PyData',
  location: 'Remote',
  slidesUrl: 'https://example.com/slides',
  videoUrl: 'https://example.com/talk-video',
  abstract: 'What we learned about columnar engines.',
};

const TALK_2: Talk = {
  ...TALK_1,
  slug: 'talk-2',
  title: 'Older talk',
  date: '2023-02-02',
  slidesUrl: undefined,
  videoUrl: undefined,
};

/** Load a snapshot into the mocked store for one test. */
function setContent(sections: Partial<SiteContent>): void {
  H.store.projects = sections.projects ?? [];
  H.store.posts = sections.posts ?? [];
  H.store.videos = sections.videos ?? [];
  H.store.talks = sections.talks ?? [];
}

afterEach(() => setContent({}));

/* -------------------------------------------------------------------------- */
/* Empty-content rendering                                                     */
/* -------------------------------------------------------------------------- */

describe('work pages with empty content', () => {
  it('Projects renders its h1 and an EmptyState without crashing', () => {
    setContent({});
    const html = render(<Projects />, '/projects');
    expect(html).toContain('Selected work');
    expect(html).toContain('data-testid="empty-state"');
    expect(countOccurrences(html, '<h1')).toBe(1);
    /* No filter chips when there is nothing to filter. */
    expect(html).not.toContain('data-testid="tag-filter"');
  });

  it('Videos renders its h1 and an EmptyState without crashing', () => {
    setContent({});
    const html = render(<Videos />, '/videos');
    expect(html).toContain('Videos');
    expect(html).toContain('data-testid="empty-state"');
    expect(countOccurrences(html, '<h1')).toBe(1);
  });

  it('Talks renders its h1 and an EmptyState without crashing', () => {
    setContent({});
    const html = render(<Talks />, '/talks');
    expect(html).toContain('Talks');
    expect(html).toContain('data-testid="empty-state"');
    expect(countOccurrences(html, '<h1')).toBe(1);
  });

  it('ProjectDetail with an unknown slug falls back to NotFound', () => {
    setContent({ projects: [PROJECT_A] });
    /* Route pinned so useParams() resolves a slug that getProject misses. */
    const html = render(<ProjectDetail />, '/projects/does-not-exist');
    expect(html).toContain('data-testid="not-found"');
    expect(countOccurrences(html, '<h1')).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Populated rendering (mocked store) + external-link hygiene                  */
/* -------------------------------------------------------------------------- */

describe('Projects populated', () => {
  it('renders tag chips, cards with status badge + metrics, internal links', () => {
    setContent({ projects: [PROJECT_A, PROJECT_B, PROJECT_C] });
    const html = render(<Projects />, '/projects');
    expect(html).toContain('data-testid="tag-filter"');
    expect(html).toContain('python');
    expect(html).toContain('data-testid="projects-grid"');
    expect(countOccurrences(html, 'data-testid="project-card"')).toBe(3);
    expect(html).toContain('href="/projects/alpha"');
    expect(html).toContain('shipped');
    expect(html).toContain('data-testid="project-metrics"'); /* from A only */
    expect(countOccurrences(html, 'data-testid="project-metrics"')).toBe(1);
    /* Card links are internal — no external anchor should exist here. */
    expect(externalAnchors(html)).toEqual([]);
    /* Filter chips are real toggle buttons with aria-pressed. */
    expect(countOccurrences(html, 'aria-pressed=')).toBeGreaterThanOrEqual(4);
  });

  it('ProjectCard renders every status tone + a title link', () => {
    const html = render(<ProjectCard project={PROJECT_C} />, '/projects');
    expect(html).toContain('archived');
    expect(html).toContain('href="/projects/gamma"');
    /* metrics: undefined → strip absent */
    expect(html).not.toContain('data-testid="project-metrics"');
  });
});

describe('ProjectDetail populated', () => {
  it('renders hero, stack tags, links, highlights, body html, related grid', () => {
    setContent({ projects: [PROJECT_A, PROJECT_B, PROJECT_C] });
    const html = render(<ProjectDetail />, '/projects/alpha');
    expect(html).toContain('data-testid="project-detail"');
    expect(html).toContain('Alpha');
    expect(html).toContain('Lead engineer');
    expect(countOccurrences(html, '<h1')).toBe(1);
    expect(html).toContain('Overview'); /* dangerouslySetInnerHTML landed */
    expect(html).toContain('data-testid="detail-highlights"');
    expect(html).toContain('data-testid="related-grid"');
    expect(html).toContain('href="/projects/beta"'); /* gamma has 0 overlap */
    expect(html).not.toContain('href="/projects/gamma"');
  });

  it('every external link carries rel="noopener noreferrer" + target=_blank', () => {
    setContent({ projects: [PROJECT_A, PROJECT_B] });
    const html = render(<ProjectDetail />, '/projects/alpha');
    const anchors = externalAnchors(html);
    expect(anchors.length).toBeGreaterThanOrEqual(2); /* source + demo */
    for (const anchor of anchors) {
      expect(anchor).toContain('rel="noopener noreferrer"');
      expect(anchor).toContain('target="_blank"');
    }
  });
});

describe('Videos populated', () => {
  it('groups upcoming vs past and links out honestly', () => {
    setContent({ videos: [VIDEO_PAST, VIDEO_FUTURE, VIDEO_OTHER] });
    const html = render(<Videos />, '/videos');
    expect(html).toContain('data-testid="videos-upcoming"');
    expect(html).toContain('data-testid="videos-past"');
    expect(html).toContain('Tomorrow key');
    expect(html).toContain('YouTube');
    expect(html).toContain('Vimeo');
    expect(html).toContain('Other');
    const anchors = externalAnchors(html);
    expect(anchors.length).toBe(3);
    for (const anchor of anchors) {
      expect(anchor).toContain('rel="noopener noreferrer"');
      expect(anchor).toContain('target="_blank"');
    }
    /* No fake embed players: zero iframes, zero video elements. */
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<video');
  });

  it('VideoRowItem shows provider, duration, date and event', () => {
    const html = render(<VideoRowItem video={VIDEO_PAST} />, '/videos');
    expect(html).toContain('data-testid="video-provider"');
    expect(html).toContain('data-testid="video-duration"');
    expect(html).toContain('1:02:03');
    expect(html).toContain('PastCon');
    expect(html).toContain('Jan 1, 2020');
  });
});

describe('Talks populated', () => {
  it('renders native disclosures with slides/video links', () => {
    setContent({ talks: [TALK_1, TALK_2] });
    const html = render(<Talks />, '/talks');
    expect(html).toContain('data-testid="talk-card"');
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('PyData');
    expect(html).toContain('dateTime="2026-05-04"'); /* React SSR attr casing */
    expect(html).toContain('What we learned about columnar engines.');
    expect(html).toContain('data-testid="talk-slides-link"');
    expect(html).toContain('data-testid="talk-video-link"');
    const anchors = externalAnchors(html);
    expect(anchors.length).toBe(2); /* only TALK_1 has resources */
    for (const anchor of anchors) {
      expect(anchor).toContain('rel="noopener noreferrer"');
      expect(anchor).toContain('target="_blank"');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                                */
/* -------------------------------------------------------------------------- */

describe('Projects helpers', () => {
  it('visibleProjects(null) returns everything newest-first', () => {
    const out = visibleProjects([PROJECT_B, PROJECT_A, PROJECT_C], null).map((p) => p.slug);
    expect(out).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('visibleProjects filters by tag', () => {
    const out = visibleProjects([PROJECT_A, PROJECT_B, PROJECT_C], 'python').map((p) => p.slug);
    expect(out).toEqual(['alpha', 'beta']);
    expect(visibleProjects([PROJECT_A, PROJECT_B, PROJECT_C], 'rust')).toEqual([PROJECT_C]);
    expect(visibleProjects([PROJECT_A], 'nope')).toEqual([]);
  });

  it('projectTagCounts counts project tags, count desc then alpha', () => {
    expect(projectTagCounts([PROJECT_A, PROJECT_B, PROJECT_C])).toEqual([
      { tag: 'python', count: 2 },
      { tag: 'duckdb', count: 1 },
      { tag: 'react', count: 1 },
      { tag: 'rust', count: 1 },
    ]);
    expect(projectTagCounts([])).toEqual([]);
  });

  it('statusTone maps every status to a Tag tone', () => {
    expect(statusTone('shipped')).toBe('accent');
    expect(statusTone('active')).toBe('default');
    expect(statusTone('archived')).toBe('outline');
  });
});

describe('ProjectDetail helpers', () => {
  it('relatedProjects ranks by tag overlap, excludes self and zero-overlap', () => {
    expect(relatedProjects([PROJECT_A, PROJECT_B, PROJECT_C], PROJECT_A).map((p) => p.slug)).toEqual(
      ['beta'],
    );
    expect(relatedProjects([PROJECT_A], PROJECT_A)).toEqual([]);
  });

  it('relatedProjects respects the limit', () => {
    const many = [PROJECT_A, PROJECT_B, { ...PROJECT_C, slug: 'delta', tags: ['python'] }];
    expect(relatedProjects(many, PROJECT_A, 1).map((p) => p.slug)).toEqual(['beta']);
  });

  it('projectLinkEntries keeps only present links, in order', () => {
    expect(projectLinkEntries(PROJECT_A.links)).toEqual([
      { kind: 'source', url: 'https://example.com/alpha' },
      { kind: 'demo', url: 'https://alpha.example.dev' },
    ]);
    expect(projectLinkEntries(PROJECT_B.links)).toEqual([
      { kind: 'paper', url: 'https://example.com/beta.pdf' },
    ]);
    expect(projectLinkEntries({})).toEqual([]);
  });
});

describe('Videos helpers', () => {
  const all = [VIDEO_PAST, VIDEO_FUTURE, VIDEO_OTHER];

  it('splitByDate buckets around the pinned today (inclusive)', () => {
    const { upcoming, past } = splitByDate(all, '2025-06-01');
    expect(upcoming.map((v) => v.slug)).toEqual(['vid-future']);
    expect(past.map((v) => v.slug)).toEqual(['vid-other', 'vid-past']);
  });

  it('splitByDate puts same-day videos in upcoming', () => {
    const { upcoming, past } = splitByDate([VIDEO_PAST], '2020-01-01');
    expect(upcoming.map((v) => v.slug)).toEqual(['vid-past']);
    expect(past).toEqual([]);
  });

  it('splitByDate keeps newest-first order inside both buckets', () => {
    /* 2000-01-01 ⇒ everything is upcoming: 2099 first, then the two 2020
     * videos ordered by title ("Podcast spot" < "Yesterday key"). */
    const { upcoming, past } = splitByDate(all, '2000-01-01');
    expect(upcoming.map((v) => v.slug)).toEqual(['vid-future', 'vid-other', 'vid-past']);
    expect(past).toEqual([]);
  });

  it('providerLabel covers all three providers', () => {
    expect(providerLabel('youtube')).toBe('YouTube');
    expect(providerLabel('vimeo')).toBe('Vimeo');
    expect(providerLabel('other')).toBe('Other');
  });

  it('todayUtcIso is a YYYY-MM-DD string (and exact for a pinned Date)', () => {
    expect(todayUtcIso(new Date(Date.UTC(2026, 9, 8)))).toBe('2026-10-08');
    expect(todayUtcIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Talks helpers', () => {
  it('talksByDate sorts newest first', () => {
    expect(talksByDate([TALK_2, TALK_1]).map((t) => t.slug)).toEqual(['talk-1', 'talk-2']);
  });

  it('talkResourceEntries includes slides/video only when present', () => {
    expect(talkResourceEntries(TALK_1)).toEqual([
      { kind: 'slides', url: 'https://example.com/slides' },
      { kind: 'video', url: 'https://example.com/talk-video' },
    ]);
    expect(talkResourceEntries(TALK_2)).toEqual([]);
  });
});

/**
 * Unit tests for the AI Engineering pages (hub + three subsections).
 *
 * ENVIRONMENT (CONTRACT §0): no jsdom — pages render with
 * react-dom/server and are asserted as HTML strings, plus the vendored
 * Emotion sheet (__sheetCss()) for the token/44px-touch-target
 * assertions. Real interaction is the CDP e2e suite's job.
 *
 * DATA: 'app/content' is mocked with a live in-memory store (the
 * work.test.tsx / writing.test.tsx pattern) so the pages render against
 * populated capability fixtures WITHOUT touching the integrator's content
 * module. The store also proves the guarded-access design: with the
 * capability API absent (store emptied), the hub renders its EmptyState and
 * an unknown slug renders NotFound — never a crash.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterProvider, type RouteDefinition } from '@portfolio/router';
import { AppThemeProvider } from 'app/theme/ThemeProvider';
import { __sheetCss } from '@emotion-mini/core';
import type { AiCapability } from './AiEngineering';

/* Hoisted store — the mock factory below closes over this. */
const H = vi.hoisted(() => {
  const store = {
    capabilities: [] as unknown[],
    posts: [] as unknown[],
    /** Records seen through the mocked getAiCapability (its "hits"). */
    fetched: [] as string[],
  };
  return { store };
});

vi.mock('app/content', () => ({
  /* getPost is what RelatedWriting resolves. */
  getPost: (slug: string) =>
    (H.store.posts as { slug: string }[]).find((p) => p.slug === slug),
  postsByDate: () => H.store.posts as unknown[],
  content: { projects: [], posts: [], videos: [], talks: [] },
  /* Planned AI-capability API: a function-backed implementation so the
   * pages' preferred path (getAiCapability) is exercised. */
  getAiCapability: (slug: string) => {
    H.store.fetched.push(slug);
    return (H.store.capabilities as { slug: string }[]).find((c) => c.slug === slug);
  },
  aiCapabilitiesBySlug: () => H.store.capabilities as unknown[],
}));

/* Import pages AFTER the mock so they bind the intercepted module. */
const { AiEngineeringHub, AiCapabilityDetail, aiCapabilityList, aiCapabilityBySlug, splitProof, capabilityStatusTone, isCapability, aiSections } =
  await import('./AiEngineering');
const { LocalInference } = await import('./ai-engineering/LocalInference');
const { VideoGeneration } = await import('./ai-engineering/VideoGeneration');
const { SmartRouting } = await import('./ai-engineering/SmartRouting');

/* -------------------------------------------------------------------------- */
/* Fixtures + render helpers (work.test.tsx pattern)                           */
/* -------------------------------------------------------------------------- */

const makeCapability = (over: Partial<AiCapability> & { slug: string; title: string }): AiCapability => ({
  capability: over.title,
  oneLiner: `One-liner for ${over.title}.`,
  stack: ['Python', 'vLLM'],
  howItWorks: ['Pick the model.', 'Serve it.', 'Measure it.'],
  proof: [
    'Serves concurrent requests at 40 tok/s — deployments/inference/README.md',
    'Cold start under 3s — deployments/inference/serve.py',
  ],
  limits: ['Needs 24 GB VRAM for the 8B model.', 'No multi-tenant isolation yet.'],
  status: 'shipped',
  ...over,
});

const CAP_LOCAL = makeCapability({
  slug: 'local-inference',
  title: 'Local inference',
  status: 'shipped',
  relatedPosts: ['rag-scale', 'missing-post'],
});

const CAP_VIDEO = makeCapability({
  slug: 'video-generation',
  title: 'Video generation',
  status: 'in-progress',
  stack: ['Diffusion', 'CUDA'],
  relatedPosts: [],
});

const CAP_ROUTING = makeCapability({
  slug: 'smart-routing',
  title: 'Smart routing',
  status: 'offered',
  howItWorks: [], /* exercises the in-progress write-up branch */
  proof: [],
  limits: [],
});

const POST_FIXTURE = {
  slug: 'rag-scale',
  title: 'RAG at Scale',
  date: '2026-06-01',
  readingMinutes: 12,
};

/** Load the mocked store for one test. */
function setCapabilities(list: unknown[]): void {
  H.store.capabilities = list;
  H.store.posts = [POST_FIXTURE] as unknown[];
}

beforeEach(() => {
  setCapabilities([CAP_LOCAL, CAP_VIDEO, CAP_ROUTING]);
});

afterEach(() => {
  setCapabilities([]);
});

const routes: RouteDefinition[] = [
  { path: '/ai-engineering', component: () => null },
  { path: '/ai-engineering/:slug', component: () => null },
];

/** Provider stack: AppThemeProvider → RouterProvider(initialPath) → page. */
function render(ui: ReactNode, path = '/ai-engineering'): string {
  return renderToStaticMarkup(
    createElement(AppThemeProvider, null, createElement(RouterProvider, { routes, initialPath: path }, ui)),
  );
}

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

function tags(html: string, tag: string): string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => m[0]);
}

/* Template-literal styles flatten as `prop: value`, object styles as
 * `prop:value` — match either way (ui.test.tsx hasDecl pattern). */
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasDecl = (sheet: string, decl: string): void => {
  const idx = decl.indexOf(': ');
  const prop = idx === -1 ? decl : decl.slice(0, idx);
  const value = idx === -1 ? '' : decl.slice(idx + 2);
  expect(sheet).toMatch(new RegExp(`${escapeRe(prop)}:\\s*${escapeRe(value)}`));
};

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                                 */
/* -------------------------------------------------------------------------- */

describe('ai capability helpers', () => {
  it('aiCapabilityList passes function- and record-shaped stores through the guard', () => {
    expect(aiCapabilityList().map((c) => c.slug)).toEqual(['local-inference', 'video-generation', 'smart-routing']);
    const asRecord = Object.fromEntries([CAP_LOCAL, CAP_VIDEO].map((c) => [c.slug, c]));
    expect(aiCapabilityList(asRecord).map((c) => c.slug)).toEqual(['local-inference', 'video-generation']);
    /* `undefined` means "use the live store default" (the function path);
     * only an explicit non-function, non-object value yields nothing. */
    expect(aiCapabilityList(null)).toEqual([]);
    /* Garbage entries are filtered, not rendered. */
    expect(aiCapabilityList([{ nope: true }, CAP_LOCAL]).map((c) => c.slug)).toEqual(['local-inference']);
  });

  it('aiCapabilityBySlug prefers getAiCapability and falls back to the list scan', () => {
    expect(aiCapabilityBySlug('video-generation')?.slug).toBe('video-generation');
    expect(aiCapabilityBySlug('nope')).toBeUndefined();
    expect(aiCapabilityBySlug('local-inference', undefined)?.slug).toBe('local-inference');
  });

  it('isCapability rejects non-objects and incomplete records', () => {
    expect(isCapability(CAP_LOCAL)).toBe(true);
    expect(isCapability(null)).toBe(false);
    expect(isCapability('x')).toBe(false);
    expect(isCapability({ slug: 'x' })).toBe(false);
  });

  it('capabilityStatusTone maps all three statuses to Tag tones', () => {
    expect(capabilityStatusTone('shipped')).toBe('accent');
    expect(capabilityStatusTone('in-progress')).toBe('default');
    expect(capabilityStatusTone('offered')).toBe('outline');
  });

  it('splitProof separates claim from repo path on the LAST em dash', () => {
    expect(splitProof('Fast — src/a.py')).toEqual({ claim: 'Fast', repoPath: 'src/a.py' });
    expect(splitProof('Fast — very — src/a.py')).toEqual({ claim: 'Fast — very', repoPath: 'src/a.py' });
    expect(splitProof('Just a claim')).toEqual({ claim: 'Just a claim', repoPath: undefined });
    /* The path text survives verbatim — anti-fabrication. */
    const { claim, repoPath } = splitProof(CAP_LOCAL.proof[0] as string);
    expect(`${claim} — ${repoPath}`).toBe(CAP_LOCAL.proof[0]);
  });

  it('aiSections follows the capability list (content order), so no page is unreachable', () => {
    expect(aiSections().map((s) => s.slug)).toEqual(['local-inference', 'video-generation', 'smart-routing']);
    expect(aiSections()[0]?.label).toBe(CAP_LOCAL.capability);
  });
});

/* -------------------------------------------------------------------------- */
/* Hub — SSR structure                                                          */
/* -------------------------------------------------------------------------- */

describe('AiEngineeringHub (SSR)', () => {
  it('renders one h1, the subsection nav, and three capability cards', () => {
    const html = render(<AiEngineeringHub />);
    expect(html).toContain('data-testid="ai-hub"');
    expect(countOccurrences(html, '<h1')).toBe(1);
    expect(html).toContain('>AI engineering</h1>');
    for (const slug of ['local-inference', 'video-generation', 'smart-routing']) {
      expect(html).toContain(`href="/ai-engineering/${slug}"`);
      expect(html).toContain(`data-testid="ai-capability-link-${slug}"`);
    }
    expect(countOccurrences(html, 'data-testid="ai-capability-card"')).toBe(3);
  });

  it('cards carry status tag, one-liner, and stack chips', () => {
    const html = render(<AiEngineeringHub />);
    expect(countOccurrences(html, 'data-testid="ai-capability-status"')).toBe(3);
    expect(html).toContain('One-liner for Local inference.');
    expect(countOccurrences(html, 'data-testid="ai-stack"')).toBe(3);
    expect(html).toContain('vLLM');
  });

  it('nav marks exactly the current subsection with aria-current="page"', () => {
    const hub = render(<AiEngineeringHub />, '/ai-engineering');
    expect(countOccurrences(hub, 'aria-current="page"')).toBe(0);
    const local = render(<AiEngineeringHub />, '/ai-engineering/local-inference');
    const navLinks = tags(local, 'a').filter((t) => t.includes('ai-subnav-'));
    const current = navLinks.filter((t) => t.includes('aria-current="page"'));
    expect(current).toHaveLength(1);
    expect(current[0]).toContain('data-testid="ai-subnav-local-inference"');
  });

  it('status tags render all three statuses as content states them', () => {
    const html = render(<AiEngineeringHub />);
    expect(html).toContain('shipped');
    expect(html).toContain('in-progress');
    expect(html).toContain('offered');
  });

  it('with the capability API absent, the hub renders its EmptyState, never a crash', () => {
    setCapabilities([]);
    const html = render(<AiEngineeringHub />);
    expect(html).toContain('data-testid="ai-hub"');
    expect(countOccurrences(html, '<h1')).toBe(1);
    expect(html).toContain('data-testid="empty-state"');
    expect(countOccurrences(html, 'data-testid="ai-capability-card"')).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Detail template — SSR structure (via the three route shims)                  */
/* -------------------------------------------------------------------------- */

describe('AiCapabilityDetail (SSR, via shims)', () => {
  it('LocalInference renders hero, ordered how-it-works, proof grid, limits, CTA', () => {
    const html = render(<LocalInference />, '/ai-engineering/local-inference');
    expect(html).toContain('data-testid="ai-capability-detail"');
    expect(countOccurrences(html, '<h1')).toBe(1);
    expect(html).toContain('>Local inference</h1>');
    expect(html).toContain('data-testid="ai-detail-crumb"');
    expect(html).toContain('href="/ai-engineering"');

    const steps = html.match(/<ol\b[^>]*data-testid="ai-how-it-works"[\s\S]*?<\/ol>/)?.[0] ?? '';
    expect(steps).toContain('<li');
    expect(steps).toContain('Pick the model.');

    expect(html).toContain('data-testid="ai-proof-grid"');
    expect(html).toContain('data-testid="ai-proof-path"');
    expect(html).toContain('deployments/inference/README.md'); /* mono path, verbatim */
    expect(html).toContain('data-testid="ai-limits"');
    expect(html).toContain('No multi-tenant isolation yet.');
    expect(html).toContain('data-testid="ai-contact-cta"');
    expect(tags(html, 'a').find((t) => t.includes('ai-contact-cta'))).toContain('href="/contact"');
  });

  it('proof renders claims and repo paths exactly as content states them', () => {
    const html = render(<LocalInference />, '/ai-engineering/local-inference');
    expect(html).toContain('Serves concurrent requests at 40 tok/s');
    /* The claim keeps its dash; the path is split into the mono code node. */
    expect(html).toContain('Serves concurrent requests at 40 tok/s</span>');
    expect(html).toContain('<code');
  });

  it('VideoGeneration renders its own content with in-progress status', () => {
    const html = render(<VideoGeneration />, '/ai-engineering/video-generation');
    expect(html).toContain('>Video generation</h1>');
    expect(html).toContain('in-progress');
    expect(html).toContain('Diffusion');
    expect(countOccurrences(html, 'data-testid="ai-capability-card"')).toBe(0);
  });

  it('SmartRouting renders the empty-write-up states when content is sparse', () => {
    const html = render(<SmartRouting />, '/ai-engineering/smart-routing');
    expect(html).toContain('>Smart routing</h1>');
    expect(html).toContain('data-testid="empty-state"'); /* write-up in progress */
    /* Empty proof/limits render the honest EmptyStates — never fabricated
     * placeholders, never a bare bordered band. */
    expect(html).toContain('Proof points still being collected');
    expect(html).toContain('Limits under review');
    expect(countOccurrences(html, 'data-testid="ai-proof-item"')).toBe(0);
  });

  it('related writing resolves through getPost and skips unknown slugs', () => {
    const html = render(<LocalInference />, '/ai-engineering/local-inference');
    expect(html).toContain('Related writing');
    expect(html).toContain('data-testid="ai-related-post"');
    expect(html).toContain('href="/writing/rag-scale"');
    expect(html).toContain('RAG at Scale');
    expect(html).not.toContain('/writing/missing-post'); /* unknown slug skipped */
    /* CAP_VIDEO has relatedPosts: [] → no block at all. */
    const video = render(<VideoGeneration />, '/ai-engineering/video-generation');
    expect(video).not.toContain('Related writing');
  });

  it('unknown slug renders NotFound, never a crash or empty article', () => {
    const html = render(<AiCapabilityDetail slug="not-a-capability" />, '/ai-engineering/not-a-capability');
    expect(html).toContain('data-testid="not-found"');
    expect(html).not.toContain('data-testid="ai-capability-detail"');
    expect(countOccurrences(html, '<h1')).toBe(1);
  });

  it('each page renders exactly one h1 with overflow-wrap anywhere in its style', () => {
    for (const [ui, path] of [
      [<AiEngineeringHub />, '/ai-engineering'],
      [<LocalInference />, '/ai-engineering/local-inference'],
      [<VideoGeneration />, '/ai-engineering/video-generation'],
      [<SmartRouting />, '/ai-engineering/smart-routing'],
    ] as const) {
      const html = render(ui, path);
      expect(countOccurrences(html, '<h1')).toBe(1);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Style / a11y invariants (vendored Emotion sheet)                             */
/* -------------------------------------------------------------------------- */

describe('style invariants (emotion sheet)', () => {
  it('44px touch targets are generated at ≤md for card links and subnav', () => {
    render(<AiEngineeringHub />);
    const sheet = __sheetCss();
    expect(sheet).toContain('@media (max-width: 768px)');
    hasDecl(sheet, 'min-height: 44px');
  });

  it('detail CTA carries the ≥44px min-height token sum', () => {
    render(<AiCapabilityDetail slug="local-inference" />);
    const sheet = __sheetCss();
    /* Button 'md' recipe: space6 (2rem) + space4 (1rem) = 3rem = 48px. */
    hasDecl(sheet, 'min-height: calc(2rem + 1rem)');
  });

  it('subnav active state uses whole-declaration classes (no empty declarations)', () => {
    render(<AiEngineeringHub />, '/ai-engineering/local-inference');
    const sheet = __sheetCss();
    expect(sheet).toContain('rgba(91, 140, 255, 0.14)'); /* accentSoft fill */
  });

  it('no transient $ props leak into the rendered DOM on any page', () => {
    const pages = [
      render(<AiEngineeringHub />),
      render(<LocalInference />, '/ai-engineering/local-inference'),
      render(<VideoGeneration />, '/ai-engineering/video-generation'),
      render(<SmartRouting />, '/ai-engineering/smart-routing'),
    ];
    for (const html of pages) {
      expect(html).not.toContain('$');
      expect(html).not.toMatch(/\$[a-z]+=/);
    }
  });
});

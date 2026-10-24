/**
 * Tests for the content pipeline: the generated bundle (scripts/build-content.mjs
 * output), the zod schemas, and the src/content access API.
 *
 * Run AFTER `node scripts/build-content.mjs` — this suite treats
 * generated/content.json as a build artifact to be validated, and will fail
 * loudly if it is stale or malformed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import raw from './generated/content.json';
import {
  ProjectSchema,
  PostBodySchema,
  PostSchema,
  PostSourceSchema,
  VideoSchema,
  TalkSchema,
  SiteContentSchema,
} from './schema';
import {
  allTags,
  content,
  featuredProjects,
  getPost,
  getProject,
  postsByDate,
} from './index';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A post's rendered body, from the file the build wrote beside the bundle. */
function postBody(slug: string): string {
  const file = new URL(`../../public/post-bodies/${slug}.json`, import.meta.url);
  return PostBodySchema.parse(JSON.parse(readFileSync(file, 'utf8'))).html;
}

describe('generated bundle shape', () => {
  it('satisfies SiteContentSchema (contentHash + 4 typed collections)', () => {
    const parsed = SiteContentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        'generated/content.json invalid:\n' +
          parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
      );
    }
    expect(parsed.data.posts.length).toBeGreaterThanOrEqual(3);
    expect(parsed.data.projects.length).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(parsed.data.videos)).toBe(true);
    expect(Array.isArray(parsed.data.talks)).toBe(true);
  });

  it('has unique slugs within every collection', () => {
    for (const kind of ['projects', 'posts', 'videos', 'talks'] as const) {
      const items = content[kind] as { slug: string }[];
      const slugs = items.map((i) => i.slug);
      expect(new Set(slugs).size, kind).toBe(slugs.length);
    }
  });

  it('every date matches YYYY-MM-DD', () => {
    const all = [...content.projects, ...content.posts, ...content.videos, ...content.talks];
    expect(all.length).toBeGreaterThan(0);
    for (const item of all) expect(item.date, item.slug).toMatch(DATE_RE);
  });

  it('renders non-empty HTML bodies for every post', () => {
    const withHtml = content.posts.filter((p) => postBody(p.slug).length > 0);
    expect(withHtml.length).toBeGreaterThanOrEqual(3);
    for (const p of content.posts) {
      expect(postBody(p.slug), p.slug).toContain('<p>');
      expect(p.excerpt.length, p.slug).toBeGreaterThan(0);
      expect(p.excerpt.length, p.slug).toBeLessThanOrEqual(141); // 140 + ellipsis char
      expect(Number.isInteger(p.readingMinutes), p.slug).toBe(true);
      expect(p.readingMinutes, p.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it('post html never contains raw unescaped script tags', () => {
    for (const p of content.posts) {
      expect(postBody(p.slug)).not.toMatch(/<script/i);
      expect(postBody(p.slug)).not.toMatch(/href="javascript:/i);
    }
  });

  it('projects sort date-descending', () => {
    const dates = content.projects.map((p) => p.date);
    const sorted = [...dates].sort((a, b) => (a < b ? 1 : -1));
    expect(dates).toEqual(sorted);
  });
});

describe('schema behaviour (contract §4)', () => {
  const base = {
    slug: 'demo-slug',
    title: 'Demo',
    summary: 's',
    tags: ['x'],
    date: '2026-01-01',
  };

  it('ProjectSchema requires the type-specific fields', () => {
    expect(ProjectSchema.safeParse(base).success).toBe(false); // missing role/status/...
    const ok = ProjectSchema.safeParse({
      ...base,
      role: 'r',
      status: 'shipped',
      period: '2026',
      highlights: ['h'],
      stack: ['s'],
      links: { source: 'https://e.io' },
      featured: false,
    });
    expect(ok.success).toBe(true);
  });

  it('rejects bad dates, bad status, and unknown keys (.strict)', () => {
    const project = {
      ...base,
      role: 'r',
      status: 'shipped',
      period: '2026',
      highlights: ['h'],
      stack: ['s'],
      links: {},
      featured: false,
    };
    expect(ProjectSchema.safeParse({ ...project, date: '2026-1-1' }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...project, date: '2026-01-01T00:00' }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...project, status: 'wip' }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...project, bogus: 1 }).success).toBe(false);
  });

  it('PostSchema requires bodyHash + excerpt + positive readingMinutes, and no body', () => {
    expect(PostSchema.safeParse(base).success).toBe(false);
    const post = { ...base, bodyHash: '0123456789ab', excerpt: 'e', readingMinutes: 2, series: 's' };
    expect(PostSchema.safeParse(post).success).toBe(true);
    expect(PostSchema.safeParse({ ...post, readingMinutes: 0 }).success).toBe(false);
    expect(PostSchema.safeParse({ ...post, bodyHash: 'ABCDEF012345' }).success).toBe(false);
    /* The body lives in public/post-bodies/<slug>.json, never in the bundle. */
    expect(PostSchema.safeParse({ ...post, html: '<p>x</p>' }).success).toBe(false);
  });

  it('PostSourceSchema (the build input) carries the body instead of its hash', () => {
    const source = { ...base, html: '<p>x</p>', excerpt: 'e', readingMinutes: 2 };
    expect(PostSourceSchema.safeParse(source).success).toBe(true);
    expect(PostSourceSchema.safeParse({ ...source, html: '' }).success).toBe(false);
    expect(PostSourceSchema.safeParse({ ...source, bodyHash: '0123456789ab' }).success).toBe(false);
  });

  it('VideoSchema constrains provider; TalkSchema requires event/location/abstract', () => {
    expect(
      VideoSchema.safeParse({ ...base, url: 'https://youtu.be/x', provider: 'tiktok', duration: '5:00' })
        .success,
    ).toBe(false);
    expect(
      VideoSchema.safeParse({ ...base, url: 'https://youtube.com/watch?v=x', provider: 'youtube', duration: '5:00' })
        .success,
    ).toBe(true);
    expect(TalkSchema.safeParse(base).success).toBe(false);
    expect(
      TalkSchema.safeParse({ ...base, event: 'e', location: 'l', abstract: 'a' }).success,
    ).toBe(true);
  });
});

describe('content API (contract §4)', () => {
  it('getProject / getPost find by slug and return undefined otherwise', () => {
    expect(content.projects.length).toBeGreaterThan(0);
    const p = content.projects[0]!;
    expect(getProject(p.slug)).toBe(p);
    expect(getProject('no-such-project')).toBeUndefined();
    const post = content.posts[0]!;
    expect(getPost(post.slug)).toBe(post);
    expect(getPost('no-such-post')).toBeUndefined();
  });

  it('postsByDate returns newest first without mutating content.posts', () => {
    const ordered = postsByDate();
    expect(ordered.length).toBe(content.posts.length);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i - 1]!.date >= ordered[i]!.date, ordered[i]!.slug).toBe(true);
    }
    const maxDate = [...content.posts].map((p) => p.date).sort().at(-1)!;
    expect(ordered[0]!.date).toBe(maxDate);
  });

  it('featuredProjects is non-empty and only contains featured entries', () => {
    const feat = featuredProjects();
    expect(feat.length).toBeGreaterThanOrEqual(1);
    for (const p of feat) expect(p.featured).toBe(true);
    expect(feat.length).toBe(content.projects.filter((p) => p.featured).length);
  });

  it('allTags is sorted count-desc then alphabetical, counts are consistent', () => {
    const tags = allTags();
    expect(tags.length).toBeGreaterThan(0);
    for (let i = 1; i < tags.length; i++) {
      const prev = tags[i - 1]!;
      const cur = tags[i]!;
      const ok =
        prev.count > cur.count ||
        (prev.count === cur.count && prev.tag.localeCompare(cur.tag) <= 0);
      expect(ok, `${prev.tag} before ${cur.tag}`).toBe(true);
    }
    const total = tags.reduce((s, t) => s + t.count, 0);
    const manual = [...content.projects, ...content.posts, ...content.videos, ...content.talks].reduce(
      (s, i) => s + i.tags.length,
      0,
    );
    expect(total).toBe(manual);
  });
});

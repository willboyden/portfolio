/**
 * Unit tests for src/lib/seo.ts — environment: 'node'. Pure string logic;
 * nothing here touches document (applyDocumentMeta is client-only and guarded).
 */

import { describe, expect, it } from 'vitest';
import {
  SITE,
  absoluteUrl,
  buildHead,
  escapeHtml,
  joinUrl,
  pageMeta,
} from 'app/lib/seo';

describe('SITE constants', () => {
  it('pinned values', () => {
    expect(SITE.url).toBe('https://alexrivera.dev');
    expect(SITE.lang).toBe('en');
    expect(SITE.name.length).toBeGreaterThan(0);
    expect(SITE.author.length).toBeGreaterThan(0);
    expect(typeof SITE.twitter).toBe('string');
  });
});

describe('escapeHtml', () => {
  it('escapes the dangerous five', () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    );
  });
  it('is idempotent-safe on already-benign text', () => {
    expect(escapeHtml('Plain Title — No HTML')).toBe('Plain Title — No HTML');
  });
});

describe('joinUrl', () => {
  it('never emits a double slash (scheme aside)', () => {
    expect(joinUrl('https://a.dev/', '/writing/', '/mine/')).toBe('https://a.dev/writing/mine');
    expect(joinUrl('https://a.dev', 'writing')).toBe('https://a.dev/writing');
    expect(joinUrl('https://a.dev///', '///x')).toBe('https://a.dev/x');
    expect(joinUrl('https://a.dev')).toBe('https://a.dev/');
  });
  it('absoluteUrl passes absolute URLs through', () => {
    expect(absoluteUrl('https://cdn.example/img.png')).toBe('https://cdn.example/img.png');
    expect(absoluteUrl('/x')).toBe('https://alexrivera.dev/x');
  });
});

describe('pageMeta — home page', () => {
  const home = pageMeta({ title: '', description: '', path: '/' });

  it('falls back to SITE title/description when empty', () => {
    expect(home.titlePlain).toBe(SITE.title);
    expect(home.description).toBe(SITE.description);
    expect(home.canonical).toBe('https://alexrivera.dev/');
  });

  it('JSON-LD is a Person on the home page', () => {
    expect(home.jsonLd['@type']).toBe('Person');
    expect(home.jsonLd.name).toBe(SITE.author);
  });

  it('robots defaults to index,follow', () => {
    expect(home.robots).toBe('index,follow');
  });
});

describe('pageMeta — post (article)', () => {
  const post = pageMeta({
    title: 'RAG at Scale',
    description: 'Notes from production retrieval pipelines.',
    path: '/writing/rag-at-scale/',
    type: 'article',
    publishedTime: '2026-05-01',
    image: '/og/rag.png',
  });

  it('normalizes path + canonical with no double slashes', () => {
    expect(post.path).toBe('/writing/rag-at-scale');
    expect(post.canonical).toBe('https://alexrivera.dev/writing/rag-at-scale');
    expect(post.canonical).not.toMatch(/[^:]\/\//);
  });

  it('Article JSON-LD carries headline, author, datePublished', () => {
    expect(post.jsonLd['@type']).toBe('Article');
    expect(post.jsonLd.headline).toBe('RAG at Scale');
    expect(post.jsonLd.datePublished).toBe('2026-05-01');
    const author = post.jsonLd.author as { name: string };
    expect(author.name).toBe(SITE.author);
  });

  it('indexes default to CollectionPage', () => {
    const index = pageMeta({ title: 'Writing', description: 'All posts.', path: '/writing' });
    expect(index.jsonLd['@type']).toBe('CollectionPage');
  });

  it('image flips twitter card to summary_large_image', () => {
    expect(post.twitterCard).toBe('summary_large_image');
    expect(post.image).toBe('https://alexrivera.dev/og/rag.png');
  });
});

describe('pageMeta — caps and honesty', () => {
  it('caps the composed title at 60 chars, keeping the brand suffix', () => {
    const meta = pageMeta({
      title: 'An Extremely Long Post Title That Just Keeps Going And Going Well Past Sixty',
      description: 'd',
      path: '/writing/long',
    });
    expect(meta.titlePlain.length).toBeLessThanOrEqual(60);
    expect(meta.titlePlain.endsWith(` — ${SITE.name}`)).toBe(true);
    expect(meta.titlePlain).toContain('…');
  });

  it('caps description at 160 with ellipsis ONLY when it cut', () => {
    const short = pageMeta({ title: 'x', description: 'Short one.', path: '/x' });
    expect(short.description).toBe('Short one.');
    const longDesc = 'Lorem ipsum dolor sit amet '.repeat(20).trim();
    const meta = pageMeta({ title: 'x', description: longDesc, path: '/x' });
    expect(meta.description.length).toBeLessThanOrEqual(160);
    expect(meta.description.endsWith('…')).toBe(true);
    expect(longDesc.startsWith(meta.description.slice(0, -1).trim())).toBe(true);
  });

  it('escapes a hostile title containing <script> and a quote', () => {
    const meta = pageMeta({
      title: `Bad <script>alert("pwn")</script> title`,
      description: 'desc',
      path: '/writing/bad',
    });
    expect(meta.title).not.toContain('<script>');
    expect(meta.title).toContain('&lt;script&gt;');
    expect(meta.title).toContain('&quot;');
    expect(meta.titlePlain).toContain('<script>'); /* plain keeps raw text */
  });

  it('robots override (noindex for drafts)', () => {
    const meta = pageMeta({
      title: 'Draft',
      description: 'd',
      path: '/writing/draft',
      robots: ['noindex', 'nofollow'],
    });
    expect(meta.robots).toBe('noindex,nofollow');
  });
});

describe('buildHead', () => {
  const post = pageMeta({
    title: 'RAG at Scale',
    description: 'Production retrieval notes.',
    path: '/writing/rag',
    type: 'article',
    publishedTime: '2026-05-01',
  });
  const tags = buildHead(post);
  const firstTagged = (prefix: string): number => tags.findIndex((t) => t.startsWith(prefix));

  it('is ordered: title → description → canonical → RSS → robots → OG → twitter → JSON-LD', () => {
    const order = [
      firstTagged('<title>'),
      firstTagged('<meta name="description"'),
      firstTagged('<link rel="canonical"'),
      firstTagged('<link rel="alternate"'),
      firstTagged('<meta name="robots"'),
      firstTagged('<meta property="og:site_name"'),
      firstTagged('<meta name="twitter:card"'),
      firstTagged('<script type="application/ld+json">'),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(tags[0]).toMatch(/^<title>/);
    expect(tags[tags.length - 1]).toMatch(/^<script type="application\/ld\+json">/);
  });

  it('all hrefs/content values are quoted and escaped; hostile title neutralized', () => {
    const hostile = buildHead(
      pageMeta({ title: `X <script>y("z")</script>`, description: 'a"b', path: '/p' }),
    ).join('\n');
    expect(hostile).not.toContain('<script>y');
    expect(hostile).toContain('&lt;script&gt;y');
  });

  it('JSON-LD tag content JSON.parses (with < escaped as \\u003c)', () => {
    const ld = tags[tags.length - 1] ?? '';
    const json = ld.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(json).not.toContain('</script>');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('Article');
  });

  it('no double-slash URLs anywhere in the head markup', () => {
    for (const tag of tags) {
      const urls = [...tag.matchAll(/"(https?:\/\/[^"]*)"/g)].map((m) => m[1] ?? '');
      expect(urls.length).toBeGreaterThanOrEqual(0);
      for (const u of urls) {
        expect(u.slice(u.indexOf('//') + 2)).not.toContain('//');
      }
    }
    /* Explicit: the canonical tag itself. */
    const canonical = tags.find((t) => t.includes('rel="canonical"')) ?? '';
    expect(canonical).toContain('href="https://alexrivera.dev/writing/rag"');
  });

  it('article pages include article:published_time; website pages do not', () => {
    expect(tags.some((t) => t.includes('article:published_time'))).toBe(true);
    const site = buildHead(pageMeta({ title: 'About', description: 'd', path: '/about' }));
    expect(site.some((t) => t.includes('article:published_time'))).toBe(false);
  });
});

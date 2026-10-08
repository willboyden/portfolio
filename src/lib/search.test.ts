/**
 * Unit tests for src/lib/search.ts — determinism, diacritics, filters.
 */

import { describe, expect, it } from 'vitest';
import { byDateDesc, escapeRegExp, normalizeText, search, tokenize } from 'app/lib/search';
import type { SearchableRecord } from 'app/lib/search';

const R = (over: Partial<SearchableRecord> & { slug: string }): SearchableRecord => ({
  title: '',
  date: '2026-01-01',
  ...over,
});

const RECORDS: SearchableRecord[] = [
  R({ slug: 'rag-scale', title: 'RAG at Scale', summary: 'Retrieval pipelines in production', tags: ['llm', 'retrieval'], date: '2026-06-01' }),
  R({ slug: 'duckdb-io', title: 'DuckDB for Disk IO', summary: 'Columnar scans beat row stores', tags: ['duckdb', 'perf'], date: '2026-05-02' }),
  R({ slug: 'cafe-ocr', title: 'Café OCR Pipeline', summary: 'OCR for menu cards at a café', tags: ['vision'], date: '2026-04-03' }),
  R({ slug: 'llm-eval', title: 'LLM Evals That Stick', summary: 'Regression suites for prompts', tags: ['llm', 'evals'], date: '2026-03-04' }),
  R({ slug: 'legacy', title: 'Old Rust Services', summary: 'Notes on retiring a monolith', tags: ['rust'], date: '2024-01-01' }),
];

describe('escapeRegExp', () => {
  it('escapes metacharacters but leaves plain words alone', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
    expect(escapeRegExp('[link](x)?$')).toBe('\\[link\\]\\(x\\)\\?\\$');
    expect(escapeRegExp('plain')).toBe('plain');
    /* The escaped output matches the literal text, not the pattern. */
    expect('cost 10$'.match(new RegExp(escapeRegExp('10$')))).not.toBeNull();
  });
});

describe('normalizeText / tokenize', () => {
  it('strips diacritics, lowercases, collapses whitespace', () => {
    expect(normalizeText('  Café   RÉSUMÉ ')).toBe('cafe resume');
    expect(normalizeText('ALREADY normal')).toBe('already normal');
  });
  it('tokenize drops punctuation and empties', () => {
    expect(tokenize('Hello, world! (2026)')).toEqual(['hello', 'world', '2026']);
    expect(tokenize('!!!')).toEqual([]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('search — empty query', () => {
  it('returns everything newest-first with zero scores', () => {
    const hits = search('', RECORDS);
    expect(hits.map((h) => h.record.slug)).toEqual([
      'rag-scale',
      'duckdb-io',
      'cafe-ocr',
      'llm-eval',
      'legacy',
    ]);
    expect(hits.every((h) => h.score === 0 && h.matchedFields.length === 0)).toBe(true);
  });
  it('whitespace-only behaves as empty', () => {
    expect(search('   ', RECORDS).length).toBe(RECORDS.length);
  });
});

describe('search — ranking', () => {
  it('title exact-word beats summary substring', () => {
    const hits = search('retrieval', RECORDS);
    expect(hits[0]?.record.slug).toBe('rag-scale'); /* summary field */
    const titleHits = search('duckdb', RECORDS);
    expect(titleHits[0]?.matchedFields[0]).toBe('title');
  });

  it('phrase bonus puts the full-query record on top', () => {
    const hits = search('llm evals', RECORDS);
    expect(hits[0]?.record.slug).toBe('llm-eval');
    expect(hits[0]?.score).toBeGreaterThan(hits[1]?.score ?? 0);
  });

  it('matchedFields lists contributing fields, best first', () => {
    const hit = search('retrieval pipelines', RECORDS).find((h) => h.record.slug === 'rag-scale');
    expect(hit?.matchedFields).toContain('summary');
  });

  it('no match → empty result', () => {
    expect(search('zzzz-nothing', RECORDS)).toEqual([]);
  });

  it('deterministic: same result under shuffled input order', () => {
    const forward = search('llm', RECORDS).map((h) => `${h.record.slug}:${h.score}`);
    const shuffled = search('llm', [...RECORDS].reverse()).map((h) => `${h.record.slug}:${h.score}`);
    expect(shuffled).toEqual(forward);
  });

  it('limit caps output', () => {
    expect(search('', RECORDS, { limit: 2 }).length).toBe(2);
  });
});

describe('search — diacritics', () => {
  it('ascii query finds accented records', () => {
    expect(search('cafe', RECORDS)[0]?.record.slug).toBe('cafe-ocr');
  });
  it('accented query finds ascii-folded fields', () => {
    expect(search('Café', RECORDS)[0]?.record.slug).toBe('cafe-ocr');
  });
});

describe('search — filters', () => {
  it('tag filter is AND-combined and diacritic/case-insensitive', () => {
    const hits = search('', RECORDS, { filters: { tags: ['LLM'] } });
    expect(hits.map((h) => h.record.slug).sort()).toEqual(['llm-eval', 'rag-scale']);
    const both = search('', RECORDS, { filters: { tags: ['llm', 'evals'] } });
    expect(both.map((h) => h.record.slug)).toEqual(['llm-eval']);
  });
  it('date window is inclusive and excludes undated records', () => {
    const hits = search('', RECORDS, { filters: { dateFrom: '2026-04-03', dateTo: '2026-05-02' } });
    expect(hits.map((h) => h.record.slug)).toEqual(['duckdb-io', 'cafe-ocr']);
    const withUndated = search('', [...RECORDS, R({ slug: 'nodate', title: 'x', date: undefined })], {
      filters: { dateFrom: '2000-01-01' },
    });
    expect(withUndated.some((h) => h.record.slug === 'nodate')).toBe(false);
  });
  it('filters apply to keyword queries too', () => {
    const hits = search('llm', RECORDS, { filters: { tags: ['evals'] } });
    expect(hits.map((h) => h.record.slug)).toEqual(['llm-eval']);
  });
  it('filter + empty query keeps the newest-first contract', () => {
    const hits = search(' ', RECORDS, { filters: { tags: ['llm'] } });
    expect(hits.map((h) => h.record.slug)).toEqual(['rag-scale', 'llm-eval']);
  });
});

describe('byDateDesc', () => {
  it('newest first, undated last, slug-stable ties', () => {
    const sorted = [
      R({ slug: 'b', date: '2026-01-02' }),
      R({ slug: 'a', date: undefined }),
      R({ slug: 'c', date: '2026-01-02' }),
    ].sort(byDateDesc);
    expect(sorted.map((r) => r.slug)).toEqual(['b', 'c', 'a']);
  });
});

describe('search — extra fields + weights', () => {
  it('extraFields participate and weight tags over summary', () => {
    const recs = [
      R({ slug: 'x', title: 'X', summary: 'react stuff', tags: ['go'] }),
      R({ slug: 'y', title: 'Y', summary: 'go stuff', tags: [] }),
    ];
    const hits = search('go', recs, { weights: { tags: 100, summary: 1 } });
    expect(hits[0]?.record.slug).toBe('x');
    expect(hits[0]?.matchedFields).toEqual(['tags']);
  });
});

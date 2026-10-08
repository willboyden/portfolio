/**
 * Small deterministic client-side search for the writing + projects indexes.
 *
 * Design constraints (CONTRACT §0: no packages, prerendered static site):
 * - O(n) per query over the record set, one pass, no index rebuild per call.
 *   Records are re-normalized per query; n is tens of entries, so an upfront
 *   inverted index would be more machinery than the problem deserves. If the
 *   corpus ever grows past ~5k records, memoize `indexRecords()` output.
 * - Deterministic ranking: score is pure arithmetic over normalized strings;
 *   ties break by date (newest), then by input order (stable). Same input →
 *   same output on every machine, so prerender and client agree.
 * - Diacritic-insensitive: everything is NFD-normalized and combining marks
 *   are stripped ("Café" matches "cafe", and vice versa).
 */

import { parseIsoUtc } from './format';

export interface SearchableRecord {
  slug: string;
  title: string;
  summary?: string;
  tags?: readonly string[];
  date?: string;
  [extra: string]: unknown;
}

export interface SearchHit<T extends SearchableRecord = SearchableRecord> {
  record: T;
  score: number;
  /** Fields that contributed to the score, best first. */
  matchedFields: string[];
}

export interface SearchFilters {
  /** Record must carry ALL of these tags (normalized comparison). */
  tags?: readonly string[];
  /** Inclusive ISO date bounds, `YYYY-MM-DD`. */
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchOptions<T extends SearchableRecord> {
  /** Max hits; default 50. */
  limit?: number;
  /** Field weights; title dominates by default. */
  weights?: Partial<Record<'title' | 'summary' | 'tags', number>>;
  filters?: SearchFilters;
  /** Extra text fields beyond title/summary/tags, e.g. {stack: 'react, rust'}. */
  extraFields?: (record: T) => Record<string, string>;
}

const DEFAULT_WEIGHTS = { title: 8, summary: 3, tags: 5, extra: 2 } as const;

/** Escape user text for literal use inside a RegExp. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lowercase + strip diacritics + collapse whitespace. Idempotent. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split normalized text into word tokens (punctuation dropped). */
export function tokenize(text: string): string[] {
  const norm = normalizeText(text);
  return norm
    .length === 0
    ? []
    : norm.split(' ').flatMap((word) => word.split(/[^\p{L}\p{N}]+/u)).filter(Boolean);
}

/**
 * Score one haystack against the query terms:
 * +3 per term that appears as a whole token (exact word),
 * +2 per term that is a prefix of a token,
 * +1 per term that merely occurs as a substring,
 * with an extra +4 bonus when the whole normalized query occurs in the field
 * (a phrase match). Score is multiplied by the field weight.
 */
function scoreField(queryTerms: string[], fullQuery: string, haystack: string, weight: number): number {
  if (haystack.length === 0 || queryTerms.length === 0) return 0;
  const tokens = haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokenSet = new Set(tokens);
  let raw = 0;
  for (const term of queryTerms) {
    if (tokenSet.has(term)) raw += 3;
    else if (tokens.some((t) => t.startsWith(term))) raw += 2;
    else if (haystack.includes(term)) raw += 1;
  }
  if (queryTerms.length > 1 && haystack.includes(fullQuery)) raw += 4;
  /* Zero matched terms contributes nothing regardless of weight. */
  return raw === 0 ? 0 : raw * weight;
}

/** True when the record passes filters (tags ⊇ filter, date within bounds). */
function passesFilters(record: SearchableRecord, filters: SearchFilters | undefined): boolean {
  if (!filters) return true;
  if (filters.tags && filters.tags.length > 0) {
    const recordTags = new Set((record.tags ?? []).map(normalizeText));
    for (const tag of filters.tags) {
      if (!recordTags.has(normalizeText(tag))) return false;
    }
  }
  if (filters.dateFrom || filters.dateTo) {
    const when = record.date ? parseIsoUtc(record.date) : null;
    if (!when) return false; /* filtered queries exclude undated records */
    if (filters.dateFrom) {
      const from = parseIsoUtc(filters.dateFrom);
      if (from && when < from) return false;
    }
    if (filters.dateTo) {
      const to = parseIsoUtc(filters.dateTo);
      if (to && when > to) return false;
    }
  }
  return true;
}

/** Newest-first comparator on ISO dates; undated sorts last, then slug (stable). */
export function byDateDesc(a: SearchableRecord, b: SearchableRecord): number {
  const ta = a.date ? (parseIsoUtc(a.date)?.getTime() ?? 0) : 0;
  const tb = b.date ? (parseIsoUtc(b.date)?.getTime() ?? 0) : 0;
  if (tb !== ta) return tb - ta;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * Search `records` for `query`.
 *
 * - Empty/whitespace query → ALL records (filters still apply), newest-first,
 *   each with `score: 0` and `matchedFields: []`. The index pages use this as
 *   their default listing so the list and the search share one code path.
 * - Non-empty query → records with score > 0, ranked by score desc, then
 *   date desc, then slug. Deterministic on every platform.
 */
export function search<T extends SearchableRecord>(
  query: string,
  records: readonly T[],
  options: SearchOptions<T> = {},
): SearchHit<T>[] {
  const { limit = 50, weights = {}, filters, extraFields } = options;
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const kept = records.filter((r) => passesFilters(r, filters));

  const normQuery = normalizeText(query);
  if (normQuery.length === 0) {
    return [...kept]
      .sort(byDateDesc)
      .slice(0, Math.max(0, limit))
      .map((record) => ({ record, score: 0, matchedFields: [] as string[] }));
  }

  const terms = tokenize(normQuery);
  const hits: SearchHit<T>[] = [];
  for (const record of kept) {
    const fields: Array<[field: string, text: string, weight: number]> = [
      ['title', normalizeText(record.title), w.title],
      ['summary', normalizeText(record.summary ?? ''), w.summary],
      ['tags', (record.tags ?? []).map(normalizeText).join(' '), w.tags],
    ];
    if (extraFields) {
      for (const [name, text] of Object.entries(extraFields(record))) {
        fields.push([name, normalizeText(text), w.extra]);
      }
    }
    let score = 0;
    const matchedFields: string[] = [];
    for (const [name, text, weight] of fields) {
      const fieldScore = scoreField(terms, normQuery, text, weight);
      if (fieldScore > 0) {
        score += fieldScore;
        matchedFields.push(name);
      }
    }
    if (score > 0) hits.push({ record, score, matchedFields });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const dateCmp = byDateDesc(a.record, b.record);
    if (dateCmp !== 0) return dateCmp;
    return a.record.slug < b.record.slug ? -1 : a.record.slug > b.record.slug ? 1 : 0;
  });
  return hits.slice(0, Math.max(0, limit));
}

/**
 * Unit tests for src/lib/format.ts — environment: 'node'.
 *
 * The load-bearing guarantee: the site is prerendered on a UTC build machine
 * and hydrated in readers' browsers, so date strings must be byte-identical
 * regardless of the process timezone. These tests flip process.env.TZ and
 * assert exact strings (plus a probe proving the TZ switch is actually live).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateRange,
  formatDuration,
  formatReadingTime,
  initials,
  parseIsoUtc,
  pluralize,
  slugify,
  truncateAtWordBoundary,
} from 'app/lib/format';

const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'UTC';
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('formatDate — timezone stability', () => {
  const zones = ['UTC', 'Asia/Kolkata', 'Pacific/Kiritimati', 'America/New_York'];

  it('process.env.TZ switching is actually live in this Node (probe)', () => {
    const offsets = new Set<number>();
    for (const tz of zones) {
      process.env.TZ = tz;
      offsets.add(new Date('2026-06-01T12:00:00').getTimezoneOffset());
    }
    /* If this ever fails, Node stopped honouring mid-process TZ changes and
     * the stability test below is vacuous — that must be loud, not silent. */
    expect(offsets.size).toBeGreaterThan(1);
  });

  it('returns the SAME exact strings under every timezone', () => {
    for (const tz of zones) {
      process.env.TZ = tz;
      expect(formatDate('2026-03-14')).toBe('Mar 14, 2026');
      expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
      expect(formatDate('2025-12-31')).toBe('Dec 31, 2025');
      expect(formatDate('2026-03-14', { style: 'long' })).toBe('March 14, 2026');
    }
  });

  it('handles ISO datetimes, offsets, and time suffix', () => {
    /* 23:30 on the 13th at UTC-08:00 is 07:30 on the 14th UTC. */
    expect(formatDate('2026-03-13T23:30:00-08:00')).toBe('Mar 14, 2026');
    expect(formatDate('2026-03-14T07:30:00Z', { withTime: true })).toBe('Mar 14, 2026 07:30 UTC');
  });

  it('returns empty strings (not "Invalid Date") for garbage', () => {
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDate('2026-13-01')).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('14/03/2026')).toBe('');
  });
});

describe('parseIsoUtc', () => {
  it('parses bare dates as UTC midnight, not local', () => {
    process.env.TZ = 'America/New_York';
    const d = parseIsoUtc('2026-03-14');
    expect(d).not.toBeNull();
    expect(d!.getTime()).toBe(Date.UTC(2026, 2, 14));
  });
  it('rejects non-ISO input', () => {
    expect(parseIsoUtc('March 14, 2026')).toBeNull();
    expect(parseIsoUtc(42 as unknown as string)).toBeNull();
  });
});

describe('formatDateRange', () => {
  it('condenses same-day, same-year, and cross-year ranges', () => {
    expect(formatDateRange('2026-03-14', '2026-03-14')).toBe('Mar 14, 2026');
    expect(formatDateRange('2026-03-14', '2026-04-02')).toBe('Mar 14 – Apr 2, 2026');
    expect(formatDateRange('2026-03-01', '2026-03-09')).toBe('Mar 1 – 9, 2026');
    expect(formatDateRange('2025-12-30', '2026-01-02')).toBe('Dec 30, 2025 – Jan 2, 2026');
  });
  it('open-ended ranges read as prose', () => {
    expect(formatDateRange('2026-03-14')).toBe('Since Mar 14, 2026');
    expect(formatDateRange(undefined, '2026-03-14')).toBe('Until Mar 14, 2026');
    expect(formatDateRange()).toBe('');
    expect(formatDateRange('junk', 'junk')).toBe('');
  });
});

describe('formatReadingTime / formatDuration / pluralize', () => {
  it('reading time', () => {
    expect(formatReadingTime(5)).toBe('5 min read');
    expect(formatReadingTime(0.4)).toBe('1 min read');
    expect(formatReadingTime(-3)).toBe('1 min read');
    expect(formatReadingTime(NaN)).toBe('1 min read');
    expect(formatReadingTime(12.6)).toBe('13 min read');
  });
  it('duration m:ss / h:mm:ss', () => {
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(599)).toBe('9:59');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Infinity)).toBe('0:00');
  });
  it('pluralize', () => {
    expect(pluralize(1, 'post')).toBe('1 post');
    expect(pluralize(2, 'post')).toBe('2 posts');
    expect(pluralize(0, 'post')).toBe('0 posts');
    expect(pluralize(2, 'box', 'boxes')).toBe('2 boxes');
    expect(pluralize(1, 'box', 'boxes')).toBe('1 box');
  });
});

describe('slugify', () => {
  it('basic casing and separators', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  Already — Slugged!!  ')).toBe('already-slugged');
  });
  it('strips diacritics before folding', () => {
    expect(slugify('Éclair über Café')).toBe('eclair-uber-cafe');
  });
  it('emoji/CJK-only input collapses to empty (no lone hyphens)', () => {
    expect(slugify('🎉')).toBe('');
    expect(slugify('')).toBe('');
    expect(slugify('!!! ???')).toBe('');
  });
  it('very long input keeps every word, collapses runs', () => {
    const long = `${'word- '.repeat(500)}end`;
    const out = slugify(long);
    expect(out.startsWith('word-word-word')).toBe(true);
    expect(out.endsWith('-end')).toBe(true);
    expect(out).not.toContain('--');
    /* 500 'word' tokens (4 chars) + 'end' (3) joined by 500 hyphens. */
    expect(out.length).toBe(500 * 4 + 3 + 500);
  });
});

describe('truncateAtWordBoundary', () => {
  it('leaves short text untouched, no ellipsis', () => {
    expect(truncateAtWordBoundary('short text', 50)).toBe('short text');
  });
  it('cuts at a word boundary and signals with an ellipsis', () => {
    expect(truncateAtWordBoundary('the quick brown fox jumps', 14)).toBe('the quick…');
  });
  it('never mid-cuts a word unless the word alone overflows', () => {
    expect(truncateAtWordBoundary('antidisestablishmentarianism is long', 10)).toBe(
      'antidisest…',
    );
  });
  it('empty and degenerate inputs', () => {
    expect(truncateAtWordBoundary('', 10)).toBe('');
    expect(truncateAtWordBoundary('abc', 0)).toBe('…');
    expect(truncateAtWordBoundary('abc def', 3)).toBe('abc…');
  });
  it('unicode-safe: counts UTF-16 units but cuts at spaces', () => {
    /* 'naïve café ' is exactly 11 units (NFC accents are single units). */
    expect(truncateAtWordBoundary('naïve café is nice', 11)).toBe('naïve café…');
    expect(truncateAtWordBoundary('naïve café is nice', 7)).toBe('naïve…');
    expect(truncateAtWordBoundary('🎉🎉 party time', 8)).toBe('🎉🎉…');
  });
});

describe('initials', () => {
  it('two-letter cap, whitespace tolerant', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('  Grace   Brewster  Hopper ')).toBe('GB');
    expect(initials('Plato')).toBe('P');
    expect(initials('')).toBe('');
  });
  it('diacritics keep their letter; emoji/CJK produce nothing usable, not garbage', () => {
    expect(initials('Édouard Louis')).toBe('EL');
    expect(initials('🎉 Alex')).toBe('A');
    expect(initials('李明 王')).toBe('');
  });
});

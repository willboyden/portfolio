/**
 * Deterministic formatting primitives.
 *
 * Everything here is pure and timezone-pinned to UTC: the site is prerendered
 * at build time and hydrated on client machines in arbitrary timezones, so a
 * date derived from the reader's local zone would differ between server HTML
 * and client render. Pinned month names + UTC epoch math guarantee the two
 * agree byte-for-byte without depending on the host ICU data.
 */

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Matches a strict ISO date or ISO datetime; anything else is unparseable. */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Parse an `YYYY-MM-DD` (or ISO datetime) string as a UTC epoch.
 * A bare date is read as UTC midnight — NOT the local zone (that is the whole
 * point: prerender and client must agree). Returns null for anything that is
 * not an ISO string.
 */
export function parseIsoUtc(iso: string): Date | null {
  if (typeof iso !== 'string') return null;
  const m = ISO_RE.exec(iso.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, zone] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(hh ?? '0');
  const min = Number(mm ?? '0');
  const sec = Number(ss ?? '0');
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let epoch = Date.UTC(year, month - 1, day, hour, min, sec);
  if (zone && zone !== 'Z') {
    /* Offset datetime: shift back to UTC so rendering is zone-independent. */
    const sign = zone.startsWith('-') ? -1 : 1;
    const oh = Number(zone.slice(1, 3));
    const om = Number(zone.slice(4).replace(':', '') || '0');
    epoch -= sign * (oh * 3_600_000 + om * 60_000);
  }
  const date = new Date(epoch);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface FormatDateOptions {
  /** 'short' → "Mar 14, 2026" (default); 'long' → "March 14, 2026". */
  style?: 'short' | 'long';
  /** Append the time as " 14:05 UTC" (used for talk/video timestamps). */
  withTime?: boolean;
}

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * `2026-03-14` → `Mar 14, 2026` (UTC-pinned). Returns '' for unparseable
 * input rather than "Invalid Date" — a blank is honest, a bogus date is not.
 */
export function formatDate(iso: string, options: FormatDateOptions = {}): string {
  const date = parseIsoUtc(iso);
  if (!date) return '';
  const months = options.style === 'long' ? LONG_MONTHS : MONTHS_SHORT;
  const month = months[date.getUTCMonth()];
  if (month === undefined) return '';
  let out = `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  if (options.withTime) {
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mi = String(date.getUTCMinutes()).padStart(2, '0');
    out += ` ${hh}:${mi} UTC`;
  }
  return out;
}

/**
 * R7I-01: `2026-10-07` → `October 2026` (UTC-pinned, long month). Returns ''
 * for unparseable input — callers fall back rather than render "Invalid Date".
 * Used by /now so the "Last updated" stamp is derived from the newest shipped
 * content instead of a hardcoded literal that rots.
 */
export function formatMonthYear(iso: string): string {
  const date = parseIsoUtc(iso);
  if (!date) return '';
  const month = LONG_MONTHS[date.getUTCMonth()];
  if (month === undefined) return '';
  return `${month} ${date.getUTCFullYear()}`;
}

/**
 * R6-B: project `period` frontmatter is free-form ("2026", "2026-08") and was
 * rendered verbatim — "SHIPPED · 2026" next to "SHIPPED · 2026-08" read as
 * two different granularities side by side. Normalize: YYYY-MM → "Mon YYYY",
 * bare YYYY stays as-is, anything else passes through untouched.
 */
export function formatPeriod(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m === null) return period;
  const month = MONTHS_SHORT[Number(m[2]) - 1];
  return month !== undefined ? `${month} ${m[1]}` : period;
}

/**
 * Range of two ISO dates, condensed:
 * - same day        → "Mar 14, 2026"
 * - same year       → "Mar 14 – Apr 02, 2026"
 * - different years → "Dec 30, 2025 – Jan 02, 2026"
 * Either side may be missing: `from` only → "Since Mar 14, 2026";
 * `to` only → "Until Mar 14, 2026"; neither → ''.
 */
export function formatDateRange(from?: string, to?: string): string {
  const a = from ? parseIsoUtc(from) : null;
  const b = to ? parseIsoUtc(to) : null;
  if (!a && !b) return '';
  if (a && !b) return from ? `Since ${formatDate(from)}` : '';
  if (!a && b) return to ? `Until ${formatDate(to)}` : '';
  const fa = formatDate(from!);
  const tb = formatDate(to!);
  if (fa === tb) return fa;
  if (a!.getUTCFullYear() === b!.getUTCFullYear()) {
    const monthsA = MONTHS_SHORT[a!.getUTCMonth()];
    const monthsB = MONTHS_SHORT[b!.getUTCMonth()];
    if (monthsA === monthsB) {
      return `${monthsA} ${a!.getUTCDate()} – ${b!.getUTCDate()}, ${a!.getUTCFullYear()}`;
    }
    /* Same year, different months: year rides on the end only. */
    return `${fa.replace(/, \d{4}$/, '')} – ${tb}`;
  }
  return `${fa} – ${tb}`;
}

/** `5` → `5 min read`; clamps to a minimum of 1 minute. */
export function formatReadingTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '1 min read';
  const m = Math.max(1, Math.round(minutes));
  return `${m} min read`;
}

/**
 * Seconds → `m:ss` under an hour, `h:mm:ss` at or above. Rounds the input to
 * whole seconds; negative/NaN/Infinity render as `0:00`.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** `pluralize(2, 'post')` → `2 posts`; `pluralize(1, 'box', 'boxes')` → `1 box`. */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}

/**
 * `Selling LLMs → RAG!` → `selling-llms-rag`. NFD-normalises and strips
 * combining marks first, so `Éclair` → `eclair` instead of `clair`.
 * Everything that is not `[a-z0-9]` collapses to a single hyphen; leading and
 * trailing hyphens are trimmed. Empty input → empty string.
 */
export function slugify(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Cut `text` at or before `max` characters, never mid-word, and append
 * `ellipsis` (default `…`) when anything was removed. If a single word is
 * longer than `max`, the word itself is cut (no empty result) — the cut still
 * gets the ellipsis. `max <= 0` → just the ellipsis for non-empty text.
 */
export function truncateAtWordBoundary(text: string, max: number, ellipsis = '…'): string {
  if (typeof text !== 'string' || text.length === 0) return '';
  if (max <= 0) return ellipsis;
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const boundary = Math.max(
    slice.lastIndexOf(' '),
    slice.lastIndexOf('\u00a0'),
    slice.lastIndexOf('\n'),
  );
  const cut = boundary > 0 ? slice.slice(0, boundary) : slice;
  return cut.trimEnd() + ellipsis;
}

/**
 * `Ada Lovelace` → `AL`. Whitespace-collapsed, latin letters only (so emoji
 * and CJK don't produce garbage), capped at 2 characters for avatar use.
 */
export function initials(name: string, max = 2): string {
  if (typeof name !== 'string') return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const first = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z]/i);
      return first ? first[0].toUpperCase() : '';
    })
    .join('')
    .slice(0, Math.max(0, max));
}

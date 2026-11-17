/**
 * "Today", for rendering, in a way the prerendered page and the browser agree on.
 *
 * A page is rendered twice: once at build time into static HTML, and once in
 * the visitor's browser, which adopts that HTML (hydration) and must produce
 * the very same markup on its first pass. Anything that reads the clock breaks
 * that promise the moment the two passes fall on different days: the footer's
 * year across New Year, a video whose date passes between the build and the
 * visit.
 *
 * So the build stamps the day it rendered on <html data-built>, and
 * `useToday` answers with that day while the browser is adopting the page,
 * then with the real day right after (React re-renders once if they differ).
 */
import { useSyncExternalStore } from 'react';

/** Today under UTC, as YYYY-MM-DD: zone-pinned so every reader groups alike. */
export function todayUtcIso(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

let prerenderDay: string | undefined;

/** Prerender only: the day every page of this build is rendered "as of".
 * `undefined` clears it (tests). */
export function setPrerenderDay(day: string | undefined): void {
  if (day !== undefined && !ISO_DAY.test(day)) {
    throw new Error(`setPrerenderDay: expected YYYY-MM-DD, got ${JSON.stringify(day)}`);
  }
  prerenderDay = day;
}

/**
 * The day the HTML in front of us was rendered: the build's day during the
 * prerender, the <html data-built> stamp in the browser. With neither (the
 * dev server, a unit test) it is simply today.
 */
export function renderedDay(): string {
  if (prerenderDay !== undefined) return prerenderDay;
  if (typeof document !== 'undefined') {
    const stamp = document.documentElement?.getAttribute?.('data-built');
    if (typeof stamp === 'string' && ISO_DAY.test(stamp)) return stamp;
  }
  return todayUtcIso();
}

/** The clock does not notify; the snapshot is re-read on every render. */
function subscribeToNothing(): () => void {
  return () => undefined;
}

function today(): string {
  return todayUtcIso();
}

/**
 * Today (UTC, YYYY-MM-DD) for use in render output. While the prerendered
 * page is being adopted it is the day that page was built, so the markup
 * matches; afterwards, and on every later render, it is the real day.
 */
export function useToday(): string {
  return useSyncExternalStore(subscribeToNothing, today, renderedDay);
}

/** The four-digit year of an ISO day, guarded: never NaN. */
export function yearOf(day: string, fallback = 2026): number {
  const year = Number(day.slice(0, 4));
  return Number.isInteger(year) && year > 1970 ? year : fallback;
}

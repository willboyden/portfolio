/**
 * "Today" for rendering: the build's day while the prerendered page is being
 * adopted, the real day otherwise.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { renderedDay, setPrerenderDay, todayUtcIso, useToday, yearOf } from './today';

afterEach(() => {
  setPrerenderDay(undefined);
  vi.unstubAllGlobals();
});

function Shows(): React.ReactNode {
  return createElement('p', null, useToday());
}

describe('todayUtcIso', () => {
  it('is the UTC calendar day, zero-padded', () => {
    expect(todayUtcIso(new Date(Date.UTC(2026, 0, 5, 23, 59)))).toBe('2026-01-05');
    expect(todayUtcIso(new Date(Date.UTC(2026, 10, 16)))).toBe('2026-11-16');
    expect(todayUtcIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not follow the local zone across midnight', () => {
    /* 23:30 on New Year's Eve in UTC is still 2026 whatever the reader's zone. */
    expect(todayUtcIso(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31');
    expect(todayUtcIso(new Date('2027-01-01T00:30:00Z'))).toBe('2027-01-01');
  });
});

describe('renderedDay', () => {
  it('is the day the prerender set', () => {
    setPrerenderDay('2026-03-14');
    expect(renderedDay()).toBe('2026-03-14');
  });

  it('in the browser is the <html data-built> stamp', () => {
    vi.stubGlobal('document', {
      documentElement: { getAttribute: (name: string) => (name === 'data-built' ? '2025-12-31' : null) },
    });
    expect(renderedDay()).toBe('2025-12-31');
  });

  it('ignores a stamp that is not a date, and is today when nothing was stamped', () => {
    vi.stubGlobal('document', { documentElement: { getAttribute: () => 'yesterday' } });
    expect(renderedDay()).toBe(todayUtcIso());
    vi.stubGlobal('document', { documentElement: { getAttribute: () => null } });
    expect(renderedDay()).toBe(todayUtcIso());
    vi.unstubAllGlobals();
    expect(renderedDay()).toBe(todayUtcIso());
  });

  it('refuses a prerender day that is not YYYY-MM-DD', () => {
    expect(() => setPrerenderDay('16 Nov 2026')).toThrow(/YYYY-MM-DD/);
    expect(() => setPrerenderDay('2026-11-16T00:00:00Z')).toThrow(/YYYY-MM-DD/);
  });
});

describe('useToday', () => {
  it('renders the build day on the server, so the markup can be adopted on any later day', () => {
    setPrerenderDay('2026-12-31');
    expect(renderToString(createElement(Shows))).toBe('<p>2026-12-31</p>');
    expect(renderToStaticMarkup(createElement(Shows))).toBe('<p>2026-12-31</p>');
  });

  it('with no build day it is simply today', () => {
    expect(renderToStaticMarkup(createElement(Shows))).toBe(`<p>${todayUtcIso()}</p>`);
  });
});

describe('yearOf', () => {
  it('is the year of an ISO day, never NaN', () => {
    expect(yearOf('2026-11-16')).toBe(2026);
    expect(yearOf('2031-01-01')).toBe(2031);
    expect(yearOf('')).toBe(2026);
    expect(yearOf('soon')).toBe(2026);
    expect(yearOf('0001-01-01', 2030)).toBe(2030);
  });
});

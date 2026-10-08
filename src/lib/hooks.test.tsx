/**
 * Unit tests for src/lib/hooks.ts — environment: 'node', NO window, NO jsdom.
 *
 * Two jobs:
 * 1. Prove SSR safety: every hook renders on the server (react-dom/server)
 *    without touching window/document/matchMedia and without throwing.
 * 2. Test the pure logic split out of the hooks (computeScrollProgress,
 *    resolveTheme, readMediaQuery) directly.
 * Real interaction behaviour is covered by the CDP e2e suite (CONTRACT §0).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@emotion/react';
import { darkTheme } from 'app/theme/tokens';
import {
  computeScrollProgress,
  readMediaQuery,
  readStoredThemePref,
  resolveTheme,
  useCopyToClipboard,
  useDebouncedValue,
  useMediaQuery,
  useMounted,
  useOnClickOutside,
  useReducedMotion,
  useScrollProgress,
} from 'app/lib/hooks';

const h = (component: React.ComponentType<any>, props: Record<string, unknown> = {}): React.ReactNode =>
  createElement(component, props);

/** Render `Probe` inside an Emotion ThemeProvider (hooks need no theme, but
 *  App-level components will; keep parity with production nesting). */
function serverRender(Probe: React.ComponentType): string {
  return renderToStaticMarkup(h(ThemeProvider, { theme: darkTheme, children: h(Probe) }));
}

afterEach(() => {
  /* Belt-and-braces: if a test ever installs a fake window, remove it. */
  delete (globalThis as Record<string, unknown>).window;
});

describe('environment', () => {
  it('window is undefined in this test environment (SSR proxy)', () => {
    expect(typeof window).toBe('undefined');
  });
});

describe('pure logic', () => {
  it('computeScrollProgress clamps and guards division by zero', () => {
    expect(computeScrollProgress(0, 1000, 500)).toEqual({ progress: 0, scrolled: 0, total: 500 });
    expect(computeScrollProgress(250, 1000, 500)).toEqual({ progress: 0.5, scrolled: 250, total: 500 });
    expect(computeScrollProgress(9999, 1000, 500).scrolled).toBe(500); /* clamp high */
    expect(computeScrollProgress(-10, 1000, 500).scrolled).toBe(0); /* clamp low */
    expect(computeScrollProgress(0, 400, 500)).toEqual({ progress: 0, scrolled: 0, total: 0 }); /* no page scroll */
  });

  it('resolveTheme honours explicit prefs, else system', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme(undefined, false)).toBe('light');
  });

  it('readMediaQuery is false without window (never throws)', () => {
    expect(readMediaQuery('(prefers-reduced-motion: reduce)')).toBe(false);
  });

  it('readStoredThemePref is undefined without window (never throws)', () => {
    expect(readStoredThemePref()).toBeUndefined();
  });
});

describe('hooks render on the server without throwing', () => {
  const HooksProbe = (): React.ReactNode => {
    const reduced = useReducedMotion();
    const mounted = useMounted();
    const wide = useMediaQuery('(min-width: 768px)');
    const debounced = useDebouncedValue('typing…', 200);
    const scroll = useScrollProgress();
    const { copy, copied, failed } = useCopyToClipboard();
    useOnClickOutside({ current: null }, () => undefined);
    return createElement(
      'output',
      { 'data-reduced': String(reduced), 'data-mounted': String(mounted), 'data-wide': String(wide), 'data-debounced': debounced, 'data-progress': String(scroll.progress), 'data-copied': String(copied), 'data-failed': String(failed) },
      typeof copy === 'function' ? 'copy-ready' : 'missing',
    );
  };

  it('all hooks produce server-safe values and markup', () => {
    const html = serverRender(HooksProbe);
    /* SSR snapshots: everything false/zero — browser state only after effects. */
    expect(html).toContain('data-reduced="false"');
    expect(html).toContain('data-mounted="false"');
    expect(html).toContain('data-wide="false"');
    expect(html).toContain('data-debounced="typing…"');
    expect(html).toContain('data-progress="0"');
    expect(html).toContain('data-copied="false"');
    expect(html).toContain('data-failed="false"');
    expect(html).toContain('copy-ready');
  });

  it('repeated renders are deterministic (no date/random leakage)', () => {
    expect(serverRender(HooksProbe)).toBe(serverRender(HooksProbe));
  });
});

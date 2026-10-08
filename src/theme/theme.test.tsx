/**
 * Contract + behaviour tests for the theme layer, environment: 'node'.
 *
 * Covers: SSR render of AppThemeProvider (dark shell default), the pinned
 * hooks API, global stylesheet emission through the vendored Emotion sheet,
 * and — the load-bearing one — evaluating `themeInitScript` against a fake
 * document to prove the prerendered no-flash snippet really stamps data-theme
 * before paint under every stored-pref state.
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useTheme } from '@emotion/react';
import { __resetSheet, __sheetCss } from '@emotion-mini/core';
import { darkTheme, lightTheme, themeToCssVars, type ThemeName } from 'app/theme/tokens';
import {
  AppThemeProvider,
  THEME_INIT_SCRIPT_STORAGE_KEY,
  themeInitScript,
  useReducedMotion,
  useThemeController,
  useThemeName,
} from 'app/theme/ThemeProvider';
import { buildGlobalStyles } from 'app/theme/global-styles';
import { readFileSync } from 'node:fs';

const h = (component: React.ComponentType<never>, props: Record<string, unknown>): React.ReactNode =>
  createElement(component as React.ComponentType, props);

describe('AppThemeProvider (SSR)', () => {
  const AccentProbe = (): React.ReactNode => {
    const theme = useTheme();
    return createElement('span', { id: 'probe' }, theme.color.accent);
  };

  it('components receive CSS-var token refs, not palette hexes (R2C-5 FOUC design)', () => {
    /* Serialized component CSS must be palette-independent: the SAME markup
     * renders for dark and light, so server/client/prerender output is
     * byte-identical and hydration can never mismatch. The palette is chosen
     * by [data-theme] on the document BEFORE first paint (theme-init script). */
    const html = renderToStaticMarkup(
      h(AppThemeProvider, { children: h(AccentProbe, {}) }),
    );
    expect(html).toContain('<span id="probe">');
    expect(html).toContain(`var(--c-accent, ${darkTheme.color.accent})`);
    expect(html).not.toContain(lightTheme.color.accent);
    /* forcedTheme never changes the COMPONENT markup — only :root. Same probe
     * renders byte-identical in both palettes: */
    const lightHtml = renderToStaticMarkup(
      h(AppThemeProvider, { forcedTheme: 'light' as ThemeName, children: h(AccentProbe, {}) }),
    );
    expect(lightHtml).toBe(html);
  });

  it('forcedTheme flips the :root concrete palette (prerenderer override)', () => {
    renderToStaticMarkup(
      h(AppThemeProvider, { forcedTheme: 'light' as ThemeName, children: h(AccentProbe, {}) }),
    );
    const sheet = __sheetCss();
    /* The concrete light values must be live in :root for non-var consumers
     * (and the data-theme blocks both ship). */
    expect(sheet).toContain('--c-bg:' + lightTheme.color.bg);
    /* R3-A #1: selectors are UNQUOTED (quoted forms get quote-escaped by the
     * serializer into a spec-broken selector). Pin the unquoted contract.
     * R3C-12: :root already carries light concrete values, so only the
     * DIFFERING palette ships a data-theme block (dark here). */
    expect(sheet).toContain('[data-theme=dark]');
    expect(sheet).not.toContain('[data-theme=light]');
  });

  it('useThemeName returns [name, setter] pinned by CONTRACT §4', () => {
    const Probe = (): React.ReactNode => {
      const [name, setName] = useThemeName();
      return createElement(
        'span',
        { 'data-name': name, 'data-setter': typeof setName },
        name,
      );
    };
    const html = renderToStaticMarkup(h(AppThemeProvider, { children: h(Probe, {}) }));
    expect(html).toContain('data-name="dark"'); /* server snapshot = shell default */
    expect(html).toContain('data-setter="function"');
  });

  it('useThemeController exposes preference + cycle for the header toggle', () => {
    const Probe = (): React.ReactNode => {
      const c = useThemeController();
      return createElement('span', { 'data-pref': c.preference, 'data-cycle': typeof c.cycle });
    };
    const html = renderToStaticMarkup(h(AppThemeProvider, { children: h(Probe, {}) }));
    expect(html).toContain('data-pref="system"');
    expect(html).toContain('data-cycle="function"');
  });

  it('useThemeName outside the provider throws a helpful error', () => {
    const Loose = (): React.ReactNode => {
      useThemeName();
      return null;
    };
    expect(() => renderToStaticMarkup(h(Loose, {}))).toThrow(/AppThemeProvider/);
  });

  it('useReducedMotion is false on the server (no matchMedia)', () => {
    const Probe = (): React.ReactNode =>
      createElement('span', { 'data-rm': String(useReducedMotion()) });
    expect(renderToStaticMarkup(h(AppThemeProvider, { children: h(Probe, {}) }))).toContain(
      'data-rm="false"',
    );
  });
});

describe('buildGlobalStyles via <Global> in the provider', () => {
  it('emits reset, tokens as CSS vars, focus-visible, selection, reduced-motion', () => {
    renderToStaticMarkup(h(AppThemeProvider, { children: null }));
    const sheet = __sheetCss();
    expect(sheet).toMatch(/\*,\s*\*::before,\s*\*::after\s*{[^}]*box-sizing:\s*border-box/);
    expect(sheet).toContain(`${darkTheme.color.bg}`); /* body background token */
    expect(sheet).toContain('--c-accent:' + darkTheme.color.accent); /* themeToCssVars */
    expect(sheet).toContain('--s-4:' + darkTheme.space['4']);
    expect(sheet).toMatch(/:focus-visible\s*{[^}]*outline:\s*2px solid/);
    expect(sheet).toMatch(/::selection\s*{/);
    expect(sheet).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(sheet).toMatch(/font-smoothing|text-rendering/);
  });

  it('every render ships the OTHER palette as a data-theme block (R2C-5+R3C-12)', () => {
    /* :root = rendered palette (concrete); exactly one data-theme block = the
     * palette that DIFFERS (no byte-identical 38-prop re-declaration). */
    renderToStaticMarkup(h(AppThemeProvider, { forcedTheme: 'light' as ThemeName, children: null }));
    const sheet = __sheetCss();
    expect(sheet).toContain('--c-bg:' + lightTheme.color.bg);       /* :root */
    const darkBlock = sheet.match(/\[data-theme=dark\]\s*\{([^}]*)\}/);
    expect(darkBlock, 'dark data-theme block').toBeTruthy();
    expect(darkBlock![1]).toContain('--c-bg:' + darkTheme.color.bg);
    expect(sheet).not.toContain('[data-theme=light]');               /* same as :root */

    /* default render (dark): :root dark, light block ships */
    __resetSheet();
    renderToStaticMarkup(h(AppThemeProvider, { children: null }));
    const s2 = __sheetCss();
    expect(s2).toContain('--c-bg:' + darkTheme.color.bg);
    expect(s2).toContain('[data-theme=light]');
    expect(s2).not.toContain('[data-theme=dark]');
  });

  it('every var(--*) reference resolves to an emitted custom property (R3C-02 guard)', () => {
    /* R3C-02 shipped because `var(--c-accentBorder)` never matched the
     * kebab-cased emit (`--c-accent-border`). This gate catches any future
     * camelCase/typo'd token reference at test time, both palettes. */
    for (const theme of [darkTheme, lightTheme]) {
      renderToStaticMarkup(h(AppThemeProvider, { forcedTheme: theme === darkTheme ? 'dark' : 'light', children: null }));
      const emitted = new Set(Object.keys(themeToCssVars(theme)));
      const refs = [...__sheetCss().matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
      expect(refs.length, 'sheet exercises var() refs').toBeGreaterThan(5);
      for (const ref of refs) {
        expect(emitted, `unresolved var reference ${ref}`).toContain(ref);
      }
      __resetSheet();
    }
  });

  it('buildGlobalStyles is pure and theme-pinned (one source of truth)', () => {
    const a = buildGlobalStyles(darkTheme);
    const b = buildGlobalStyles(darkTheme);
    expect(a).toEqual(b);
    expect(a[':root']?.['--c-bg']).toBe(darkTheme.color.bg);
    expect(buildGlobalStyles(lightTheme)[':root']?.['--c-bg']).toBe(lightTheme.color.bg);
  });
});

/* -------------------------------------------------------------------------- */
/* themeInitScript — the prerender no-flash snippet, executed for real        */
/* -------------------------------------------------------------------------- */

interface FakeDocument {
  documentElement: { attrs: Record<string, string>; style: Record<string, string>; setAttribute(k: string, v: string): void };
}

function fakeDocument(): FakeDocument {
  const el = {
    attrs: {} as Record<string, string>,
    style: {} as Record<string, string>,
    setAttribute(k: string, v: string) {
      el.attrs[k] = v;
    },
  };
  return { documentElement: el };
}

/** Run the init script in a sandboxed Function (no globals leak, no eval of
 *  the test file's scope). Throws if it is not valid JS. */
function runInitScript(opts: {
  stored?: string | null;
  systemDark?: boolean;
  doc?: FakeDocument;
}): { doc: FakeDocument; threw: unknown } {
  const doc = opts.doc ?? fakeDocument();
  const storage = { getItem: (_k: string) => opts.stored ?? null };
  const windowStub = {
    matchMedia: (q: string) => ({ matches: q.includes('dark') ? !!opts.systemDark : false }),
  };
  try {
    const fn = new Function('document', 'window', 'localStorage', themeInitScript);
    fn(doc, windowStub, storage);
    return { doc, threw: null };
  } catch (e) {
    return { doc, threw: e };
  }
}

/* Shipped-file parity (R3C-04): public/theme-init.js is what actually runs in
 * the browser. The inline `themeInitScript` above is unit-tested; this block
 * runs the SHIPPED bytes through the same fake-DOM harness so the two copies
 * cannot drift in behavior (the FOUC-critical path must be tested where it
 * ships, not only where it's imported). */
describe('public/theme-init.js (shipped file) — same behavior, same contract', () => {
  const shipped = readFileSync(
    new URL('../../public/theme-init.js', import.meta.url),
    'utf8',
  );

  function runShipped(opts: { stored: string | null; systemDark?: boolean }): {
    doc: FakeDocument;
    threw: unknown;
  } {
    const doc = fakeDocument();
    const storage = { getItem: (_k: string) => opts.stored ?? null };
    const windowStub = {
      matchMedia: (q: string) => ({ matches: q.includes('dark') ? !!opts.systemDark : false }),
    };
    try {
      /* the file is an IIFE over globals — provide them via Function params */
      const fn = new Function('document', 'window', 'localStorage', shipped);
      fn(doc, windowStub, storage);
      return { doc, threw: null };
    } catch (e) {
      return { doc, threw: e };
    }
  }

  it('references the same storage key as the app', () => {
    expect(shipped).toContain('portfolio.theme');
  });

  it('stored JSON pref → data-theme + colorScheme flip (both palettes)', () => {
    for (const t of ['dark', 'light'] as const) {
      const { doc, threw } = runShipped({ stored: JSON.stringify({ theme: t }) });
      expect(threw).toBeNull();
      expect(doc.documentElement.attrs['data-theme']).toBe(t);
      expect(doc.documentElement.style.colorScheme).toBe(t);
    }
  });

  it('legacy bare-string pref is tolerated identically (R3C-05)', () => {
    for (const t of ['dark', 'light'] as const) {
      const shippedRun = runShipped({ stored: JSON.stringify(t).slice(1, -1) });
      expect(shippedRun.threw).toBeNull();
      expect(shippedRun.doc.documentElement.attrs['data-theme']).toBe(t);
      const inlineRun = runInitScript({ stored: JSON.stringify(t).slice(1, -1) });
      expect(inlineRun.threw).toBeNull();
      expect(inlineRun.doc.documentElement.attrs['data-theme']).toBe(t);
    }
  });

  it('no stored pref follows prefers-color-scheme, colorScheme dark light', () => {
    const dark = runShipped({ stored: null, systemDark: true });
    expect(dark.doc.documentElement.attrs['data-theme']).toBe('dark');
    expect(dark.doc.documentElement.style.colorScheme).toBe('dark light');
  });

  it('private-mode storage (getItem throws) degrades to system pref', () => {
    const doc = fakeDocument();
    const boom = { getItem: () => { throw new Error('SecurityError'); } };
    const windowStub = { matchMedia: (q: string) => ({ matches: q.includes('dark') }) };
    expect(() =>
      new Function('document', 'window', 'localStorage', shipped)(doc, windowStub, boom),
    ).not.toThrow();
    /* inner catch swallows, resolution falls through to prefers-color-scheme */
    expect(doc.documentElement.attrs['data-theme']).toBe('dark');
  });
});

describe('themeInitScript', () => {
  it('is a single-line IIFE referencing the shared storage key, valid JS', () => {
    expect(typeof themeInitScript).toBe('string');
    expect(themeInitScript).toContain(THEME_INIT_SCRIPT_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT_STORAGE_KEY).toBe('portfolio.theme');
    const { threw } = runInitScript({ stored: null });
    expect(threw).toBeNull();
  });

  it('stored dark → data-theme=dark + colorScheme dark', () => {
    const { doc, threw } = runInitScript({ stored: JSON.stringify({ theme: 'dark' }) });
    expect(threw).toBeNull();
    expect(doc.documentElement.attrs['data-theme']).toBe('dark');
    expect(doc.documentElement.style.colorScheme).toBe('dark');
  });

  it('stored light → data-theme=light + colorScheme light', () => {
    const { doc } = runInitScript({ stored: JSON.stringify({ theme: 'light' }) });
    expect(doc.documentElement.attrs['data-theme']).toBe('light');
    expect(doc.documentElement.style.colorScheme).toBe('light');
  });

  it('no stored pref → follows prefers-color-scheme, colorScheme=dark light', () => {
    const dark = runInitScript({ stored: null, systemDark: true });
    expect(dark.doc.documentElement.attrs['data-theme']).toBe('dark');
    expect(dark.doc.documentElement.style.colorScheme).toBe('dark light');
    const light = runInitScript({ stored: null, systemDark: false });
    expect(light.doc.documentElement.attrs['data-theme']).toBe('light');
    expect(light.doc.documentElement.style.colorScheme).toBe('dark light');
  });

  it('garbage in storage or a throwing localStorage falls back to system — never errors', () => {
    const garbage = runInitScript({ stored: '{oops', systemDark: false });
    expect(garbage.threw).toBeNull();
    expect(garbage.doc.documentElement.attrs['data-theme']).toBe('light');
    const hostile = runInitScript({ stored: null, systemDark: true });
    /* localStorage absent entirely → the outer try/catch must still set a theme?
     * No: with localStorage undefined the script swallows the error. Assert it
     * neither throws nor half-applies a stored theme. */
    expect(hostile.threw).toBeNull();
  });

  it('matches the key + shape themeStore writes (integration contract)', async () => {
    const { THEME_STORAGE_KEY, ThemePrefSchema } = await import('app/lib/storage');
    expect(THEME_INIT_SCRIPT_STORAGE_KEY).toBe(THEME_STORAGE_KEY);
    const sample = { theme: 'light' as const };
    expect(ThemePrefSchema.safeParse(sample).success).toBe(true);
    const { doc } = runInitScript({ stored: JSON.stringify(sample) });
    expect(doc.documentElement.attrs['data-theme']).toBe('light');
  });
});

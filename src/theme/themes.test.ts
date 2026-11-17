/**
 * The theme registry, the generator behind it, and the stylesheet that ships
 * every theme. (Contrast is gated per theme in contrast.test.ts; the pre-paint
 * script in theme.test.tsx.)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGlobalStyles } from './global-styles';
import { SERIES, contrast, inkOn, makePalette, mix, withContrast } from './make-theme';
import {
  applyThemeVars,
  darkTheme,
  isKnownTheme,
  lightTheme,
  RECIPES,
  STYLESHEET_ROOT_THEME,
  STYLESHEET_THEMES,
  THEME_INFO,
  THEME_INLINE_VARS,
  THEME_MODES,
  THEME_NAMES,
  THEME_VAR_NAMES,
  themeColorVars,
  themeInfo,
  themeInlineVars,
  themeMode,
  themes,
  type ThemeName,
} from './tokens';
import { ThemePrefSchema } from 'app/lib/storage';

describe('theme registry', () => {
  it('lists every theme exactly once, with the two defaults under their stored ids', () => {
    expect(new Set(THEME_NAMES).size).toBe(THEME_NAMES.length);
    expect([...THEME_NAMES].sort()).toEqual(Object.keys(themes).sort());
    expect(themes.dark).toBe(darkTheme);
    expect(themes.light).toBe(lightTheme);
    expect(themeInfo('dark').label).toBe('Night');
    expect(themeInfo('light').label).toBe('Paper');
    /* A plethora, and a balanced one: several papers, several boards. */
    expect(THEME_INFO.filter((t) => t.mode === 'light').length).toBeGreaterThanOrEqual(5);
    expect(THEME_INFO.filter((t) => t.mode === 'dark').length).toBeGreaterThanOrEqual(5);
  });

  it('every theme has a distinct name a visitor can tell apart, and says what it is made of', () => {
    const labels = THEME_INFO.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const info of THEME_INFO) {
      expect(info.note.length, info.id).toBeGreaterThan(10);
      expect(info.id, 'ids are CSS identifiers and storage keys').toMatch(/^[a-z]+$/);
    }
  });

  it('every generated theme has a recipe, and its recipe agrees with its listed mode', () => {
    const generated = THEME_NAMES.filter((name) => name !== 'dark' && name !== 'light');
    expect(Object.keys(RECIPES).sort()).toEqual([...generated].sort());
    for (const name of generated) {
      const recipe = RECIPES[name as keyof typeof RECIPES];
      expect(recipe.mode, name).toBe(themeMode(name));
      expect(themes[name].color.bg, name).toBe(recipe.paper);
      expect(themes[name].color.text, name).toBe(recipe.ink);
      expect(themes[name].color.mark, name).toBe(recipe.mark);
    }
  });

  it('no two themes look alike: pages and highlighters differ', () => {
    const seen = new Map<string, string>();
    for (const name of THEME_NAMES) {
      const key = `${themes[name].color.bg}|${themes[name].color.mark}`;
      expect(seen.get(key), `${name} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, name);
    }
    expect(new Set(THEME_NAMES.map((n) => themes[n].color.bg)).size).toBe(THEME_NAMES.length);
  });

  it('isKnownTheme narrows only real ids (never an inherited object key)', () => {
    for (const name of THEME_NAMES) expect(isKnownTheme(name)).toBe(true);
    for (const bad of ['constructor', 'toString', '__proto__', 'Dark', 'system', '', null, undefined, 3, {}]) {
      expect(isKnownTheme(bad), String(bad)).toBe(false);
    }
  });

  it('THEME_MODES is the id -> mode table of the registry', () => {
    expect(THEME_MODES).toEqual(Object.fromEntries(THEME_INFO.map((t) => [t.id, t.mode])));
  });

  it('geometry and type never change with the theme', () => {
    for (const name of THEME_NAMES) {
      expect(themes[name].font, name).toEqual(darkTheme.font);
      expect(themes[name].space, name).toEqual(darkTheme.space);
      expect(themes[name].radius, name).toEqual(darkTheme.radius);
      expect(themes[name].layout, name).toEqual(darkTheme.layout);
      expect(Object.keys(themes[name].color).sort(), name).toEqual(Object.keys(darkTheme.color).sort());
    }
  });

  it('the stored preference accepts "system" and every theme id, and nothing else', () => {
    expect(ThemePrefSchema.safeParse({ theme: 'system' }).success).toBe(true);
    for (const name of THEME_NAMES) expect(ThemePrefSchema.safeParse({ theme: name }).success, name).toBe(true);
    for (const bad of ['auto', 'constructor', '', 'Blueprint']) {
      expect(ThemePrefSchema.safeParse({ theme: bad }).success, bad).toBe(false);
    }
  });
});

describe('where a theme’s colours live: two in the stylesheet, the rest as inline variables', () => {
  const blocks = (rendered: ThemeName): Record<string, Record<string, unknown>> =>
    buildGlobalStyles(themes[rendered]) as Record<string, Record<string, unknown>>;
  const generated = THEME_NAMES.filter((name) => !STYLESHEET_THEMES.includes(name));

  it('the stylesheet holds Night and Paper and no other theme (ten palettes stay out of every page)', () => {
    expect([...STYLESHEET_THEMES].sort()).toEqual(['dark', 'light']);
    expect(STYLESHEET_ROOT_THEME).toBe('dark');
    expect(generated.length).toBe(THEME_NAMES.length - 2);
    for (const rendered of ['dark', 'light', 'blueprint'] as const) {
      const sheet = blocks(rendered);
      expect(sheet[':root']?.['--c-bg']).toBe(themes[rendered].color.bg);
      expect(sheet[`:root[data-theme=${rendered}]`]).toBeUndefined();
      for (const name of STYLESHEET_THEMES) {
        if (name === rendered) continue;
        expect(sheet[`:root[data-theme=${name}]`], `${name} block when ${rendered} is rendered`).toEqual(
          themeColorVars(themes[name]),
        );
      }
      for (const name of generated) {
        if (name === rendered) continue;
        expect(sheet[`:root[data-theme=${name}]`], `${name} must not be in the stylesheet`).toBeUndefined();
      }
    }
  });

  it('every other theme has its colours as inline variables; the two stylesheet themes have none', () => {
    expect(themeInlineVars('dark')).toBeNull();
    expect(themeInlineVars('light')).toBeNull();
    expect(Object.keys(THEME_INLINE_VARS).sort()).toEqual([...generated].sort());
    for (const name of generated) {
      expect(themeInlineVars(name), name).toEqual(themeColorVars(themes[name]));
      expect(THEME_INLINE_VARS[name], name).toEqual(themeColorVars(themes[name]));
      /* The same variable names in every theme, so one theme fully replaces another. */
      expect(Object.keys(THEME_INLINE_VARS[name] ?? {}), name).toEqual([...THEME_VAR_NAMES]);
    }
  });

  it('applyThemeVars puts a theme in force and takes the previous one away', () => {
    const vars = new Map<string, string>();
    const style = {
      setProperty: (name: string, value: string) => void vars.set(name, value),
      removeProperty: (name: string) => vars.delete(name),
    };
    applyThemeVars(style, 'blueprint');
    expect(Object.fromEntries(vars)).toEqual(themeColorVars(themes.blueprint));
    /* One generated theme to another: exactly the new theme, nothing left over. */
    applyThemeVars(style, 'ledger');
    expect(Object.fromEntries(vars)).toEqual(themeColorVars(themes.ledger));
    /* A property that is not a theme variable is not this function's to touch. */
    vars.set('color-scheme', 'light');
    /* Back to a stylesheet theme: every theme variable is gone. */
    applyThemeVars(style, 'light');
    expect(Object.fromEntries(vars)).toEqual({ 'color-scheme': 'light' });
    applyThemeVars(style, 'dark');
    expect(vars.size).toBe(1);
  });

  it('applyThemeVars is a no-op on something that is not a style (a stubbed document, a detached node)', () => {
    expect(() => applyThemeVars(null, 'blueprint')).not.toThrow();
    expect(() => applyThemeVars(undefined, 'blueprint')).not.toThrow();
    expect(() => applyThemeVars({}, 'blueprint')).not.toThrow();
    const partial = { setProperty: () => undefined };
    expect(() => applyThemeVars(partial, 'blueprint')).not.toThrow();
  });

  it('a theme block carries only what differs between themes (colours and shadows)', () => {
    const vars = Object.keys(themeColorVars(themes.ledger));
    expect(vars.every((v) => v.startsWith('--c-') || v.startsWith('--sh-'))).toBe(true);
    expect(vars).toContain('--c-mark');
    expect(vars).toContain('--c-series1');
    expect(vars.some((v) => v.startsWith('--s-') || v.startsWith('--r-') || v.startsWith('--font'))).toBe(false);
  });

  it('print always uses Paper, whatever theme is in effect, inline variables included', () => {
    const print = blocks('darkroom')['@media print'] as Record<string, Record<string, unknown>>;
    expect(print[':root']?.['--c-bg']).toBe(lightTheme.color.bg);
    /* A theme set as inline variables on <html> outranks any plain rule, so
     * the print values carry !important: a dark theme must not print blank. */
    const forced = print['[data-theme]'] ?? {};
    for (const name of THEME_VAR_NAMES) {
      expect(forced[name], name).toBe(`${themeColorVars(lightTheme)[name]} !important`);
    }
  });

  it('the shipped pre-paint script carries the same table of inline variables', () => {
    const shipped = readFileSync(new URL('../../public/theme-init.js', import.meta.url), 'utf8');
    const line = /^\s*var VARS = (.*);$/m.exec(shipped)?.[1];
    expect(line, 'VARS table not found in public/theme-init.js').toBeDefined();
    /* Out of date? Run: node scripts/sync-theme-init.mjs */
    expect(JSON.parse(line ?? '{}')).toEqual(THEME_INLINE_VARS);
    expect(line).toBe(JSON.stringify(THEME_INLINE_VARS));
  });

  it('the shipped pre-paint script carries the same id -> mode table', () => {
    const shipped = readFileSync(new URL('../../public/theme-init.js', import.meta.url), 'utf8');
    const table = /var MODES = (\{[^}]*\});/.exec(shipped)?.[1];
    expect(table, 'MODES table not found in public/theme-init.js').toBeDefined();
    expect(JSON.parse(table as string)).toEqual(THEME_MODES);
  });
});

describe('make-theme (the generator)', () => {
  it('mix is a straight sRGB blend and contrast is the WCAG ratio', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBe(1);
    expect(() => mix('red', '#ffffff', 0.5)).toThrow(/#rrggbb/);
  });

  it('withContrast moves a colour only as far as its floor needs, toward the given end', () => {
    /* Already clear: untouched. */
    expect(withContrast('#000000', ['#ffffff'], 4.5, '#000000')).toBe('#000000');
    /* Too faint: pushed toward black until 4.5:1, and not all the way. */
    const fixed = withContrast('#aaaaaa', ['#ffffff', '#f0f0f0'], 4.5, '#000000');
    expect(contrast(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fixed, '#f0f0f0')).toBeGreaterThanOrEqual(4.5);
    expect(fixed).not.toBe('#000000');
    /* A floor nothing in between reaches ends at the target itself. */
    expect(withContrast('#aaaaaa', ['#ffffff'], 21, '#000000')).toBe('#000000');
  });

  it('inkOn picks whichever of near-black and white reads better on a fill', () => {
    expect(inkOn('#ffd60a')).toBe('#16161a');
    expect(inkOn('#1a2440')).toBe('#ffffff');
  });

  it('a palette is the recipe plus derived steps, with text floors enforced on its own surfaces', () => {
    for (const mode of ['light', 'dark'] as const) {
      /* A deliberately low-contrast recipe: the generator must still deliver. */
      const recipe =
        mode === 'light'
          ? { mode, paper: '#d8d4c8', ink: '#2c2a26', mark: '#ffe066' }
          : { mode, paper: '#2a2c30', ink: '#d0d3d8', mark: '#8fd3ff' };
      const { color } = makePalette(recipe);
      expect(color.bg).toBe(recipe.paper);
      expect(color.text).toBe(recipe.ink);
      expect(color.rule).toBe(recipe.ink);
      expect(color.accent).toBe(recipe.ink);
      for (const surface of [color.bg, color.surface, color.bgSunken]) {
        expect(contrast(color.textSubtle, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(color.success, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(color.warning, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(color.danger, surface)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(color.textMuted, color.bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(color.markInk, color.mark)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color.borderStrong, color.bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(color.focus, color.bg)).toBeGreaterThanOrEqual(3);
      /* Data colours are the validated step for the mode, never re-derived. */
      expect(color.series1).toBe(SERIES[mode].series1);
      expect(color.series2).toBe(SERIES[mode].series2);
      expect(color.series3).toBe(SERIES[mode].series3);
    }
  });

  it('the hand-written defaults use the same data colours as the generated themes of their mode', () => {
    for (const key of ['series1', 'series2', 'series3'] as const) {
      expect(lightTheme.color[key]).toBe(SERIES.light[key]);
      expect(darkTheme.color[key]).toBe(SERIES.dark[key]);
    }
  });
});

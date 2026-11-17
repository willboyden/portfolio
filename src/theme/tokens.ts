/**
 * Design tokens — the single source of truth for the visual system.
 *
 * Every styled component reads from these tokens via `useTheme()`; nothing in
 * `src/components` or `src/pages` is allowed to hard-code a hex colour, px
 * radius, or font size. That is what makes the design reviewable: change a
 * token, the whole site follows.
 *
 * The idea: a lab notebook, typeset. Paper, ink, and ONE highlighter.
 *  - Text, links, buttons and rules are all ink (`text`, `accent`, `rule`).
 *    There is no second "brand" hue for links: a link is ink with a marker
 *    underline, so it never depends on colour alone.
 *  - `mark` is the highlighter. It is a FILL (hover, selection, the current
 *    page, a measured number), with `markInk` on top. In the light theme it is
 *    far too light to be text; in the dark theme it also works as a line.
 *  - Type is IBM Plex (src/theme/fonts.ts): Sans for the interface, Serif for
 *    headings and long-form reading, Mono for data.
 *  - Structure comes from rules and columns, not from boxes: corners are
 *    nearly square and nothing floats on a shadow.
 *
 * Contrast: every pair a component renders is listed and gated in
 * contrast.test.ts (WCAG 2.x AA; body text pairs are >= 7:1).
 */

import { makePalette, type ThemeMode, type ThemeRecipe } from './make-theme';

export type { ThemeMode, ThemeRecipe };

export interface Tokens {
  color: {
    bg: string;
    bgElevated: string;
    bgSunken: string;
    surface: string;
    surfaceHover: string;
    border: string;
    borderStrong: string;
    /** Structural rule at ink strength: the heavy line that opens a section
     * or a table (a typeset report's top rule). */
    rule: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    /** Ink for links and actions. Same family as `text` on purpose. */
    accent: string;
    /** Text on a solid `accent` fill. */
    accentText: string;
    /** A light wash of the highlighter (hover and selected backgrounds). */
    accentSoft: string;
    /** The highlighter as a line: link underlines, the current-page bar. */
    accentBorder: string;
    /** The highlighter as a fill. Never text in the light theme. */
    mark: string;
    /** Text on `mark`. Near-black in both themes. */
    markInk: string;
    success: string;
    warning: string;
    danger: string;
    /** Categorical DATA colours, in fixed order (the knowledge graph's three
     * main kinds of page). They are for marks in a chart, never for text or
     * chrome. Each mode has its own step of the same three hues; the set is
     * validated for colour-vision deficiency on every pair, on the chart
     * surface of its mode (bgSunken), with the dataviz palette checker. Three
     * is the cap for a chart where any two marks can sit side by side: a
     * fourth kind is drawn in a neutral, not in a new hue. */
    series1: string;
    series2: string;
    series3: string;
    focus: string;
    scrim: string;
    skeleton: string;
  };
  font: {
    sans: string;
    serif: string;
    mono: string;
    sizes: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl', string>;
    weights: Record<'normal' | 'medium' | 'semibold' | 'bold', number>;
    leading: Record<'none' | 'tight' | 'snug' | 'normal' | 'relaxed', number>;
    tracking: Record<'tight' | 'normal' | 'wide' | 'wider', string>;
  };
  space: Record<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '12', string>;
  radius: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string>;
  shadow: Record<'sm' | 'md' | 'lg' | 'glow', string>;
  layout: {
    maxWidth: string;
    maxWidthProse: string;
    navHeight: string;
    gutter: string;
    /** Width of the margin column that holds section labels on wide screens. */
    marginCol: string;
  };
  breakpoint: Record<'sm' | 'md' | 'lg' | 'xl', string>;
  motion: {
    fast: string;
    base: string;
    slow: string;
    ease: string;
    easeOut: string;
  };
  z: Record<'nav' | 'dropdown' | 'overlay' | 'toast', number>;
}

/* The Plex files are self-hosted (public/fonts, declared in fonts.ts) and load
 * with font-display: swap, so the stacks below are what a visitor sees for the
 * first moments and whenever a font file fails. The second name in the sans
 * and serif stacks is a stand-in declared in fonts.ts: a font the visitor
 * already has, scaled to take the same room as Plex, so the swap does not
 * re-wrap the page. The generic families after it are the last resort. */
export const fontFamilySans =
  "'IBM Plex Sans', 'Plex Sans Fallback', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const fontFamilySerif =
  "'IBM Plex Serif', 'Plex Serif Fallback', 'Iowan Old Style', 'Palatino Linotype', Georgia, 'Times New Roman', serif";
export const fontFamilyMono =
  "'IBM Plex Mono', 'Plex Mono Fallback', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace";

/** Shared across themes: geometry and typography never flip with the theme. */
const shared = {
  font: {
    sans: fontFamilySans,
    serif: fontFamilySerif,
    mono: fontFamilyMono,
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.375rem',
      '2xl': '1.75rem',
      '3xl': '2.25rem',
      /* Page titles: fluid, so a long title is four lines on a phone, not six. */
      '4xl': 'clamp(2.125rem, 1.4rem + 3.2vw, 3rem)',
      '5xl': 'clamp(2.5rem, 6vw, 4.25rem)',
    },
    /* Two weights are shipped per family: 400 and 600. `medium` resolves to
     * the 400 file and `bold` to the 600 file (nearest available face, no
     * synthetic bolding), so the scale below is really two steps. */
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    leading: { none: 1, tight: 1.12, snug: 1.28, normal: 1.6, relaxed: 1.7 },
    tracking: { tight: '-0.012em', normal: '0', wide: '0.02em', wider: '0.06em' },
  },
  space: {
    '0': '0',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '5': '1.5rem',
    '6': '2rem',
    '7': '3rem',
    '8': '4rem',
    '9': '6rem',
    '10': '8rem',
    '12': '12rem',
  },
  /* Nearly square. `full` stays for things that are round by nature (a status
   * dot, a spinner), never for a label or a button. */
  radius: { sm: '2px', md: '2px', lg: '3px', xl: '4px', full: '9999px' },
  layout: {
    maxWidth: '78rem',
    maxWidthProse: '46rem',
    navHeight: '4.25rem',
    gutter: 'clamp(1.25rem, 5vw, 3rem)',
    marginCol: '13.5rem',
  },
  breakpoint: { sm: '480px', md: '768px', lg: '1024px', xl: '1280px' },
  motion: {
    fast: '120ms',
    base: '220ms',
    slow: '400ms',
    ease: 'cubic-bezier(0.2, 0, 0, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  z: { nav: 50, dropdown: 60, overlay: 80, toast: 90 },
} as const;

/* Night bench: a warm near-black page, paper-white ink, the same highlighter. */
export const darkTheme: Tokens = {
  ...shared,
  color: {
    bg: '#131311',
    bgElevated: '#1a1a17',
    bgSunken: '#0c0c0a',
    surface: '#1a1a17',
    surfaceHover: '#22221e',
    border: '#2d2c27',
    /* 3:1 on the page: this is the outline of inputs and icon buttons. */
    borderStrong: '#6a6965',
    rule: '#eceae2',
    text: '#eceae2',
    textMuted: '#aaa79b',
    textSubtle: '#8b887c',
    accent: '#eceae2',
    accentText: '#16161a',
    accentSoft: 'rgba(247, 208, 70, 0.18)',
    accentBorder: '#f7d046',
    mark: '#f7d046',
    markInk: '#16161a',
    success: '#5bd6a0',
    warning: '#f0b860',
    danger: '#ff8a80',
    series1: '#3987e5',
    series2: '#d95926',
    series3: '#199e70',
    focus: '#f7d046',
    scrim: 'rgba(6, 6, 5, 0.74)',
    skeleton: 'rgba(236, 234, 226, 0.07)',
  },
  shadow: {
    /* Nothing floats at rest. md/lg are for things that really are above the
     * page (the mobile menu, a popover). */
    sm: 'none',
    md: '0 8px 24px rgba(0, 0, 0, 0.5)',
    lg: '0 24px 64px rgba(0, 0, 0, 0.6)',
    glow: '0 0 0 2px #f7d046',
  },
};

/* Paper: an off-white page, white sheets on it, near-black ink. */
export const lightTheme: Tokens = {
  ...shared,
  color: {
    bg: '#fbfbf9',
    bgElevated: '#ffffff',
    bgSunken: '#f1f0eb',
    surface: '#ffffff',
    surfaceHover: '#f6f5f0',
    border: '#dcdad2',
    /* 3:1 on the page: this is the outline of inputs and icon buttons. */
    borderStrong: '#8f8d86',
    rule: '#16161a',
    text: '#16161a',
    textMuted: '#4a4a45',
    textSubtle: '#6b6a63',
    accent: '#16161a',
    accentText: '#ffffff',
    accentSoft: 'rgba(255, 214, 10, 0.3)',
    /* A shade deeper than `mark`, so a 2px underline holds up on paper. */
    accentBorder: '#eab700',
    mark: '#ffd60a',
    markInk: '#16161a',
    /* Status colours are text too (the share status, form errors): each is
     * >= 4.5:1 on bg and on white, checked by contrast.test.ts. */
    success: '#0b6b47',
    warning: '#8a5a00',
    danger: '#b3261e',
    series1: '#2a78d6',
    series2: '#eb6834',
    series3: '#1baf7a',
    focus: '#16161a',
    scrim: 'rgba(22, 22, 26, 0.5)',
    skeleton: 'rgba(22, 22, 26, 0.06)',
  },
  shadow: {
    sm: 'none',
    md: '0 1px 2px rgba(22, 22, 26, 0.06), 0 8px 24px rgba(22, 22, 26, 0.1)',
    lg: '0 24px 64px rgba(22, 22, 26, 0.18)',
    glow: '0 0 0 2px #ffd60a',
  },
};

/* --------------------------------------------------------------------------
 * The themes
 *
 * Two are written out by hand above and are the defaults: `light` ("Paper")
 * and `dark` ("Night"); the site follows the visitor's device between them
 * until they pick one. The rest are the same idea with other materials. Each
 * is three choices (a paper, an ink, a highlighter) and make-theme.ts derives
 * the rest, so a new theme is one line in RECIPES plus one in THEME_INFO, and
 * contrast.test.ts holds it to the same floors as the defaults.
 *
 * Ids are stored in the visitor's browser and written to <html data-theme>:
 * never rename one, and keep `dark` / `light` as the two defaults (older
 * stored preferences, the pre-paint script and the print styles rely on it).
 * -------------------------------------------------------------------------- */

export type ThemeName =
  | 'light'
  | 'legal'
  | 'ledger'
  | 'manila'
  | 'graph'
  | 'newsprint'
  | 'dark'
  | 'blueprint'
  | 'chalkboard'
  | 'phosphor'
  | 'graphite'
  | 'darkroom';

export interface ThemeInfo {
  id: ThemeName;
  /** The name a visitor sees in the picker. */
  label: string;
  /** Whether the page is light or dark: native controls, scrollbars and the
   * browser's own UI colour follow this. */
  mode: ThemeMode;
  /** What it is made of, in a few words. */
  note: string;
}

/** Every theme, in the order the picker lists them: papers, then boards. */
export const THEME_INFO: readonly ThemeInfo[] = [
  { id: 'light', label: 'Paper', mode: 'light', note: 'Off-white paper, black ink, yellow highlighter' },
  { id: 'legal', label: 'Legal pad', mode: 'light', note: 'Canary paper, blue-black ink, red pencil' },
  { id: 'ledger', label: 'Ledger', mode: 'light', note: 'Green-tint ledger paper, orange highlighter' },
  { id: 'manila', label: 'Manila', mode: 'light', note: 'Buff folder stock, sepia ink, coral pencil' },
  { id: 'graph', label: 'Graph', mode: 'light', note: 'Cool white, blue-black ink, green highlighter' },
  { id: 'newsprint', label: 'Newsprint', mode: 'light', note: 'Grey newsprint, black ink, pink highlighter' },
  { id: 'dark', label: 'Night', mode: 'dark', note: 'Warm black, paper-white ink, yellow highlighter' },
  { id: 'blueprint', label: 'Blueprint', mode: 'dark', note: 'Prussian blue, pale blue ink, amber marker' },
  { id: 'chalkboard', label: 'Chalkboard', mode: 'dark', note: 'Slate green, chalk white, pink chalk' },
  { id: 'phosphor', label: 'Phosphor', mode: 'dark', note: 'Black glass, green phosphor, amber marker' },
  { id: 'graphite', label: 'Graphite', mode: 'dark', note: 'Cool grey, white ink, cyan marker' },
  { id: 'darkroom', label: 'Darkroom', mode: 'dark', note: 'Safelight black, warm white, red marker' },
];

/** paper / ink / highlighter for every generated theme. */
export const RECIPES: Record<Exclude<ThemeName, 'dark' | 'light'>, ThemeRecipe> = {
  legal: { mode: 'light', paper: '#faf5d2', ink: '#1a2440', mark: '#ff8d7a' },
  ledger: { mode: 'light', paper: '#edf3e6', ink: '#16241c', mark: '#ffb347' },
  manila: { mode: 'light', paper: '#f3ead3', ink: '#2b1f14', mark: '#ff9a76' },
  graph: { mode: 'light', paper: '#f4f7fb', ink: '#13203b', mark: '#9be564' },
  newsprint: { mode: 'light', paper: '#e9e7e0', ink: '#141413', mark: '#ff9bcb' },
  blueprint: { mode: 'dark', paper: '#0f2542', ink: '#e4eefa', mark: '#ffd166' },
  chalkboard: { mode: 'dark', paper: '#1c2925', ink: '#eef1e8', mark: '#ffb3c8' },
  phosphor: { mode: 'dark', paper: '#0b100c', ink: '#c9f4cd', mark: '#ffb000' },
  graphite: { mode: 'dark', paper: '#1b1d21', ink: '#e9ecf1', mark: '#5fd4e6' },
  darkroom: { mode: 'dark', paper: '#170c0c', ink: '#f4e4df', mark: '#ff5e52' },
};

function generated(name: keyof typeof RECIPES): Tokens {
  return { ...shared, ...makePalette(RECIPES[name]) };
}

export const themes: Record<ThemeName, Tokens> = {
  light: lightTheme,
  legal: generated('legal'),
  ledger: generated('ledger'),
  manila: generated('manila'),
  graph: generated('graph'),
  newsprint: generated('newsprint'),
  dark: darkTheme,
  blueprint: generated('blueprint'),
  chalkboard: generated('chalkboard'),
  phosphor: generated('phosphor'),
  graphite: generated('graphite'),
  darkroom: generated('darkroom'),
};

export const THEME_NAMES: readonly ThemeName[] = THEME_INFO.map((theme) => theme.id);

const INFO_BY_ID = new Map<string, ThemeInfo>(THEME_INFO.map((theme) => [theme.id, theme]));

/** Narrowing guard for anything read from storage, a URL or the DOM. Uses a
 * Map lookup, so inherited object keys ("constructor") are never themes. */
export function isKnownTheme(value: unknown): value is ThemeName {
  return typeof value === 'string' && INFO_BY_ID.has(value);
}

export function themeInfo(name: ThemeName): ThemeInfo {
  return INFO_BY_ID.get(name) as ThemeInfo;
}

/** 'light' or 'dark' for a theme: what `color-scheme` should be under it. */
export function themeMode(name: ThemeName): ThemeMode {
  return themeInfo(name).mode;
}

/** id -> mode for every theme: the table the pre-paint script carries, so it
 * can validate a stored id and set `color-scheme` before the app loads. */
export const THEME_MODES: Readonly<Record<ThemeName, ThemeMode>> = Object.fromEntries(
  THEME_INFO.map((theme) => [theme.id, theme.mode]),
) as Record<ThemeName, ThemeMode>;

/**
 * CSS custom properties mirroring the theme, emitted by <Global>. Useful for
 * anything outside React (prerender placeholder states, `prefers-color-scheme`
 * in the static shell before hydration).
 */
export function themeToCssVars(theme: Tokens, prefix = '--'): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme.color)) {
    vars[`${prefix}c-${kebab(key)}`] = value;
  }
  for (const [key, value] of Object.entries(theme.space)) {
    vars[`${prefix}s-${key}`] = value;
  }
  for (const [key, value] of Object.entries(theme.radius)) {
    vars[`${prefix}r-${key}`] = value;
  }
  for (const [key, value] of Object.entries(theme.shadow)) {
    vars[`${prefix}sh-${kebab(key)}`] = value;
  }
  vars[`${prefix}font-sans`] = theme.font.sans;
  vars[`${prefix}font-serif`] = theme.font.serif;
  vars[`${prefix}font-mono`] = theme.font.mono;
  return vars;
}

/**
 * Only what differs from theme to theme: the colours and the shadows. This is
 * what a `[data-theme=…]` block carries; spacing, radii and fonts are the
 * same in every theme and live on :root once.
 */
export function themeColorVars(theme: Tokens, prefix = '--'): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme.color)) {
    vars[`${prefix}c-${kebab(key)}`] = value;
  }
  for (const [key, value] of Object.entries(theme.shadow)) {
    vars[`${prefix}sh-${kebab(key)}`] = value;
  }
  return vars;
}

function kebab(input: string): string {
  return input.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/* --------------------------------------------------------------------------
 * Where a theme's colours live
 *
 * The stylesheet in every page carries exactly two palettes: Night on :root
 * (what a page shows with no script at all) and Paper under
 * [data-theme=light]. Carrying all twelve would add about 10 kB to every
 * page's HTML for palettes almost no visitor is using.
 *
 * Every other theme is applied as custom properties set on <html> itself:
 * by the pre-paint script (public/theme-init.js, which has the same table)
 * when the visitor has one stored, and by the app when they pick one. Inline
 * properties beat the stylesheet's, so nothing else has to know.
 * -------------------------------------------------------------------------- */

/** The theme whose values :root carries. */
export const STYLESHEET_ROOT_THEME: ThemeName = 'dark';

/** The themes the stylesheet itself holds; all others are inline variables. */
export const STYLESHEET_THEMES: readonly ThemeName[] = ['dark', 'light'];

/** The custom properties that differ between themes: the same names in every theme. */
export const THEME_VAR_NAMES: readonly string[] = Object.keys(themeColorVars(darkTheme));

/**
 * The inline custom properties a theme is applied with, or `null` for the two
 * themes the stylesheet already holds.
 */
export function themeInlineVars(name: ThemeName): Record<string, string> | null {
  return STYLESHEET_THEMES.includes(name) ? null : themeColorVars(themes[name]);
}

/** Every inline-applied theme's variables by id: the table the pre-paint script carries. */
export const THEME_INLINE_VARS: Readonly<Record<string, Record<string, string>>> = Object.fromEntries(
  THEME_NAMES.filter((name) => !STYLESHEET_THEMES.includes(name)).map((name) => [name, themeColorVars(themes[name])]),
);

/** The part of an element's inline style this module writes to. */
export interface ThemeVarTarget {
  setProperty?: (name: string, value: string) => void;
  removeProperty?: (name: string) => unknown;
}

/**
 * Put `name`'s colours in force on an element's inline style (in the app:
 * <html>). The previous theme's variables are cleared first, so moving to one
 * of the two stylesheet themes leaves no inline colour behind.
 */
export function applyThemeVars(style: ThemeVarTarget | null | undefined, name: ThemeName): void {
  if (!style || typeof style.setProperty !== 'function' || typeof style.removeProperty !== 'function') return;
  for (const key of THEME_VAR_NAMES) style.removeProperty(key);
  const vars = themeInlineVars(name);
  if (!vars) return;
  for (const [key, value] of Object.entries(vars)) style.setProperty(key, value);
}

/* --------------------------------------------------------------------------
 * FOUC-proof token refs (R2C-5)
 *
 * The static HTML paints BEFORE any module runs, so components must not bake
 * palette hexes into their serialized CSS — the prerenderer can only know the
 * dark default, and light-preference users would flash. Instead the live app
 * (server AND client — identical output, hydration-stable) interpolates these
 * `var(--c-*, fallback)` refs, while global styles define the palettes as CSS
 * custom properties on :root (dark) and [data-theme='light'] (light). The
 * pre-paint theme-init script flips the attribute, so the resolved colors are
 * correct at first frame with zero React involvement.
 *
 * `darkTheme`/`lightTheme` keep their concrete hexes — they remain the source
 * of truth for the contrast gate, token tests, and any test that renders with
 * a raw palette.
 * -------------------------------------------------------------------------- */

/** Concrete palette values expressed as CSS custom-property refs. Values match
 * `themeToCssVars` keys exactly; fallbacks mirror the :root defaults. */
export const colorVarRefs: Tokens['color'] = Object.fromEntries(
  (Object.keys(darkTheme.color) as (keyof Tokens['color'])[]).map((k) => [
    k,
    `var(--c-${kebab(k)}, ${darkTheme.color[k]})`,
  ]),
) as Tokens['color'];

export const shadowVarRefs: Tokens['shadow'] = Object.fromEntries(
  (Object.keys(darkTheme.shadow) as (keyof Tokens['shadow'])[]).map((k) => [
    k,
    `var(--sh-${kebab(k)}, ${darkTheme.shadow[k]})`,
  ]),
) as Tokens['shadow'];

/** The theme object components render against: identical object identity
 * regardless of active palette (CSS variables carry the difference). */
export const appTokens: Tokens = {
  ...darkTheme,
  color: colorVarRefs,
  shadow: shadowVarRefs,
};

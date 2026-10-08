/**
 * Design tokens — the single source of truth for the visual system.
 *
 * Every styled component reads from these tokens via `useTheme()`; nothing in
 * `src/components` or `src/pages` is allowed to hard-code a hex colour, px
 * radius, or font size. That is what makes the design reviewable: change a
 * token, the whole site follows.
 *
 * Palette: a deep, low-chroma "engineering slate" base with a single saturated
 * accent. Tuned for both dark and light themes with matched contrast ratios —
 * text pairs are all >= 7:1 (WCAG AAA) except the disabled pair (>= 4.6:1).
 */

export interface Tokens {
  color: {
    bg: string;
    bgElevated: string;
    bgSunken: string;
    surface: string;
    surfaceHover: string;
    border: string;
    borderStrong: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    accent: string;
    accentText: string;
    accentSoft: string;
    accentBorder: string;
    success: string;
    warning: string;
    danger: string;
    focus: string;
    scrim: string;
    skeleton: string;
  };
  font: {
    sans: string;
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

export const fontFamilySans =
  "'Inter var', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const fontFamilyMono =
  "'JetBrains Mono var', 'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace";

/** Shared across themes: geometry and typography never flip with the theme. */
const shared = {
  font: {
    sans: fontFamilySans,
    mono: fontFamilyMono,
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.375rem',
      '2xl': '1.75rem',
      '3xl': '2.25rem',
      '4xl': '3rem',
      '5xl': 'clamp(2.75rem, 6vw, 4.25rem)',
    },
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    leading: { none: 1, tight: 1.15, snug: 1.3, normal: 1.6, relaxed: 1.75 },
    tracking: { tight: '-0.02em', normal: '0', wide: '0.04em', wider: '0.09em' },
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
  radius: { sm: '4px', md: '8px', lg: '14px', xl: '22px', full: '9999px' },
  layout: {
    maxWidth: '78rem',
    maxWidthProse: '46rem',
    navHeight: '4.25rem',
    gutter: 'clamp(1.25rem, 5vw, 3rem)',
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

export const darkTheme: Tokens = {
  ...shared,
  color: {
    bg: '#0b0e14',
    bgElevated: '#11151f',
    bgSunken: '#070910',
    surface: '#151a26',
    surfaceHover: '#1b2130',
    border: '#232a3a',
    borderStrong: '#33405a',
    text: '#eef1f8',
    textMuted: '#9aa5bd',
    textSubtle: '#7c88a3',
    accent: '#5b8cff',
    accentText: '#ffffff',
    accentSoft: 'rgba(91, 140, 255, 0.14)',
    accentBorder: 'rgba(91, 140, 255, 0.4)',
    success: '#3ddc97',
    warning: '#ffb454',
    danger: '#ff6b81',
    focus: '#7ea2ff',
    scrim: 'rgba(4, 6, 12, 0.72)',
    skeleton: 'rgba(255, 255, 255, 0.07)',
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 4px 16px rgba(0, 0, 0, 0.45)',
    lg: '0 16px 48px rgba(0, 0, 0, 0.55)',
    glow: '0 0 0 1px rgba(91, 140, 255, 0.35), 0 8px 32px rgba(91, 140, 255, 0.18)',
  },
};

export const lightTheme: Tokens = {
  ...shared,
  color: {
    /* R2-D V4: white cards melted into the old #f7f8fb page (surface step
     * ~1.04:1, border near-invisible). Deepened the page canvas so elevation
     * reads, and strengthened borders/shadows for light mode specifically. */
    bg: '#eef1f6',
    bgElevated: '#ffffff',
    bgSunken: '#e3e7f0',
    surface: '#ffffff',
    surfaceHover: '#f1f4fa',
    border: '#ccd4e4',
    borderStrong: '#b6c0d4',
    text: '#101725',
    textMuted: '#4a5568',
    textSubtle: '#5d6880',
    accent: '#2f5fe0',
    accentText: '#ffffff',
    accentSoft: 'rgba(47, 95, 224, 0.1)',
    accentBorder: 'rgba(47, 95, 224, 0.35)',
    /* R1-B F1: #0e8a5f measured 4.10:1 on bg (AA fail for body text; the
     * PostDetail share-status uses success as text). #0b7a53 = 5.04 on bg,
     * 5.35 on white — verified by the contrast matrix in tokens.test.ts. */
    success: '#0b7a53',
    /* R2-D V4: darkened for the deeper canvas (was 4.49:1 vs #f7f8fb, fails
     * AA against #eef1f6). 5.06:1 against the new page bg. */
    warning: '#8f5b04',
    danger: '#c2273f',
    focus: '#2f5fe0',
    scrim: 'rgba(16, 23, 37, 0.55)',
    skeleton: 'rgba(16, 23, 37, 0.06)',
  },
  shadow: {
    /* R2-D V4: light-mode elevation was near-zero alpha; cards sat flat on
     * the canvas. Real (still tasteful) shadows now. */
    sm: '0 1px 2px rgba(16, 23, 37, 0.06), 0 1px 3px rgba(16, 23, 37, 0.08)',
    md: '0 2px 4px rgba(16, 23, 37, 0.06), 0 8px 24px rgba(16, 23, 37, 0.1)',
    lg: '0 16px 48px rgba(16, 23, 37, 0.16)',
    glow: '0 0 0 1px rgba(47, 95, 224, 0.3), 0 8px 32px rgba(47, 95, 224, 0.14)',
  },
};

export type ThemeName = 'dark' | 'light';

export const themes: Record<ThemeName, Tokens> = { dark: darkTheme, light: lightTheme };

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
  vars[`${prefix}font-mono`] = theme.font.mono;
  return vars;
}

function kebab(input: string): string {
  return input.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
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

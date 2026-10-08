/**
 * The ONE source of truth for global CSS.
 *
 * Both <AppThemeProvider> (via Emotion <Global>) and the prerenderer call
 * `buildGlobalStyles(theme)`; whatever the browser gets at prerender time is
 * exactly what hydration re-registers, so there is no first-paint flash and
 * no style drift between the static shell and the live app.
 *
 * Returns a plain object for `<Global styles={...} />` (vendored Emotion
 * serializes camelCase keys and nested selectors; `--custom-properties` pass
 * through untouched via camelToKebab).
 */

import type { CSSProperties } from 'react';
import { darkTheme, lightTheme, themeToCssVars, type Tokens } from 'app/theme/tokens';

/** Style-object shape accepted by the vendored Emotion <Global>. */
export type StyleLeaf = string | number;
export type GlobalStylesObject = Record<string, Record<string, StyleLeaf | Record<string, StyleLeaf>>>;

export function buildGlobalStyles(theme: Tokens): GlobalStylesObject {
  const cssVars = themeToCssVars(theme) as Record<string, string>;

  return {
    /* Modern reset ------------------------------------------------------- */
    '*, *::before, *::after': {
      boxSizing: 'border-box',
    },
    html: {
      WebkitTextSizeAdjust: '100%',
      textSizeAdjust: '100%',
      /**
       * Colour-scheme is also set imperatively by ThemeProvider (and by the
       * init script before paint) so native form controls/scrollbars flip;
       * the static value here covers the prerender shell.
       */
      colorScheme: 'dark light',
      scrollBehavior: 'smooth',
    },
    body: {
      margin: 0,
      minHeight: '100vh',
      /* R2C-5: var() refs (dark fallback) so the pre-paint [data-theme] flip
       * resolves the right palette at frame one — no dark shell for light users. */
      background: `var(--c-bg, ${theme.color.bg})`,
      color: `var(--c-text, ${theme.color.text})`,
      fontFamily: theme.font.sans,
      fontSize: theme.font.sizes.md,
      lineHeight: theme.font.leading.normal,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility',
    },
    h1: { fontSize: theme.font.sizes['4xl'], lineHeight: theme.font.leading.tight, margin: 0 },
    h2: { fontSize: theme.font.sizes['3xl'], lineHeight: theme.font.leading.tight, margin: 0 },
    h3: { fontSize: theme.font.sizes['2xl'], lineHeight: theme.font.leading.snug, margin: 0 },
    h4: { fontSize: theme.font.sizes.xl, lineHeight: theme.font.leading.snug, margin: 0 },
    p: { marginTop: 0, marginBottom: '1em' },
    a: {
      color: 'var(--c-accent, ' + theme.color.accent + ')',
      textDecorationColor: 'var(--c-accentBorder, ' + theme.color.accentBorder + ')',
      textDecorationThickness: 'from-font',
    },
    'a:hover': {
      textDecoration: 'underline',
    },
    code,
    kbd,
    pre,
    img,
    svg,
    video,
    'input, button, textarea, select': {
      font: 'inherit',
      color: 'inherit',
    },
    button: { cursor: 'pointer', background: 'none', border: 'none', padding: 0 },
    table: { borderCollapse: 'collapse', borderSpacing: 0 },
    hr: {
      border: 'none',
      borderTop: '1px solid var(--c-border, ' + theme.color.border + ')',
      margin: `${theme.space[6]} 0`,
    },

    /* Custom properties --------------------------------------------------- */
    /* R2C-5 (FOUC): :root carries the *rendered* palette's concrete values
     * (prerender/hydration parity), and BOTH data-theme blocks ship in the
     * same sheet so the pre-paint theme-init attribute flip resolves every
     * `var(--c-*)` component reference to the right palette at frame one —
     * no React, no module execution, no flash. */
    ':root': cssVars,
    /* R3-A #1: UNQUOTED attribute values — `dark`/`light` are valid CSS
     * identifiers, so no quoting is needed and the vendored serializer's
     * quote-escaping can't corrupt the selector (quoted forms serialize to
     * `[data-theme=\'dark\']`, which per CSS Syntax matches the literal
     * string "'dark'" — broken in spec-strict engines). */
    ':root[data-theme=dark]': themeToCssVars(darkTheme) as Record<string, string>,
    ':root[data-theme=light]': themeToCssVars(lightTheme) as Record<string, string>,

    /* Focus: visible by DEFAULT (contract §5). We style :focus-visible and
     * deliberately do NOT remove :focus outlines for pointer users on
     * controls that can't match focus-visible — the browser default stays. */
    ':focus-visible': {
      outline: '2px solid var(--c-focus, ' + theme.color.focus + ')',
      outlineOffset: '2px',
      borderRadius: theme.radius.sm,
    },

    /* Selection ------------------------------------------------------------ */
    '::selection': {
      background: 'var(--c-accentSoft, ' + theme.color.accentSoft + ')',
      color: 'var(--c-text, ' + theme.color.text + ')',
    },

    /* Reduced motion: global guard (contract §5). Components should still
     * honour useReducedMotion() for behaviour; this backstops CSS animation.
     * !important is load-bearing (R1-B L1, live-Chromium probe): component
     * @keyframes/scroll-behavior declarations (Spinner.ui-pulse, html smooth
     * scroll) otherwise win on specificity and keep animating. This mirrors
     * the standard reduced-motion kill-switch reset for the same reason. */
    '@media (prefers-reduced-motion: reduce)': {
      '*, *::before, *::after': {
        animationDuration: '0.01ms !important',
        animationIterationCount: '1 !important',
        transitionDuration: '0.01ms !important',
        scrollBehavior: 'auto !important',
      },
    },
  };
}

/* Media/typography defaults hoisted to keep the function readable. */
const monoStack =
  "'JetBrains Mono var', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const code: Record<string, string | number> = {
  fontFamily: monoStack,
  fontSize: '0.9375em',
  background: 'var(--c-bg-sunken, rgba(127,127,127,0.12))',
  padding: '0.125em 0.3em',
  borderRadius: '4px',
};
const kbd: Record<string, string | number> = {
  fontFamily: monoStack,
  fontSize: '0.875em',
  border: '1px solid var(--c-border, #888)',
  borderRadius: '4px',
  padding: '0.1em 0.35em',
};
const pre: Record<string, string | number> = {
  margin: '0',
  overflowX: 'auto',
  fontFamily: monoStack,
  lineHeight: '1.6',
};
const img: Record<string, string | number> = {
  maxWidth: '100%',
  height: 'auto',
  display: 'block',
};
const svg: Record<string, string | number> = { display: 'block', fill: 'currentColor' };
const video: Record<string, string | number> = { maxWidth: '100%', height: 'auto', display: 'block' };

/** Typed convenience: what you'd spread into CSSProperties if using inline styles (rare). */
export type GlobalCssVars = Record<`--${string}`, string> & CSSProperties;

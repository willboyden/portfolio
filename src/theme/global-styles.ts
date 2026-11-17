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
import {
  fontFamilyMono,
  lightTheme,
  STYLESHEET_THEMES,
  themeColorVars,
  themes,
  themeToCssVars,
  type Tokens,
} from 'app/theme/tokens';

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
    /* Headings are the serif voice everywhere, including page-level styled
     * h2/h3 that only set a size: they inherit the family and weight from here. */
    'h1, h2, h3, h4': {
      fontFamily: theme.font.serif,
      fontWeight: theme.font.weights.semibold,
      letterSpacing: theme.font.tracking.tight,
      margin: 0,
    },
    h1: { fontSize: theme.font.sizes['4xl'], lineHeight: theme.font.leading.tight },
    h2: { fontSize: theme.font.sizes['3xl'], lineHeight: theme.font.leading.tight },
    h3: { fontSize: theme.font.sizes['2xl'], lineHeight: theme.font.leading.snug },
    h4: { fontSize: theme.font.sizes.xl, lineHeight: theme.font.leading.snug },
    p: { marginTop: 0, marginBottom: '1em' },
    /* A link is ink with a highlighter underline: the underline, not a hue,
     * is what marks it. Components that are links but look like something
     * else (nav items, buttons, titles) switch the underline off themselves. */
    a: {
      color: 'var(--c-accent, ' + theme.color.accent + ')',
      textDecorationLine: 'underline',
      textDecorationColor: 'var(--c-accent-border, ' + theme.color.accentBorder + ')',
      textDecorationThickness: '2px',
      textUnderlineOffset: '0.2em',
    },
    'a:hover': {
      textDecorationColor: 'var(--c-accent, ' + theme.color.accent + ')',
    },
    /* <mark>: the highlighter, used for one phrase or one number at a time. */
    mark: {
      background: 'var(--c-mark, ' + theme.color.mark + ')',
      color: 'var(--c-mark-ink, ' + theme.color.markInk + ')',
      padding: '0 0.14em',
      margin: '0 -0.06em',
      WebkitBoxDecorationBreak: 'clone',
      boxDecorationBreak: 'clone',
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
    /* R3-A #1: UNQUOTED attribute values — theme ids are valid CSS
     * identifiers, so no quoting is needed and the vendored serializer's
     * quote-escaping can't corrupt the selector (quoted forms serialize to
     * `[data-theme=\'dark\']`, which per CSS Syntax matches the literal
     * string "'dark'" — broken in spec-strict engines).
     *
     * R3C-12: one block per STYLESHEET theme (Night, Paper) except the
     * rendered one. `:root` already carries the rendered palette's concrete
     * values, so its own block would re-declare them byte for byte; an
     * attribute that matches no block simply falls through to `:root`. Each
     * block holds only what differs between themes (colours and shadows).
     *
     * The other themes are NOT here: they are applied as inline custom
     * properties on <html> (tokens.ts: applyThemeVars; the pre-paint script
     * has the same table), which keeps ten palettes out of every page. */
    ...Object.fromEntries(
      STYLESHEET_THEMES.filter((name) => themes[name] !== theme).map((name) => [
        `:root[data-theme=${name}]`,
        themeColorVars(themes[name]) as Record<string, string>,
      ]),
    ),

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
      background: 'var(--c-mark, ' + theme.color.mark + ')',
      color: 'var(--c-mark-ink, ' + theme.color.markInk + ')',
    },

    /* R6-B: every pressable control gets physical press feedback. Sites
     * with hover-only affordances feel dead on touch screens — a 1px
     * translate reads as "the button registered the touch". The global
     * reduced-motion guard below zeroes the transition, and :active is
     * transient by nature, so no extra guard is needed. */
    'button:not(:disabled):active': {
      transform: 'translateY(1px)',
    },

    /* R7B-3: remove default mobile tap highlight color on rounded cards */
    'a, button, [role="button"]': {
      WebkitTapHighlightColor: 'transparent',
    },

    /* R7A-1: the prerenderer emits a static nav for no-JS visitors; it is
     * revealed ONLY by the <noscript> style block in the prerendered head.
     * JS users get the interactive nav — never a double nav. */
    '.static-mobile-nav': {
      display: 'none',
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

    /* R8D-2: printing a dark-theme page produced a ~blank sheet — browsers
     * strip backgrounds, and the dark palette's near-white ink on white paper
     * is invisible. Force the LIGHT palette's concrete variables inside the
     * print media, whatever the visitor's live theme; hide interactive
     * chrome; keep headings with their content; reveal external link
     * destinations (R8D-8). */
    '@media print': {
      ':root': themeToCssVars(lightTheme) as Record<string, StyleLeaf>,
      /* !important: a theme applied as inline custom properties on <html>
       * would otherwise outrank this block, and a dark one prints blank. */
      '[data-theme]': Object.fromEntries(
        Object.entries(themeColorVars(lightTheme)).map(([key, value]) => [key, `${value} !important`]),
      ) as Record<string, StyleLeaf>,
      '[data-testid="menu-button"], [data-testid="back-to-top"], [data-testid="theme-toggle"], [data-testid="skip-link"]':
        {
          display: 'none',
        },
      'h1, h2, h3': {
        breakAfter: 'avoid-page',
      },
      'p, li': {
        orphans: 3,
        widows: 3,
      },
      'a[href^="http"]::after': {
        content: '" (" attr(href) ")"',
        fontSize: '0.85em',
        color: theme.color.textSubtle,
      },
    },
  };
}

/* Media/typography defaults hoisted to keep the function readable. */
const monoStack = fontFamilyMono;
const code: Record<string, string | number> = {
  fontFamily: monoStack,
  fontSize: '0.9em',
  background: 'var(--c-bg-sunken, rgba(127,127,127,0.12))',
  padding: '0.1em 0.3em',
  borderRadius: '2px',
};
const kbd: Record<string, string | number> = {
  fontFamily: monoStack,
  fontSize: '0.875em',
  border: '1px solid var(--c-border, #888)',
  borderRadius: '2px',
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

/**
 * Theme generator: a whole palette from three choices.
 *
 * Every theme on the site is the same idea with different materials: a paper,
 * an ink, and one highlighter. A recipe names those three colours and whether
 * the paper is light or dark; `makePalette` derives everything else the same
 * way for every theme (rules, muted text, sunken wells, status colours), and
 * it does not hope for legibility, it enforces it: a derived text colour is
 * stepped toward the ink until it clears its contrast floor on the worst
 * surface it is used on. contrast.test.ts then gates every theme anyway.
 *
 * No imports with runtime effect: tokens.ts builds its themes with this at
 * module load, on the server and in the browser alike.
 */
import type { Tokens } from './tokens';

export type ThemeMode = 'light' | 'dark';

export interface ThemeRecipe {
  mode: ThemeMode;
  /** The page. */
  paper: string;
  /** Text, links, rules, buttons. */
  ink: string;
  /** The highlighter: a fill behind ink-coloured text. */
  mark: string;
}

type Rgb = readonly [number, number, number];

function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`make-theme: expected a #rrggbb colour, got ${JSON.stringify(hex)}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** `amount` of `b` mixed into `a` (0 = a, 1 = b), per sRGB channel. */
export function mix(a: string, b: string, amount: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex([x[0] + (y[0] - x[0]) * amount, x[1] + (y[1] - x[1]) * amount, x[2] + (y[2] - x[2]) * amount]);
}

function luminance(hex: string): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio of two opaque colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `color`, moved toward `toward` in small steps until it reaches `floor`
 * against every surface in `on`. Returns `toward` itself if nothing less will
 * do (the ink always clears the floors a recipe is accepted with).
 */
export function withContrast(color: string, on: readonly string[], floor: number, toward: string): string {
  const clears = (c: string): boolean => on.every((surface) => contrast(c, surface) >= floor);
  for (let step = 0; step <= 50; step += 1) {
    const candidate = mix(color, toward, step / 50);
    if (clears(candidate)) return candidate;
  }
  return toward;
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Text on the highlighter: near-black or white, whichever reads better. */
export function inkOn(fill: string): string {
  const dark = '#16161a';
  const light = '#ffffff';
  return contrast(dark, fill) >= contrast(light, fill) ? dark : light;
}

/* Status and data colours start from one step per mode; status colours are
 * then pushed until they are readable as text on this theme's own surfaces. */
const STATUS = {
  light: { success: '#0b6b47', warning: '#8a5a00', danger: '#b3261e' },
  dark: { success: '#5bd6a0', warning: '#f0b860', danger: '#ff8a80' },
} as const;

/* The three categorical data colours (see Tokens.color.series1): the light
 * and dark steps of the same hues, validated as a set on every pair. */
export const SERIES = {
  light: { series1: '#2a78d6', series2: '#eb6834', series3: '#1baf7a' },
  dark: { series1: '#3987e5', series2: '#d95926', series3: '#199e70' },
} as const;

const BODY = 4.5;

export function makePalette(recipe: ThemeRecipe): Pick<Tokens, 'color' | 'shadow'> {
  const { mode, paper, ink, mark } = recipe;
  const light = mode === 'light';

  const bg = paper;
  const surface = light ? mix(paper, '#ffffff', 0.65) : mix(paper, ink, 0.035);
  const bgSunken = light ? mix(paper, ink, 0.045) : mix(paper, '#000000', 0.35);
  const surfaceHover = light ? mix(paper, ink, 0.025) : mix(paper, ink, 0.07);
  const surfaces = [bg, surface, bgSunken];

  /* Muted text reads comfortably (7:1) on the page and holds body contrast in
   * a sunken well; subtle text is the quietest text allowed, at body contrast
   * everywhere. Both start from a fixed mix so the steps look alike across
   * themes, then move toward the ink only as far as they must. */
  const textMuted = withContrast(mix(ink, paper, light ? 0.24 : 0.3), [bg, surface], 7, ink);
  const textSubtle = withContrast(mix(ink, paper, light ? 0.4 : 0.45), surfaces, BODY + 0.1, ink);

  const status = STATUS[mode];
  const readable = (c: string): string => withContrast(c, surfaces, BODY + 0.1, ink);

  const markInk = inkOn(mark);
  /* On paper the highlighter is too light to be a line by itself, so the
   * underline is a shade deeper; on a dark page it is bright enough as it is. */
  const accentBorder = light ? mix(mark, ink, 0.1) : mark;
  /* The focus ring must stand out from the page (3:1): the highlighter where
   * it is strong enough to, the ink otherwise. */
  const focus = contrast(mark, bg) >= 3 && contrast(mark, surface) >= 3 ? mark : ink;

  return {
    color: {
      bg,
      bgElevated: surface,
      bgSunken,
      surface,
      surfaceHover,
      border: mix(paper, ink, light ? 0.13 : 0.12),
      /* The outline of inputs and icon buttons: a control's edge must reach
       * 3:1 against the page (WCAG 1.4.11). */
      borderStrong: withContrast(mix(paper, ink, light ? 0.36 : 0.27), [bg, surface], 3.05, ink),
      rule: ink,
      text: ink,
      textMuted,
      textSubtle,
      accent: ink,
      accentText: inkOn(ink),
      accentSoft: rgba(mark, light ? 0.3 : 0.18),
      accentBorder,
      mark,
      markInk,
      success: readable(status.success),
      warning: readable(status.warning),
      danger: readable(status.danger),
      ...SERIES[mode],
      focus,
      scrim: light ? rgba(ink, 0.5) : rgba(mix(paper, '#000000', 0.6), 0.74),
      skeleton: rgba(ink, light ? 0.06 : 0.07),
    },
    shadow: light
      ? {
          sm: 'none',
          md: `0 1px 2px ${rgba(ink, 0.06)}, 0 8px 24px ${rgba(ink, 0.1)}`,
          lg: `0 24px 64px ${rgba(ink, 0.18)}`,
          glow: `0 0 0 2px ${mark}`,
        }
      : {
          sm: 'none',
          md: '0 8px 24px rgba(0, 0, 0, 0.5)',
          lg: '0 24px 64px rgba(0, 0, 0, 0.6)',
          glow: `0 0 0 2px ${mark}`,
        },
  };
}

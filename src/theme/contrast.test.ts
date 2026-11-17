/**
 * Contrast gate (R1-B F6).
 *
 * R1-B found textSubtle failing AA on every surface in BOTH themes and light
 * `success` failing as body text — shipped because nothing measured ratios.
 * This test computes WCAG 2.x relative luminance from the actual tokens and
 * asserts the curated fg/bg pairs used by real components. If you change a
 * token, this test decides whether it ships.
 */
import { describe, expect, it } from 'vitest';
import { THEME_INFO, themes, type Tokens } from './tokens';

/* ---- WCAG 2.x contrast math (from the spec, not eyeballed) -------------- */

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function parseColor(css: string): { r: number; g: number; b: number; a: number } | null {
  const hex = css.match(/^#([0-9a-f]{6})$/i);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgb = css.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+\s*([\d.]+%?))?\s*\)$/i);
  if (rgb?.[1] && rgb[2] && rgb[3]) {
    let a = rgb[4] === undefined ? 1 : parseFloat(rgb[4]);
    if (rgb[4]?.endsWith('%')) a /= 100;
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a };
  }
  return null;
}

/** Composite a translucent fg over an opaque bg (sRGB, per compositing). */
function composite(
  fg: { r: number; g: number; b: number; a: number },
  bg: { r: number; g: number; b: number; a: number },
) {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

export function contrastRatio(fgCss: string, bgCss: string): number {
  const fgRaw = parseColor(fgCss);
  const bg = parseColor(bgCss);
  if (!bg || bg.a !== 1) throw new Error(`background must be opaque: ${bgCss}`);
  if (!fgRaw) throw new Error(`unparseable color: ${fgCss}`);
  const fg = fgRaw.a < 1 ? composite(fgRaw, bg) : fgRaw;
  const lum = (c: { r: number; g: number; b: number }) =>
    0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b);
  const sorted = [lum(fg), lum(bg)].sort((a, b) => b - a);
  const l1 = sorted[0] as number;
  const l2 = sorted[1] as number;
  return (l1 + 0.05) / (l2 + 0.05);
}

/** A translucent fill as it actually lands on an opaque surface. */
export function flattened(fillCss: string, surfaceCss: string): string {
  const fill = parseColor(fillCss);
  const surface = parseColor(surfaceCss);
  if (!fill || !surface) throw new Error(`unparseable color: ${fillCss} / ${surfaceCss}`);
  const c = composite(fill, surface);
  return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
}

/* ---- The pairs real components render ------------------------------------ */

type Pair = { name: string; fg: (t: Tokens) => string; bg: (t: Tokens) => string; min?: number };

const BODY = 4.5; // WCAG 1.4.3 AA, normal text
const LARGE_OR_UI = 3.0; // 1.4.11 non-text / large text

const PAIRS: Pair[] = [
  // Body copy on every surface family
  { name: 'text/bg', fg: (t) => t.color.text, bg: (t) => t.color.bg },
  { name: 'text/surface', fg: (t) => t.color.text, bg: (t) => t.color.surface },
  { name: 'text/bgElevated', fg: (t) => t.color.text, bg: (t) => t.color.bgElevated },
  { name: 'text/bgSunken', fg: (t) => t.color.text, bg: (t) => t.color.bgSunken },
  { name: 'textMuted/bg', fg: (t) => t.color.textMuted, bg: (t) => t.color.bg },
  { name: 'textMuted/surface', fg: (t) => t.color.textMuted, bg: (t) => t.color.surface },
  { name: 'textMuted/bgElevated', fg: (t) => t.color.textMuted, bg: (t) => t.color.bgElevated },
  { name: 'textMuted/bgSunken', fg: (t) => t.color.textMuted, bg: (t) => t.color.bgSunken },
  // R1-B F2: textSubtle carries footer copyright, dialog hint, pagination labels
  { name: 'textSubtle/bg', fg: (t) => t.color.textSubtle, bg: (t) => t.color.bg },
  { name: 'textSubtle/surface', fg: (t) => t.color.textSubtle, bg: (t) => t.color.surface },
  { name: 'textSubtle/bgElevated', fg: (t) => t.color.textSubtle, bg: (t) => t.color.bgElevated },
  { name: 'textSubtle/bgSunken', fg: (t) => t.color.textSubtle, bg: (t) => t.color.bgSunken },
  // Accent as link/label text
  { name: 'accent/bg', fg: (t) => t.color.accent, bg: (t) => t.color.bg },
  { name: 'accent/surface', fg: (t) => t.color.accent, bg: (t) => t.color.surface },
  // Semantic status text (PostDetail share status uses success; Contact uses danger)
  { name: 'success/bg', fg: (t) => t.color.success, bg: (t) => t.color.bg },
  { name: 'success/surface', fg: (t) => t.color.success, bg: (t) => t.color.surface },
  { name: 'warning/bg', fg: (t) => t.color.warning, bg: (t) => t.color.bg },
  { name: 'danger/bgElevated', fg: (t) => t.color.danger, bg: (t) => t.color.bgElevated },
  // Primary button fill pair + wordmark (R1-B F5)
  { name: 'bg/accent (primary btn)', fg: (t) => t.color.bg, bg: (t) => t.color.accent },
  // Focus ring against page backgrounds (non-text)
  { name: 'focus/bg', fg: (t) => t.color.focus, bg: (t) => t.color.bg, min: LARGE_OR_UI },
  { name: 'focus/surface', fg: (t) => t.color.focus, bg: (t) => t.color.surface, min: LARGE_OR_UI },
  // The highlighter: text on a full stroke (hover, a marked phrase, a reading)
  { name: 'markInk/mark', fg: (t) => t.color.markInk, bg: (t) => t.color.mark },
  // ...and ink on the wash of it (status labels, metric chips, selected rows)
  { name: 'text/accentSoft over bg', fg: (t) => t.color.text, bg: (t) => flattened(t.color.accentSoft, t.color.bg) },
  {
    name: 'text/accentSoft over surface',
    fg: (t) => t.color.text,
    bg: (t) => flattened(t.color.accentSoft, t.color.surface),
  },
  {
    name: 'accent/accentSoft over bgSunken',
    fg: (t) => t.color.accent,
    bg: (t) => flattened(t.color.accentSoft, t.color.bgSunken),
  },
  // Text on a solid ink fill (the skip link)
  { name: 'accentText/accent', fg: (t) => t.color.accentText, bg: (t) => t.color.accent },
  // Status colours wherever they are text
  { name: 'success/bgSunken', fg: (t) => t.color.success, bg: (t) => t.color.bgSunken },
  { name: 'warning/surface', fg: (t) => t.color.warning, bg: (t) => t.color.surface },
  { name: 'danger/bg', fg: (t) => t.color.danger, bg: (t) => t.color.bg },
  // Structure that carries meaning (non-text, 3:1): the heavy rule, and the
  // outline of inputs and icon buttons
  { name: 'rule/bg', fg: (t) => t.color.rule, bg: (t) => t.color.bg, min: LARGE_OR_UI },
  { name: 'borderStrong/bg', fg: (t) => t.color.borderStrong, bg: (t) => t.color.bg, min: LARGE_OR_UI },
  { name: 'borderStrong/surface', fg: (t) => t.color.borderStrong, bg: (t) => t.color.surface, min: LARGE_OR_UI },
  // The highlighter as a line (link underline, current-page stroke) on a dark
  // page, where it is the only thing marking the line; on paper the ink text
  // carries the link and the line is decoration, so it is not gated there.
];

/** Every theme the site ships: the two defaults and every generated one. */
const ALL_THEMES = THEME_INFO.map((info) => ({ name: info.id, mode: info.mode, tokens: themes[info.id] }));

describe('token contrast matrix (WCAG 2.x AA)', () => {
  for (const theme of ALL_THEMES) {
    for (const pair of PAIRS) {
      it(`${theme.name}: ${pair.name} >= ${pair.min ?? BODY}`, () => {
        const ratio = contrastRatio(pair.fg(theme.tokens), pair.bg(theme.tokens));
        expect(ratio, `${pair.name} = ${ratio.toFixed(2)}:1 in ${theme.name}`).toBeGreaterThanOrEqual(pair.min ?? BODY);
      });
    }
  }

  it('textSubtle stays visibly distinct from textMuted (hierarchy survives AA fixes)', () => {
    for (const { tokens: t } of ALL_THEMES) {
      // same direction of contrast against bg but different magnitude
      expect(t.color.textSubtle).not.toBe(t.color.textMuted);
      const muted = contrastRatio(t.color.textMuted, t.color.bg);
      const subtle = contrastRatio(t.color.textSubtle, t.color.bg);
      expect(Math.abs(muted - subtle)).toBeGreaterThan(1.5);
    }
  });

  it('on a dark page the highlighter also works as a line and as a focus ring (3:1)', () => {
    for (const { name, mode, tokens: t } of ALL_THEMES) {
      if (mode !== 'dark') continue;
      expect(contrastRatio(t.color.accentBorder, t.color.bg), `${name} accentBorder/bg`).toBeGreaterThanOrEqual(
        LARGE_OR_UI,
      );
      expect(contrastRatio(t.color.mark, t.color.bg), `${name} mark/bg`).toBeGreaterThanOrEqual(LARGE_OR_UI);
    }
  });

  it('body text clears 7:1 on the page in every theme (AAA for the main reading pairs)', () => {
    for (const { name, tokens: t } of ALL_THEMES) {
      expect(contrastRatio(t.color.text, t.color.bg), `${name} text/bg`).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(t.color.textMuted, t.color.bg), `${name} textMuted/bg`).toBeGreaterThanOrEqual(7);
    }
  });

  it('a theme\u2019s page is as light or as dark as its mode says (native controls follow the mode)', () => {
    for (const { name, mode, tokens: t } of ALL_THEMES) {
      const onWhite = contrastRatio(t.color.bg, '#ffffff');
      const onBlack = contrastRatio(t.color.bg, '#000000');
      expect(mode === 'light' ? onBlack > onWhite : onWhite > onBlack, `${name} is not a ${mode} page`).toBe(true);
    }
  });
});

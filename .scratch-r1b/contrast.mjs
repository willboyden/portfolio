/* WCAG 2.2 contrast math for tokens.ts — computes relative luminance + ratios. */
import { darkTheme, lightTheme } from '../src/theme/tokens.ts';

function hex2rgb(h) {
  const m = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
}
function parse(c) {
  if (c.startsWith('#')) return { rgb: hex2rgb(c), a: 1 };
  const m = /rgba?\(([^)]+)\)/.exec(c);
  const p = m[1].split(',').map((s) => parseFloat(s.trim()));
  return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
}
function over(fg, bg) {
  const f = parse(fg), b = parse(bg);
  const blended = f.rgb.map((v, i) => v * f.a + b.rgb[i] * (1 - f.a));
  return { rgb: blended, a: 1 };
}
function relLum(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function fmt(rgb) {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function ratio(fg, bg) {
  const f = parse(fg);
  const b = parse(bg);
  const fb = f.a < 1 ? over(fg, bg) : f;
  const bb = b.a < 1 ? over(bg, '#ffffff') : b; // alpha bg over white (fallback)
  const L1 = relLum(fb.rgb), L2 = relLum(bb.rgb);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

const themes = { dark: darkTheme, light: lightTheme };

// composite of accentSoft over each base
function composite(fg, bg) {
  const f = parse(fg), b = parse(bg);
  if (f.a >= 1) return fmt(b.rgb);
  return fmt(f.rgb.map((v, i) => v * f.a + b.rgb[i] * (1 - f.a)));
}

const pass = (r, req) => (r >= req ? 'PASS' : '*** FAIL ***');

for (const [name, t] of Object.entries(themes)) {
  const c = t.color;
  const softOnBg = composite(c.accentSoft, c.bg);
  const softOnSurface = composite(c.accentSoft, c.surface);
  const softOnBgElev = composite(c.accentSoft, c.bgElevated);
  const softOnBgSunken = composite(c.accentSoft, c.bgSunken);
  console.log(`\n================ ${name.toUpperCase()} ================`);
  console.log(`accentSoft composite: over bg=${softOnBg} over surface=${softOnSurface} over bgElevated=${softOnBgElev} over bgSunken=${softOnBgSunken}`);
  const rows = [
    ['text', 'bg', c.text, c.bg, 4.5],
    ['text', 'surface', c.text, c.surface, 4.5],
    ['text', 'bgElevated', c.text, c.bgElevated, 4.5],
    ['text', 'bgSunken (Prose code)', c.text, c.bgSunken, 4.5],
    ['text', 'surfaceHover', c.text, c.surfaceHover, 4.5],
    ['textMuted', 'bg', c.textMuted, c.bg, 4.5],
    ['textMuted', 'surface', c.textMuted, c.surface, 4.5],
    ['textMuted', 'bgElevated', c.textMuted, c.bgElevated, 4.5],
    ['textMuted', 'surfaceHover (nav hover)', c.textMuted, c.surfaceHover, 4.5],
    ['textMuted', 'bgSunken (Tag default / Footer links)', c.textMuted, c.bgSunken, 4.5],
    ['textMuted', 'accentSoft-over-bg (Nav ACTIVE bg)', c.textMuted, softOnBg, 4.5],
    ['textSubtle', 'bg (Footer Copy/Hint)', c.textSubtle, c.bg, 4.5],
    ['textSubtle', 'bgElevated', c.textSubtle, c.bgElevated, 4.5],
    ['textSubtle', 'bgSunken (Footer bg / Pagination disabled)', c.textSubtle, c.bgSunken, 4.5],
    ['textSubtle', 'surface', c.textSubtle, c.surface, 4.5],
    ['textSubtle', 'accentSoft-over-bg', c.textSubtle, softOnBg, 4.5],
    ['text', 'accentSoft-over-bg (active nav/hover text)', c.text, softOnBg, 4.5],
    ['accent', 'bg (links, Eyebrow)', c.accent, c.bg, 4.5],
    ['accent', 'surface (Button hover text)', c.accent, c.surface, 4.5],
    ['accent', 'bgElevated (Button hover text)', c.accent, c.bgElevated, 4.5],
    ['accent', 'surfaceHover (Pagination hover)', c.accent, c.surfaceHover, 4.5],
    ['accent', 'accentSoft-over-surface (Tag accent)', c.accent, softOnSurface, 4.5],
    ['accent', 'accentSoft-over-bg (Tag accent alt)', c.accent, softOnBg, 4.5],
    ['accent', 'accentSoft-over-bgElevated', c.accent, softOnBgElev, 4.5],
    ['accent', 'accentSoft-over-bgSunken', c.accent, softOnBgSunken, 4.5],
    ['accentText', 'accent (primary btn/commented)', c.accentText, c.accent, 4.5],
    ['bg', 'accent (Button primary/Pagination current)', c.bg, c.accent, 4.5],
    ['bgElevated', 'accent (secondary hover text? n/a)', c.bgElevated, c.accent, 4.5],
    ['bgSunken', 'accent (Pagination current on ?)', c.bgSunken, c.accent, 4.5],
    ['accentText', 'bgElevated (wordmark text on header? n/a)', c.accentText, c.bgElevated, 4.5],
    ['accentText', 'bg', c.accentText, c.bg, 4.5],
    ['danger text', 'bg', c.danger, c.bg, 4.5],
    ['danger text', 'surface', c.danger, c.surface, 4.5],
    ['danger', 'bgElevated (Button danger HOVER)', c.danger, c.bgElevated, 4.5],
    ['bgElevated', 'danger (Button danger FILL)', c.bgElevated, c.danger, 4.5],
    ['warning', 'bg', c.warning, c.bg, 4.5],
    ['warning', 'surface', c.warning, c.surface, 4.5],
    ['success', 'bg', c.success, c.bg, 4.5],
    ['success', 'surface', c.success, c.surface, 4.5],
    ['border', 'bg (1.4.11 non-text)', c.border, c.bg, 3],
    ['border', 'surface (1.4.11 non-text)', c.border, c.surface, 3],
    ['borderStrong', 'bg (1.4.11 non-text)', c.borderStrong, c.bg, 3],
    ['borderStrong', 'surface (1.4.11 non-text)', c.borderStrong, c.surface, 3],
    ['accentBorder', 'bg (Tag accent border)', c.accentBorder, c.bg, 3],
    ['focus ring', 'bg (1.4.11 / 2.4.13)', c.focus, c.bg, 3],
    ['focus ring', 'surface (2.4.13)', c.focus, c.surface, 3],
    ['focus ring', 'accent (ring on primary btn)', c.focus, c.accent, 3],
    ['text', 'accentSoft-over-surface (selection)', c.text, softOnSurface, 4.5],
    ['scrim-over-bg vs text', 'info', c.text, composite(c.scrim, c.bg), 4.5],
  ];
  for (const [fgLabel, bgLabel, fg, bg, req] of rows) {
    const r = ratio(fg, bg);
    const bgShown = bg.startsWith('rgba') ? `${fmt(parse(bg).rgb)}(composite)` : bg;
    console.log(`${r.toFixed(2).padStart(6)}:1  ${pass(r, req).padEnd(12)} (>=${req})  ${fgLabel.padEnd(26)} on ${bgLabel.padEnd(38)} ${fg} / ${bgShown}`);
  }
}

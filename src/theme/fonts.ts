/**
 * Self-hosted type: IBM Plex Sans, Serif and Mono.
 *
 * The files under public/fonts/ are IBM's own release files, byte for byte:
 * the "split" WOFF2 builds from github.com/IBM/plex (release tags and hashes in
 * THIRD-PARTY-NOTICES.md; fonts.test.ts pins every file's SHA-256). They are
 * NOT subset or rebuilt here: Plex is licensed under the SIL Open Font License
 * with the Reserved Font Name "Plex", so a modified build could not keep the
 * name. Each file's unicode-range below is the one IBM's stylesheet ships for
 * that split, so a browser downloads a file only when a page uses its glyphs.
 *
 * This module has no imports on purpose: the prerenderer, the Vite dev plugin
 * and the tests all read it, and it must load anywhere.
 *
 * Roles (see tokens.ts): Sans = interface, Serif = headings and long-form
 * reading, Mono = data (dates, versions, measurements, code).
 */

export interface FontFace {
  family: 'IBM Plex Sans' | 'IBM Plex Serif' | 'IBM Plex Mono';
  /** File name under public/fonts/. */
  file: string;
  weight: 400 | 600;
  style: 'normal' | 'italic';
  /** Which of IBM's unicode splits the file is. */
  split: 'Latin1' | 'Pi';
  /** Lowercase hex SHA-256 of the file, as released by IBM. */
  sha256: string;
}

const LATIN1_SERIF_MONO =
  'U+0020-007E, U+00A0-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2013-2014, U+2018-201A, U+201C-201E, U+2020-2022, U+2026, U+2030, U+2039-203A, U+2044, U+20AC, U+2122, U+2212, U+FB01-FB02';

/** Basic Latin, Latin-1 and the common typographic punctuation. */
const LATIN1: Record<FontFace['family'], string> = {
  'IBM Plex Sans':
    'U+0000, U+000D, U+0020-007E, U+00A0-00A3, U+00A4-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2013-2014, U+2018-201A, U+201C-201E, U+2020-2022, U+2026, U+2030, U+2039-203A, U+2044, U+2074, U+20AC, U+2122, U+2212, U+FB01-FB02',
  'IBM Plex Serif': LATIN1_SERIF_MONO,
  'IBM Plex Mono': LATIN1_SERIF_MONO,
};

/** Arrows, math operators, superscripts and (Mono only) box drawing. */
const PI: Record<FontFace['family'], string> = {
  'IBM Plex Sans':
    'U+0E3F, U+2032-2033, U+2070, U+2075-2079, U+2080-2081, U+2083, U+2085-2089, U+2113, U+2116, U+2126, U+212E, U+2150-2151, U+2153-215E, U+2190-2199, U+21A9-21AA, U+21B0-21B3, U+21B6-21B7, U+21BA-21BB, U+21C4, U+21C6, U+2202, U+2206, U+220F, U+2211, U+221A, U+221E, U+222B, U+2248, U+2260, U+2264-2265, U+25CA, U+2713, U+274C, U+2B0E-2B11, U+EBE1-EBE7, U+ECE0, U+EFCC',
  'IBM Plex Serif':
    'U+0E3F, U+2000-200D, U+2010-2012, U+2015, U+2028-2029, U+202F, U+2032-2033, U+203E, U+2070, U+2074-2079, U+2080-2089, U+2113, U+2116, U+2126, U+212E, U+2150-2151, U+2153-215E, U+2190-2199, U+21A9-21AA, U+21B0-21B3, U+21B6-21B7, U+21BA-21BB, U+21C4, U+21C6, U+2202, U+2206, U+220F, U+2211, U+2215, U+2219-221A, U+221E, U+222B, U+2236, U+2248, U+2260, U+2264-2265, U+25CA, U+2713, U+274C, U+2B0E-2B11, U+ECE0, U+EFCC, U+FEFF, U+FFFD',
  'IBM Plex Mono':
    'U+03C0, U+0E3F, U+2000-200D, U+2010-2012, U+2015, U+2028-2029, U+202F, U+2032-2033, U+203E, U+205F, U+2070, U+2074-2079, U+2080-2089, U+2113, U+2116, U+2126, U+212E, U+2150-2151, U+2153-215E, U+2190-2199, U+21A9-21AA, U+21B0-21B3, U+21B6-21B7, U+21BA-21BB, U+21C4, U+21C6, U+2202, U+2206, U+220F, U+2211, U+2215, U+2219-221A, U+221E, U+222B, U+2236, U+2248, U+2260, U+2264-2265, U+2400-2421, U+2500-259F, U+25CA, U+2713, U+274C, U+2B0E-2B11, U+3000, U+FEFF, U+FFFD',
};

export const FONT_FACES: readonly FontFace[] = [
  {
    family: 'IBM Plex Sans',
    file: 'IBMPlexSans-Regular-Latin1.woff2',
    weight: 400,
    style: 'normal',
    split: 'Latin1',
    sha256: 'b5ad7bd39f996144915f0ad9849a90183b27d8c28ad97ed98af5b1bebc51f6b1',
  },
  {
    family: 'IBM Plex Sans',
    file: 'IBMPlexSans-Regular-Pi.woff2',
    weight: 400,
    style: 'normal',
    split: 'Pi',
    sha256: '1487059829a180f975627e473acc81ff22c2c0faf1da09b314c27eeb41b7f2e4',
  },
  {
    family: 'IBM Plex Sans',
    file: 'IBMPlexSans-SemiBold-Latin1.woff2',
    weight: 600,
    style: 'normal',
    split: 'Latin1',
    sha256: 'fff0ab3a88b0b4aa0b693e4f0201359a15183b08e3fa5696d1918d8f0ade8ad5',
  },
  {
    family: 'IBM Plex Sans',
    file: 'IBMPlexSans-SemiBold-Pi.woff2',
    weight: 600,
    style: 'normal',
    split: 'Pi',
    sha256: '768421433d850d3a30118dddf05972625d99ee49bc32c5a8fd26bbe020c4d0f9',
  },
  {
    family: 'IBM Plex Serif',
    file: 'IBMPlexSerif-Regular-Latin1.woff2',
    weight: 400,
    style: 'normal',
    split: 'Latin1',
    sha256: '324a502545695a3e8dd9e9d9273ec56e3aa2a729689807756b9439e2c7a48071',
  },
  {
    family: 'IBM Plex Serif',
    file: 'IBMPlexSerif-Regular-Pi.woff2',
    weight: 400,
    style: 'normal',
    split: 'Pi',
    sha256: 'cf080cc6e988d70244272c1deefa2b533843bf4e14915e230c8b1aa6db8b9045',
  },
  {
    family: 'IBM Plex Serif',
    file: 'IBMPlexSerif-Italic-Latin1.woff2',
    weight: 400,
    style: 'italic',
    split: 'Latin1',
    sha256: '1bceb36acfb5828f10ef9462de2003b0da6c53781faff4a942d426378d9fd975',
  },
  {
    family: 'IBM Plex Serif',
    file: 'IBMPlexSerif-SemiBold-Latin1.woff2',
    weight: 600,
    style: 'normal',
    split: 'Latin1',
    sha256: 'c1487f9484cc8f04c656f7f074724154a04fdefd2ce7ffeab653f517bb4d366d',
  },
  {
    family: 'IBM Plex Serif',
    file: 'IBMPlexSerif-SemiBold-Pi.woff2',
    weight: 600,
    style: 'normal',
    split: 'Pi',
    sha256: '0cb226060194ba9488edc6d5ef63881ab936aac17077b883856652d6932b3867',
  },
  {
    family: 'IBM Plex Mono',
    file: 'IBMPlexMono-Regular-Latin1.woff2',
    weight: 400,
    style: 'normal',
    split: 'Latin1',
    sha256: 'e8993d946649b9d01abb1ed06d574b19d8ea3e66b5c3948602db335c44c18e56',
  },
  {
    family: 'IBM Plex Mono',
    file: 'IBMPlexMono-Regular-Pi.woff2',
    weight: 400,
    style: 'normal',
    split: 'Pi',
    sha256: 'b8002770aa636f544ba43e124da6a227301769754f295eae26e16475b469c767',
  },
];

/**
 * Stand-ins for the moment before a Plex file arrives.
 *
 * `font-display: swap` shows text at once in a fallback and swaps Plex in when
 * it loads. If the fallback is narrower or wider, every line re-wraps at the
 * swap and the page jumps (a layout shift, which also costs performance
 * score). Each face below is a font the visitor already has, scaled so that
 * it takes the same room as the Plex face it stands in for: `size-adjust`
 * matches the average advance width, and the three overrides restore Plex's
 * own ascent, descent and line gap at that scale.
 *
 * The numbers were measured from the shipped Plex files against Liberation
 * Sans / Liberation Serif (frequency-weighted average advance of a-z and the
 * space). Liberation is metric-compatible with Arial and Times New Roman, so
 * one set of numbers serves all the names in `local`. Plex Mono is 0.6 em
 * wide, exactly like Courier New and Liberation Mono, so its stand-in needs
 * no scaling: it only has to come BEFORE the system's own monospace font in
 * the stack, because that one is often narrower (Consolas is 0.55 em).
 */
export interface FallbackFace {
  family: 'Plex Sans Fallback' | 'Plex Serif Fallback' | 'Plex Mono Fallback';
  weight: 400 | 600;
  style: 'normal' | 'italic';
  /** Installed fonts to use, first match wins (full and PostScript names). */
  local: readonly string[];
  /** Percentages, as written into the @font-face descriptors. */
  sizeAdjust: number;
  ascentOverride: number;
  descentOverride: number;
  lineGapOverride: number;
}

export const FALLBACK_FACES: readonly FallbackFace[] = [
  {
    family: 'Plex Sans Fallback',
    weight: 400,
    style: 'normal',
    local: ['Arial', 'ArialMT', 'Liberation Sans', 'Arimo'],
    sizeAdjust: 101.23,
    ascentOverride: 101.25,
    descentOverride: 27.17,
    lineGapOverride: 0,
  },
  {
    family: 'Plex Sans Fallback',
    weight: 600,
    style: 'normal',
    local: ['Arial Bold', 'Arial-BoldMT', 'Liberation Sans Bold', 'Arimo Bold'],
    sizeAdjust: 96.87,
    ascentOverride: 105.81,
    descentOverride: 28.39,
    lineGapOverride: 0,
  },
  {
    family: 'Plex Serif Fallback',
    weight: 400,
    style: 'normal',
    local: ['Times New Roman', 'TimesNewRomanPSMT', 'Liberation Serif', 'Tinos'],
    sizeAdjust: 117.1,
    ascentOverride: 87.53,
    descentOverride: 23.48,
    lineGapOverride: 0,
  },
  {
    family: 'Plex Serif Fallback',
    weight: 400,
    style: 'italic',
    local: ['Times New Roman Italic', 'TimesNewRomanPS-ItalicMT', 'Liberation Serif Italic', 'Tinos Italic'],
    sizeAdjust: 104.52,
    ascentOverride: 98.07,
    descentOverride: 26.31,
    lineGapOverride: 0,
  },
  {
    family: 'Plex Serif Fallback',
    weight: 600,
    style: 'normal',
    local: ['Times New Roman Bold', 'TimesNewRomanPS-BoldMT', 'Liberation Serif Bold', 'Tinos Bold'],
    sizeAdjust: 113.59,
    ascentOverride: 90.24,
    descentOverride: 24.21,
    lineGapOverride: 0,
  },
  {
    family: 'Plex Mono Fallback',
    weight: 400,
    style: 'normal',
    local: ['Courier New', 'CourierNewPSMT', 'Liberation Mono', 'Cousine'],
    sizeAdjust: 100,
    ascentOverride: 102.5,
    descentOverride: 27.5,
    lineGapOverride: 0,
  },
];

/** The three files every page needs for its first screen: interface text,
 * headings, and the reading serif (the home statement, every lede, article
 * text). Only these are preloaded; the rest load when a page uses them.
 *
 * A face that is not here can arrive after the first paint, and text that
 * was drawn in its stand-in is then drawn again. The stand-ins take the same
 * room on average, but one line of large type can still wrap differently,
 * which moves everything under it. So the faces that set large or long text
 * on the first screen are fetched with the page. */
export const FONT_PRELOADS: readonly string[] = [
  'IBMPlexSans-Regular-Latin1.woff2',
  'IBMPlexSerif-SemiBold-Latin1.woff2',
  'IBMPlexSerif-Regular-Latin1.woff2',
];

/** '/portfolio/' or '/' or '' -> a prefix that ends without a slash. */
function basePrefix(base: string): string {
  return base.replace(/\/+$/, '');
}

export function fontUrl(base: string, file: string): string {
  return `${basePrefix(base)}/fonts/${file}`;
}

/**
 * The @font-face rules, one per file. `font-display: swap` shows the fallback
 * stack at once and swaps when the file arrives, so text is never invisible.
 */
export function fontFaceCss(base: string): string {
  return FONT_FACES.map(
    (face) =>
      `@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:${face.weight};font-display:swap;` +
      `src:url("${fontUrl(base, face.file)}") format("woff2");` +
      `unicode-range:${(face.split === 'Latin1' ? LATIN1 : PI)[face.family]}}`,
  ).join('\n');
}

/** The metric-matched stand-in faces (see FALLBACK_FACES). No file is fetched:
 * every source is a font already on the visitor's machine. */
export function fallbackFaceCss(): string {
  return FALLBACK_FACES.map(
    (face) =>
      `@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:${face.weight};` +
      `src:${face.local.map((name) => `local("${name}")`).join(',')};` +
      `size-adjust:${face.sizeAdjust}%;ascent-override:${face.ascentOverride}%;` +
      `descent-override:${face.descentOverride}%;line-gap-override:${face.lineGapOverride}%}`,
  ).join('\n');
}

/** <link rel="preload"> tags for FONT_PRELOADS. `crossorigin` is required for
 * font preloads even on the same origin, or the browser fetches the file twice. */
export function fontPreloadTags(base: string): string[] {
  return FONT_PRELOADS.map(
    (file) => `<link rel="preload" href="${fontUrl(base, file)}" as="font" type="font/woff2" crossorigin />`,
  );
}

/** The <style> element both the prerenderer and the dev server put in <head>. */
export function fontStyleTag(base: string): string {
  return `<style id="font-faces">${fontFaceCss(base)}\n${fallbackFaceCss()}</style>`;
}

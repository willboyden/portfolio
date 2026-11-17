/**
 * The self-hosted fonts: what is declared is what is shipped, byte for byte.
 *
 * The files under public/fonts/ are IBM's release files, unmodified (Plex has
 * a Reserved Font Name, so a rebuilt or subset file could not keep the name).
 * This suite pins each file's SHA-256, so a swapped, truncated or "optimised"
 * file fails here instead of shipping, and checks the tags the prerenderer and
 * the dev server put in <head>.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FALLBACK_FACES,
  FONT_FACES,
  FONT_PRELOADS,
  fallbackFaceCss,
  fontFaceCss,
  fontPreloadTags,
  fontStyleTag,
  fontUrl,
} from './fonts';
import { fontFamilyMono, fontFamilySans, fontFamilySerif } from './tokens';

const FONT_DIR = join(process.cwd(), 'public', 'fonts');

describe('font files', () => {
  it('every declared file exists and matches its pinned SHA-256', () => {
    for (const face of FONT_FACES) {
      const path = join(FONT_DIR, face.file);
      expect(existsSync(path), `${face.file} is missing from public/fonts`).toBe(true);
      const sha = createHash('sha256').update(readFileSync(path)).digest('hex');
      expect(sha, `${face.file} is not the released file`).toBe(face.sha256);
    }
  });

  it('nothing is shipped that is not declared (no orphan font files)', () => {
    const shipped = readdirSync(FONT_DIR).filter((name) => name.endsWith('.woff2'));
    expect(shipped.sort()).toEqual(FONT_FACES.map((face) => face.file).sort());
  });

  it('the licence travels with the files and names the reserved font name', () => {
    const licence = readFileSync(join(FONT_DIR, 'LICENSE.txt'), 'utf8');
    expect(licence).toContain('SIL Open Font License, Version 1.1');
    expect(licence).toContain('Reserved Font Name "Plex"');
  });

  it('every file is a WOFF2 (signature "wOF2")', () => {
    for (const face of FONT_FACES) {
      const head = readFileSync(join(FONT_DIR, face.file)).subarray(0, 4).toString('latin1');
      expect(head, face.file).toBe('wOF2');
    }
  });
});

describe('font declarations', () => {
  it('each family the tokens name first is declared, in the weights the scale uses', () => {
    for (const [stack, family] of [
      [fontFamilySans, 'IBM Plex Sans'],
      [fontFamilySerif, 'IBM Plex Serif'],
      [fontFamilyMono, 'IBM Plex Mono'],
    ] as const) {
      expect(stack.startsWith(`'${family}'`)).toBe(true);
      expect(FONT_FACES.some((face) => face.family === family && face.weight === 400 && face.split === 'Latin1')).toBe(
        true,
      );
    }
    /* Headings (serif) and buttons (sans) are semibold: both need a real 600. */
    for (const family of ['IBM Plex Sans', 'IBM Plex Serif']) {
      expect(FONT_FACES.some((face) => face.family === family && face.weight === 600)).toBe(true);
    }
  });

  it('writes one @font-face per file, swap display, base-prefixed URL, a unicode-range', () => {
    const css = fontFaceCss('/portfolio/');
    const rules = css.split('\n');
    expect(rules).toHaveLength(FONT_FACES.length);
    FONT_FACES.forEach((face, i) => {
      const rule = rules[i] ?? '';
      expect(rule.startsWith('@font-face{')).toBe(true);
      expect(rule).toContain(`font-family:"${face.family}"`);
      expect(rule).toContain(`font-weight:${face.weight}`);
      expect(rule).toContain(`font-style:${face.style}`);
      expect(rule).toContain('font-display:swap');
      expect(rule).toContain(`url("/portfolio/fonts/${face.file}") format("woff2")`);
      expect(rule).toMatch(/unicode-range:U\+[0-9A-F]{4}/);
    });
  });

  it('Latin and symbol splits never overlap inside a family (one file per character)', () => {
    const ranges = (rule: string): [number, number][] =>
      (/unicode-range:([^}]*)/.exec(rule)?.[1] ?? '').split(',').map((part) => {
        const [from, to] = part.trim().replace('U+', '').split('-');
        return [parseInt(from ?? '', 16), parseInt(to ?? from ?? '', 16)];
      });
    const rules = fontFaceCss('/').split('\n');
    FONT_FACES.forEach((face, i) => {
      if (face.split !== 'Latin1') return;
      const j = FONT_FACES.findIndex(
        (other) =>
          other.family === face.family &&
          other.weight === face.weight &&
          other.style === face.style &&
          other.split === 'Pi',
      );
      if (j === -1) return;
      for (const [a0, a1] of ranges(rules[i] ?? '')) {
        for (const [b0, b1] of ranges(rules[j] ?? '')) {
          expect(a1 < b0 || b1 < a0, `${face.file}: U+${a0.toString(16)} overlaps the Pi split`).toBe(true);
        }
      }
    });
  });

  it('the arrows and operators the site uses are covered by a symbol split', () => {
    /* → ← ≤ ≥ ≈ are in the Pi files; × − µ ° ² are in Latin1. */
    const covered = (family: string, split: 'Latin1' | 'Pi', codepoint: number): boolean => {
      const i = FONT_FACES.findIndex((face) => face.family === family && face.split === split);
      const rule = fontFaceCss('/').split('\n')[i] ?? '';
      return (/unicode-range:([^}]*)/.exec(rule)?.[1] ?? '').split(',').some((part) => {
        const [from, to] = part.trim().replace('U+', '').split('-');
        return codepoint >= parseInt(from ?? '', 16) && codepoint <= parseInt(to ?? from ?? '', 16);
      });
    };
    for (const family of ['IBM Plex Sans', 'IBM Plex Serif', 'IBM Plex Mono']) {
      for (const ch of '→←≤≥≈') expect(covered(family, 'Pi', ch.codePointAt(0) ?? 0), `${family} ${ch}`).toBe(true);
      for (const ch of '×−µ°²—–…') {
        expect(covered(family, 'Latin1', ch.codePointAt(0) ?? 0), `${family} ${ch}`).toBe(true);
      }
    }
  });

  it('preloads exactly the three first-screen files, with crossorigin (or the browser fetches them twice)', () => {
    const tags = fontPreloadTags('/');
    expect(tags).toHaveLength(FONT_PRELOADS.length);
    /* Interface text, headings, and the reading serif: the faces that set
     * large or long text on a first screen. Every other face waits. */
    expect([...FONT_PRELOADS]).toEqual([
      'IBMPlexSans-Regular-Latin1.woff2',
      'IBMPlexSerif-SemiBold-Latin1.woff2',
      'IBMPlexSerif-Regular-Latin1.woff2',
    ]);
    for (const file of FONT_PRELOADS) expect(FONT_FACES.some((face) => face.file === file)).toBe(true);
    for (const tag of tags) {
      expect(tag).toMatch(
        /^<link rel="preload" href="\/fonts\/[A-Za-z0-9-]+\.woff2" as="font" type="font\/woff2" crossorigin \/>$/,
      );
    }
  });

  it('builds URLs for a root and a sub-path deploy without doubling slashes', () => {
    expect(fontUrl('/', 'a.woff2')).toBe('/fonts/a.woff2');
    expect(fontUrl('/portfolio/', 'a.woff2')).toBe('/portfolio/fonts/a.woff2');
    expect(fontUrl('', 'a.woff2')).toBe('/fonts/a.woff2');
    expect(fontStyleTag('/')).toMatch(/^<style id="font-faces">@font-face\{[\s\S]*\}<\/style>$/);
  });
});

describe('metric-matched fallbacks (no layout shift when Plex swaps in)', () => {
  it('there is a stand-in for every sans and serif face the pages use, and it sits second in the stack', () => {
    expect(fontFamilySans.startsWith("'IBM Plex Sans', 'Plex Sans Fallback',")).toBe(true);
    expect(fontFamilySerif.startsWith("'IBM Plex Serif', 'Plex Serif Fallback',")).toBe(true);
    expect(fontFamilyMono.startsWith("'IBM Plex Mono', 'Plex Mono Fallback',")).toBe(true);
    for (const face of FONT_FACES) {
      if (face.split !== 'Latin1') continue;
      const family = (
        {
          'IBM Plex Sans': 'Plex Sans Fallback',
          'IBM Plex Serif': 'Plex Serif Fallback',
          'IBM Plex Mono': 'Plex Mono Fallback',
        } as const
      )[face.family];
      expect(
        FALLBACK_FACES.some((f) => f.family === family && f.weight === face.weight && f.style === face.style),
        `${face.file} has no stand-in`,
      ).toBe(true);
    }
  });

  it('a stand-in is only ever a font already on the machine: local() sources, nothing fetched', () => {
    const css = fallbackFaceCss();
    expect(css).not.toContain('url(');
    for (const rule of css.split('\n')) {
      expect(rule).toMatch(/src:local\("[^"]+"\)(,local\("[^"]+"\))*;/);
      expect(rule).toMatch(/size-adjust:\d+(\.\d+)?%/);
      expect(rule).toMatch(/ascent-override:\d+(\.\d+)?%/);
      expect(rule).toMatch(/descent-override:\d+(\.\d+)?%/);
      expect(rule).toMatch(/line-gap-override:\d+(\.\d+)?%/);
      expect(rule).not.toContain('font-display'); /* nothing to wait for */
    }
  });

  it('the adjustments are plausible corrections, not typos (within 25% of the font\u2019s own size)', () => {
    for (const face of FALLBACK_FACES) {
      expect(face.sizeAdjust, face.family).toBeGreaterThan(75);
      expect(face.sizeAdjust, face.family).toBeLessThan(125);
      /* ascent + descent of the scaled fallback is a sane line box. */
      const box = ((face.ascentOverride + face.descentOverride) * face.sizeAdjust) / 10000;
      expect(box, `${face.family} ${face.weight}`).toBeGreaterThan(1.1);
      expect(box, `${face.family} ${face.weight}`).toBeLessThan(1.5);
      /* Names cover Windows/macOS (Arial, Times New Roman, Courier New) and Linux (Liberation). */
      expect(face.local.some((n) => n.startsWith('Liberation'))).toBe(true);
      expect(face.local.some((n) => /Arial|Times|Courier/.test(n))).toBe(true);
    }
  });

  it('the <style> tag carries both the Plex faces and the stand-ins', () => {
    const tag = fontStyleTag('/');
    expect(tag).toContain('font-family:"IBM Plex Sans"');
    expect(tag).toContain('font-family:"Plex Sans Fallback"');
    expect(tag).toContain('font-family:"Plex Serif Fallback"');
  });
});

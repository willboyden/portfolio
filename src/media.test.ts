/**
 * The images that represent the site elsewhere: the share card a link unfurls
 * into, the tab icon, the home-screen icon.
 *
 * They are files, drawn by scripts/gen_media.py, so nothing in the app notices
 * when they say the wrong thing. The default share card once went out for
 * months under the template's placeholder name. These checks pin what can be
 * pinned without reading pixels: who the generator says the site belongs to,
 * that it draws in the site's identity, and that every image the pages point
 * at exists and is a plausible image.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE } from 'app/lib/seo';
import { lightTheme } from 'app/theme/tokens';

const ROOT = process.cwd();
const generator = readFileSync(join(ROOT, 'scripts', 'gen_media.py'), 'utf8');
const favicon = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf8');

const constant = (name: string): string | undefined => new RegExp(`^${name} = "([^"]*)"`, 'm').exec(generator)?.[1];

const rgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe('share images and icons', () => {
  it('the generator signs every card with the site owner’s name, not a placeholder', () => {
    expect(constant('NAME')).toBe(SITE.author);
    expect(constant('ADDRESS')).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}(\/[a-z0-9-]+)*$/);
    for (const placeholder of ['Alex Rivera', 'alexrivera', 'example.com', 'Your Name']) {
      expect(generator, placeholder).not.toContain(placeholder);
    }
  });

  it('the generator draws with the Paper theme’s colours and the site’s own fonts', () => {
    expect(generator).toContain(`PAPER = ${rgb(lightTheme.color.bg)}`);
    expect(generator).toContain(`INK = ${rgb(lightTheme.color.text)}`);
    expect(generator).toContain(`MARK = ${rgb(lightTheme.color.mark)}`);
    for (const file of generator.matchAll(/FONTS \/ "([^"]+)"/g)) {
      expect(statSync(join(ROOT, 'public', 'fonts', file[1] ?? '')).size, file[1]).toBeGreaterThan(1000);
    }
    /* The old identity's colours are gone. */
    for (const old of ['124, 92, 255', '#7c5cff', '74, 222, 128']) expect(generator).not.toContain(old);
  });

  it('every image the pages point at is there, is a PNG, and is share-card sized', () => {
    for (const file of ['og-default.png', 'og/projects.png', 'og/writing.png', 'og/ai-engineering.png']) {
      const bytes = readFileSync(join(ROOT, 'public', file));
      expect(bytes.subarray(1, 4).toString('latin1'), file).toBe('PNG');
      /* IHDR: width and height as big-endian 32-bit integers at 16 and 20. */
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], file).toEqual([1200, 630]);
      expect(bytes.length, file).toBeGreaterThan(10_000);
      expect(bytes.length, `${file} should stay light enough to unfurl quickly`).toBeLessThan(200_000);
    }
    const touch = readFileSync(join(ROOT, 'public', 'apple-touch-icon.png'));
    expect([touch.readUInt32BE(16), touch.readUInt32BE(20)]).toEqual([180, 180]);
  });

  it('the tab icon is the mark: ink on the highlighter, nothing left of the old logo', () => {
    expect(favicon).toContain(`fill="${lightTheme.color.mark}"`);
    expect(favicon).toContain(`fill="${lightTheme.color.text}"`);
    expect(favicon).toContain('viewBox="0 0 64 64"');
    for (const old of ['#7c5cff', '#4ade80', '#0b0e14', 'stroke=']) expect(favicon, old).not.toContain(old);
    /* Static and self-contained: no script, no external reference. */
    expect(favicon).not.toMatch(/<script|href=|url\(/);
  });
});

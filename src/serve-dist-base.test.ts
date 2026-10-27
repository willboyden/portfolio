/**
 * The preview server finds the hosting base on its own. A build made with
 * VITE_BASE=/portfolio/ (the GitHub Pages build) used to 404 on every real
 * URL under `npm run preview` unless VITE_BASE was exported again.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

type HostingBase = (dir: string, env?: Record<string, string | undefined>) => string;

/* A computed path keeps TypeScript from resolving the untyped .mjs module. */
const serveDistPath = resolve(__dirname, '../scripts/serve-dist.mjs');
const loadHostingBase = async (): Promise<HostingBase> =>
  ((await import(pathToFileURL(serveDistPath).href)) as { hostingBase: HostingBase }).hostingBase;

const dirs: string[] = [];
function distWith(html: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'serve-dist-base-'));
  dirs.push(dir);
  if (html !== null) writeFileSync(join(dir, 'index.html'), html);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('serve-dist hostingBase', () => {
  it('reads the base from the built index.html', async () => {
    const hostingBase = await loadHostingBase();
    const dir = distWith('<script type="module" src="/portfolio/assets/index-abc123.js"></script>');
    expect(hostingBase(dir, {})).toBe('/portfolio');
  });

  it('serves a root build at the root', async () => {
    const hostingBase = await loadHostingBase();
    const dir = distWith('<link rel="stylesheet" href="/assets/index-abc123.css">');
    expect(hostingBase(dir, {})).toBe('');
  });

  it('lets VITE_BASE win over the build', async () => {
    const hostingBase = await loadHostingBase();
    const dir = distWith('<script src="/portfolio/assets/index-abc123.js"></script>');
    expect(hostingBase(dir, { VITE_BASE: '/other/' })).toBe('/other');
  });

  it('falls back to the root when nothing is built', async () => {
    const hostingBase = await loadHostingBase();
    expect(hostingBase(distWith(null), {})).toBe('');
  });
});

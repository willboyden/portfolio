/**
 * Full production build orchestration:
 *   content -> vite (client) -> prerender (SSR pass) -> gzip precompress -> audit
 *
 * Every step is a child process with its real exit code honored; a failure in
 * any step stops the chain with a loud error. This is the single command CI
 * and the Dockerfile call.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '..');

function step(name, cmd, args) {
  process.stderr.write(`\n▶ ${name}\n`);
  const t0 = Date.now();
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error(`\n✖ ${name} failed (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
  process.stderr.write(`✔ ${name} in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
}

step('content', process.execPath, ['scripts/build-content.mjs']);
step('vite build', process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
step('vite prerender bundle', process.execPath, [
  'node_modules/vite/bin/vite.js',
  'build',
  '--config',
  'vite.config.prerender.ts',
]);
step('prerender', process.execPath, ['scripts/prerender.mjs']);
step('audit', process.execPath, ['scripts/audit-dist.mjs']);

/* .gz siblings let nginx gzip_static serve without runtime compression. */
process.stderr.write('\n▶ gzip precompress\n');
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.xml', '.txt', '.json', '.webmanifest']);
let gzCount = 0;
let gzBytes = 0;
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    const ext = entry.slice(entry.lastIndexOf('.'));
    if (!COMPRESSIBLE.has(ext) || entry.endsWith('.gz')) continue;
    const raw = readFileSync(full);
    if (raw.length < 1024) continue;
    const gz = gzipSync(raw, { level: 9 });
    if (gz.length >= raw.length * 0.9) continue; /* not worth it */
    writeFileSync(`${full}.gz`, gz);
    gzCount += 1;
    gzBytes += raw.length - gz.length;
  }
}
walk(join(ROOT, 'dist'));
process.stderr.write(`✔ gzip: ${gzCount} files, saved ${(gzBytes / 1024).toFixed(0)} kB\n`);

process.stderr.write('\nBUILD COMPLETE — dist/ is ready for nginx.\n');

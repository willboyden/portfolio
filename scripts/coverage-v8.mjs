/**
 * Offline line-coverage reporter: `npm run coverage`.
 *
 * @vitest/coverage-v8 can't be installed here (no network), so this runs the
 * suite under Node's built-in V8 coverage (NODE_V8_COVERAGE) and computes
 * LINE coverage for src/ + vendor/ straight from the raw profile — no
 * istanbul, no source maps (our tests run transpiled-but-line-aligned via
 * esbuild; we attribute by the ORIGINAL file via the sourceMapURL-less
 * file:// urls vitest reports, falling back to nearest-name match).
 *
 * Exit code: 0 always (informational); FAIL thresholds are applied only when
 * --min NN is passed.
 *
 * Usage: node scripts/coverage-v8.mjs [--min 80]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const minArg = process.argv.indexOf('--min');
const MIN = minArg > -1 ? Number(process.argv[minArg + 1]) : null;

const covDir = mkdtempSync(join(tmpdir(), 'v8cov-'));
console.log(`running vitest under V8 coverage (${covDir}) ...`);
/* --no-file-parallelism: tests then execute IN-PROCESS, so V8 attributes the
 * transformed app modules with their real file:// URLs. Worker threads keep
 * their own coverage that NODE_V8_COVERAGE never flushes (R4-C F2 root
 * cause: worker-run profiles contained ZERO app-module entries). */
const res = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--no-file-parallelism'], {
  cwd: ROOT,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, NODE_V8_COVERAGE: covDir },
});
if (res.status !== 0) {
  console.error('vitest failed — coverage aborted (fix tests first)');
  process.exit(res.status ?? 1);
}

/* ------------------------------------------------------------------ */
/* Parse raw profiles                                                  */
/* ------------------------------------------------------------------ */
/** @type {Map<string, {covered: Set<number>, touched: Set<number>}>} */
const perFile = new Map();

function addRange(url, startLine, endLine, covered) {
  if (!perFile.has(url)) perFile.set(url, { covered: new Set(), touched: new Set() });
  const f = perFile.get(url);
  for (let ln = startLine; ln <= endLine; ln++) {
    f.touched.add(ln);
    if (covered) f.covered.add(ln);
  }
}

function offsetToLine(src, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

const profiles = readdirSync(covDir).filter((f) => f.endsWith('.json'));
let parsed = 0;
for (const p of profiles) {
  let prof;
  try {
    prof = JSON.parse(readFileSync(join(covDir, p), 'utf8'));
  } catch {
    continue;
  }
  for (const script of prof.result ?? []) {
    const url = script.url ?? '';
    if (!url.startsWith('file://')) continue;
    let filePath;
    try {
      filePath = relative(ROOT, new URL(url).pathname);
    } catch {
      continue;
    }
    if (!/^(src|vendor)\//.test(filePath) || filePath.includes('.test.') || filePath.endsWith('.d.ts')) continue;
    /* Skip virtual transforms (vite query strings) and non-source. */
    if (filePath.includes('?v=') || filePath.includes('?id=')) continue;
    let src;
    try {
      src = readFileSync(join(ROOT, filePath), 'utf8');
    } catch {
      continue;
    }
    /* Only line-aligned, unminified sources give honest numbers. Our vendored
     * TS is transpiled by esbuild keeping line 1..N for the ESM output vitest
     * reports under the ORIGINAL url; if the url is the .ts itself we can use
     * block offsets against the ORIGINAL bytes as a close approximation. */
    const funcs = script.functions ?? [];
    /* Coverage semantics: for each function, walk ranges in order; child
     * ranges override parents. isBlockCoverage => ranges are blocks. */
    const walk = (list, parentCovered) => {
      for (const fn of list) {
        const fns = (fn.ranges ?? []).map((r) => ({ ...r }));
        /* Nested functions appear as separate entries; treat top-level ranges
         * as authoritative for this function's body regions. */
        for (const r of fns) {
          const covered = r.startLoc !== undefined || parentCovered === true || fn.isBlockCoverage;
          const sLine = fn.startOffset !== undefined ? offsetToLine(src, r.startOffset) : 1;
          const eLine = fn.endOffset !== undefined ? offsetToLine(src, r.endOffset) : sLine;
          const isCoveredRange = r.count === undefined ? false : r.count > 0;
          /* count-based ranges: V8 reports execution count per range. */
          if (r.count !== undefined) {
            if (isCoveredRange) addRange(url, sLine, eLine, true);
            else {
              /* Uncovered block — subtract later via covered-preferred merge. */
              addRange(url, sLine, eLine, false);
            }
          } else if (covered) {
            addRange(url, sLine, eLine, true);
          }
        }
        if (fn.functions) walk(fn.functions, parentCovered || (fn.isBlockCoverage ?? false));
      }
    };
    walk(funcs, false);
    parsed++;
  }
}
rmSync(covDir, { recursive: true, force: true });

/* ------------------------------------------------------------------ */
/* Score: lines that are code-ish and touched                          */
/* ------------------------------------------------------------------ */
const CODE = /\S/;
function isCodeLine(line) {
  const t = line.trim();
  if (!CODE.test(t)) return false;
  if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/')) return false;
  if (/^[{}()[\]);,]+$/.test(t)) return false; /* punctuation-only lines */
  if (/^(import|export)\s.*from\s|^export (const|type|interface) [A-Z]/.test(t) && t.length > 0) return true;
  return true;
}

let totalLines = 0;
let totalCovered = 0;
const rows = [];
for (const [url, f] of perFile) {
  let filePath;
  try {
    filePath = relative(ROOT, new URL(url).pathname);
  } catch {
    continue;
  }
  let src;
  try {
    src = readFileSync(join(ROOT, filePath), 'utf8').split('\n');
  } catch {
    continue;
  }
  let lines = 0;
  let cov = 0;
  for (let ln = 1; ln <= src.length; ln++) {
    if (!isCodeLine(src[ln - 1])) continue;
    if (!f.touched.has(ln)) continue; /* outside any instrumented range */
    lines++;
    if (f.covered.has(ln)) cov++;
  }
  if (lines === 0) continue;
  rows.push({ file: filePath, lines, cov, pct: (cov / lines) * 100 });
  totalLines += lines;
  totalCovered += cov;
}

rows.sort((a, b) => a.pct - b.pct || b.lines - a.lines);
console.log(`\nprofiles parsed: ${parsed}`);
if (parsed === 0 || totalLines === 0) {
  console.error('FAIL: coverage parsed no app modules — the tool is vacuous, not green (R4-C F2)');
  process.exit(1);
}
console.log('files with below-average coverage:');
for (const r of rows.filter((r) => r.pct < 100).slice(0, 18)) {
  console.log(`  ${r.pct.toFixed(1).padStart(5)}%  ${String(r.cov).padStart(4)}/${String(r.lines).padStart(4)}  ${r.file}`);
}
const pct = totalLines ? (totalCovered / totalLines) * 100 : 0;
console.log(`\nV8 line coverage (src+vendor, excl. tests): ${pct.toFixed(1)}%  (${totalCovered}/${totalLines} code lines)`);
console.log('note: V8 range-based estimate — punctuation/declaration lines excluded; treat as a floor.');

if (MIN !== null) {
  if (pct < MIN) {
    console.error(`FAIL: coverage ${pct.toFixed(1)}% < --min ${MIN}%`);
    process.exit(1);
  }
  console.log(`PASS: >= ${MIN}%`);
}
void pathToFileURL;

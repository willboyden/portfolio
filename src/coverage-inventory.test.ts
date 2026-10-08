/**
 * Coverage inventory gate — "full unit test coverage", enforced offline.
 *
 * Bytecode coverage providers (@vitest/coverage-v8) are not installable in
 * this sandbox (no network), so this test enforces the invariant a coverage
 * gate exists to protect: *every shipped module is reachable from some unit
 * test* — i.e. is actually loaded and exercised when the suite runs.
 *
 * Method: parse `import ... from '...'` / `export ... from '...'` specifiers
 * out of every .ts/.tsx file, resolve project-internal specifiers (relative,
 * `app/...`, and the vendor alias specifiers), and BFS the graph seeded at
 * every *.test.* file. A module no test reaches has zero unit coverage.
 *
 * Documented exceptions (exercised by the build/e2e pipeline instead, never
 * wildcards): src/main.tsx — the browser bootstrap the CDP suite boots.
 * vendor/markdown/.smoke* — scratch, excluded from the walk.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, dirname, resolve as presolve } from 'node:path';

/* This file lives at <root>/src/coverage-inventory.test.ts — base dir is src/. */
const ROOT = fileURLToPath(new URL('../', import.meta.url)); /* <root> */
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(full) && !full.includes('.smoke')) out.push(full);
  }
  return out;
}

const ALL = [...walk(SRC), ...walk(join(ROOT, 'vendor')), ...walk(join(ROOT, 'prerender'))];
const SOURCE_FILES = ALL.filter((f) => !/\.test\.(ts|tsx)$/.test(f));
const TEST_FILES = ALL.filter((f) => /\.test\.(ts|tsx)$/.test(f));

const SRC_PREFIX = SRC.split('/').join('/'); /* /opt/.../src */

/** Resolve a module specifier found in `fromFile` to an absolute file path,
 * or null when it is a bare package import. */
function resolveSpecifier(spec: string, fromFile: string): string | null {
  let base: string | null = null;
  if (spec.startsWith('.')) base = presolve(dirname(fromFile), spec);
  else if (spec.startsWith('app/')) base = presolve(SRC, spec.slice('app/'.length));
  else if (spec.startsWith('@portfolio/')) base = presolve(ROOT, `vendor/${spec.slice('@portfolio/'.length)}/src/index.tsx`);
  else if (spec.startsWith('@emotion-mini/')) base = presolve(ROOT, `vendor/emotion/${spec.slice('@emotion-mini/'.length)}/src/index.ts`);
  else if (/^@emotion\//.test(spec)) {
    const name = spec.replace('@emotion/', '');
    if (name === 'react' || name === 'styled') base = presolve(ROOT, `vendor/emotion/${name}/src/index.ts`);
  }
  if (!base) return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mjs`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  for (const c of candidates) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

const IMPORT_RE = /(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(text))) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec) continue;
    const r = resolveSpecifier(spec, file);
    if (r) out.push(r);
  }
  return out;
}

/* BFS from the test corpus. */
const reachable = new Set<string>();
{
  const queue = [...TEST_FILES];
  for (const t of queue) reachable.add(t);
  while (queue.length > 0) {
    const f = queue.pop() as string;
    for (const dep of importsOf(f)) {
      if (!reachable.has(dep)) {
        reachable.add(dep);
        queue.push(dep);
      }
    }
  }
}

/** Modules exercised by the build+e2e pipeline, not unit tests. Exact list. */
const PIPELINE_ONLY = new Set([join(SRC, 'main.tsx')]);

describe('coverage inventory — every src/ module is exercised by tests', () => {
  const srcModules = SOURCE_FILES.filter((f) => f.startsWith(SRC_PREFIX));

  const uncovered = srcModules
    .filter((f) => !PIPELINE_ONLY.has(f))
    .filter((f) => !reachable.has(f))
    .map((f) => relative(ROOT, f).split('/').join('/'));

  it('has zero src/ modules unreachable from the unit tests', () => {
    expect(
      uncovered,
      `these src/ modules are never loaded by any unit test — add tests or wire them in: ${uncovered.join(', ')}`,
    ).toEqual([]);
  });

  const vendorUncovered = SOURCE_FILES
    .filter((f) => !f.startsWith(SRC_PREFIX) && !f.startsWith(join(ROOT, 'prerender')))
    .filter((f) => !reachable.has(f))
    .map((f) => relative(ROOT, f).split('/').join('/'));

  it('has zero vendor/ modules unreachable from the unit tests', () => {
    expect(
      vendorUncovered,
      `these vendored modules are never loaded by any unit test: ${vendorUncovered.join(', ')}`,
    ).toEqual([]);
  });

  it('keeps the PIPELINE_ONLY exemption honest (no test reaches them)', () => {
    const nowReachable = [...PIPELINE_ONLY].filter((f) => reachable.has(f));
    expect(
      nowReachable.map((f) => relative(ROOT, f)),
      'these modules gained unit coverage — remove them from PIPELINE_ONLY',
    ).toEqual([]);
  });
});

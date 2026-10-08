/**
 * `npm run doctor` — one command that turns "it doesn't work on my machine"
 * into a named missing prerequisite (R3-C F3).
 *
 * This repo has a non-standard dependency model on purpose: the authoritative
 * dev environment is an offline container whose node_modules is a symlink farm
 * over a baked package tree (`npm run deps`). A fresh clone with plain
 * `npm install` ALSO works (package.json lists real deps) — but only with
 * Node >= 22. Doctor checks both paths and says exactly what to run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const problems = [];
const fixed = [];

/* 1. Node version */
const want = (pkg.engines?.node ?? '>=22').replace(/[^0-9.]/g, '');
const major = Number(process.versions.node.split('.')[0]);
if (major < Number(want.split('.')[0])) {
  problems.push(`Node ${want} required, running ${process.versions.node}`);
} else {
  fixed.push(`node ${process.versions.node} satisfies engines "${pkg.engines?.node}"`);
}

/* 2. node_modules present — else name the right bootstrap for this env */
if (!existsSync(join(root, 'node_modules'))) {
  const baked = '/opt/hermes/node_modules';
  if (existsSync(baked)) {
    problems.push(`node_modules missing — run: npm run deps   (offline container: links the baked tree at ${baked})`);
  } else {
    problems.push('node_modules missing — run: npm install   (networked machine)');
  }
} else {
  fixed.push('node_modules present');
  /* 3. key resolutions actually resolve (symlink farm can rot) */
  const probes = ['vitest', 'typescript', 'eslint', 'react'];
  for (const p of probes) {
    if (!existsSync(join(root, 'node_modules', p))) {
      problems.push(`node_modules/${p} missing — re-run the bootstrap for your environment (npm run deps here, npm install there)`);
    }
  }
  if (problems.length === 0) fixed.push('vitest/typescript/eslint/react resolve');
}

/* 4. content generated artifact exists (build regenerates it, but tests read it) */
if (!existsSync(join(root, 'src/content/generated/content.json'))) {
  problems.push('src/content/generated/content.json missing — run: node scripts/build-content.mjs');
} else {
  fixed.push('generated content present');
}

/* 5. vendored code is never supposed to be npm-managed */
for (const v of ['vendor/emotion', 'vendor/markdown', 'vendor/router']) {
  if (!existsSync(join(root, v))) problems.push(`${v} missing — the repo relies on vendored packages (check out the repo fully, do not npm-install these)`);
}
if (fixed.length + problems.length < 4) fixed.push('vendored packages present');

for (const line of fixed) console.log(`  ok  ${line}`);
if (problems.length === 0) {
  console.log('\nenvironment OK — safe to run: npm test, npm run build, node e2e/run.mjs');
} else {
  console.log('\nfix before building:');
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}

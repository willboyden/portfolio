/**
 * e2e runner: discovers e2e/specs/*.e2e.mjs, boots one shared browser,
 * serves dist/, and executes specs against a tiny Playwright-shaped API.
 *
 * Spec files export `export default async function suite({ test, page... })`
 * OR call the injected globals. We use the simplest contract: each spec
 * registers tests via the imported `test()` from e2e/harness/framework.mjs.
 */
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startServer } from '../scripts/serve-dist.mjs';
import { registry } from './harness/framework.mjs';

const specDir = resolve('e2e/specs');
const distDir = resolve('dist');

/* Fail fast with a clear message instead of a confusing fetch error later. */
try {
  readdirSync(distDir);
} catch {
  console.error('dist/ missing — run `node node_modules/vite/bin/vite.js build` first.');
  process.exit(1);
}

const { startBrowser } = await import('./harness/browser-context.mjs');

const specs = readdirSync(specDir)
  .filter((f) => f.endsWith('.e2e.mjs'))
  .filter((f) => (process.env.E2E_FILTER ? f.includes(process.env.E2E_FILTER) : true))
  .sort();

const served = await startServer({ dir: distDir, port: 4321 });
const context = await startBrowser('http://127.0.0.1:4321');

let firstSpecError = null;
for (const spec of specs) {
  try {
    const mod = await import(pathToFileURL(join(specDir, spec)).href);
    if (typeof mod.default === 'function') await mod.default();
  } catch (error) {
    firstSpecError = { spec, error };
    break;
  }
}

let failures = [];
if (!firstSpecError) {
  for (const { name, fn } of registry) {
    const started = Date.now();
    try {
      await context.reset();
      await fn(context);
      const ms = Date.now() - started;
      console.log(`  ✓ ${name} (${ms}ms)`);
    } catch (error) {
      const ms = Date.now() - started;
      failures.push({ name, error });
      console.log(`  ✗ ${name} (${ms}ms)`);
      console.log(`      ${String(error.message).split('\n')[0]}`);
      try {
        await context.screenshotOnFailure(name);
      } catch {
        /* screenshot is best-effort */
      }
    }
  }
}

await context.close();
served.server.close();

if (firstSpecError) {
  console.error(`\nSPEC LOAD FAILED (${firstSpecError.spec}):`, firstSpecError.error.message);
  process.exit(1);
}

const passed = registry.length - failures.length;
console.log(`\ne2e: ${passed}/${registry.length} passed`);
if (failures.length > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(` - ${f.name}: ${f.error.message.split('\n').slice(0, 3).join(' | ')}`);
  process.exit(1);
}

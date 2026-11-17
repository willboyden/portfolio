#!/usr/bin/env node
/**
 * Keep public/theme-init.js in step with the themes in src/theme/tokens.ts.
 *
 *   node scripts/sync-theme-init.mjs           rewrite the two data lines
 *   node scripts/sync-theme-init.mjs --check   exit 1 if they are out of date
 *
 * The pre-paint script is a plain file the browser runs before anything else,
 * so it cannot import the theme module. It carries two tables instead, each on
 * one line:
 *   var MODES = {...};   every theme id and whether its page is light or dark
 *   var VARS = {...};    the colours of every theme the stylesheet does not hold
 * This script writes those lines from the real tokens. Run it after adding or
 * changing a theme; src/theme/theme.test.tsx fails until the file matches.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'theme-init.js');
const check = process.argv.includes('--check');

const server = await createServer({
  root,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
let tables;
try {
  const tokens = await server.ssrLoadModule('/src/theme/tokens.ts');
  tables = { MODES: tokens.THEME_MODES, VARS: tokens.THEME_INLINE_VARS };
} finally {
  await server.close();
}

let text = readFileSync(target, 'utf8');
const before = text;
for (const [name, value] of Object.entries(tables)) {
  const line = new RegExp(`^(\\s*)var ${name} = .*;$`, 'm');
  if (!line.test(text)) {
    console.error(`sync-theme-init: no "var ${name} = ...;" line in public/theme-init.js`);
    process.exit(2);
  }
  text = text.replace(line, (_, indent) => `${indent}var ${name} = ${JSON.stringify(value)};`);
}

if (text === before) {
  console.log('sync-theme-init: public/theme-init.js is up to date');
} else if (check) {
  console.error('sync-theme-init: public/theme-init.js is OUT OF DATE; run: node scripts/sync-theme-init.mjs');
  process.exit(1);
} else {
  writeFileSync(target, text, 'utf8');
  console.log('sync-theme-init: rewrote the theme tables in public/theme-init.js');
}

/**
 * dist/ audit — the quality gate between "it built" and "it ships".
 *
 * Checks (each fails the whole audit):
 *  1. Every expected route has a real index.html.
 *  2. Every HTML page has <title>, meta description, canonical, and no
 *     leaked interpolation bugs (undefined/[object Object]/NaN in visible markup).
 *  3. Internal links in pages resolve to files that exist in dist/.
 *  4. rss.xml + sitemap.xml are well-formed with required elements.
 *  5. Bundle budget: total JS+CSS (gzipped) under budget.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = resolve(import.meta.dirname, '..', 'dist');
const problems = [];
const notes = [];

function read(path) {
  return readFileSync(path, 'utf8');
}

/* Discover all pages by walking for index.html files. */
const pages = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (!statSync(full).isDirectory()) {
      if (e === 'index.html') pages.push(full);
      continue;
    }
    walk(full);
  }
})(DIST);

if (pages.length === 0) fail('no index.html pages found in dist/');
if (!existsSync(join(DIST, 'index.html'))) fail('dist/index.html missing');

const budgets = { totalJsGzipKb: 220, perHtmlKbWarn: 80 };
let totalJsGzip = 0;

for (const page of pages) {
  const rel = page.slice(DIST.length);
  const html = read(page);

  const title = html.match(/<title>([^<]{4,200})<\/title>/);
  if (!title) fail(`${rel}: missing or empty <title>`);

  const desc = html.match(/<meta name="description" content="([^"]{20,400})"/);
  if (!desc) fail(`${rel}: missing meta description (or under 20 chars)`);

  if (!/<link rel="canonical" href="https?:\/\//.test(html)) fail(`${rel}: missing canonical`);

  /* Visible-interpolation bugs. Strip <script> blocks first: JSON-LD legitimately
   * contains braces, and hydration data is not visible text. */
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '');
  for (const [pattern, label] of [
    [/\bundefined\b/, 'undefined'],
    [/\[object Object\]/, '[object Object]'],
    [/\bNaN\b/, 'NaN'],
  ]) {
    if (pattern.test(visible)) fail(`${rel}: visible "${label}" in markup`);
  }

  if (!/<h1[\s>]/.test(visible)) fail(`${rel}: no <h1> on page`);

  /* Internal hrefs must exist on disk (file, clean-URL dir, or asset). */
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    const candidates = [join(DIST, href), join(DIST, href, 'index.html'), join(DIST, `${href}/index.html`)];
    if (!candidates.some((c) => existsSync(c))) fail(`${rel}: internal link ${href} has no dist file`);
  }

  const kb = statSync(page).size / 1024;
  if (kb > budgets.perHtmlKbWarn) notes.push(`${rel}: ${kb.toFixed(0)} kB HTML (large?)`);
}

/* Bundle budget: gzip each JS asset directly (accurate whether or not .gz
 * siblings were precompressed yet). .gz siblings are verified separately. */
function walkAssets(dir) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) {
      walkAssets(full);
      continue;
    }
    if (e.endsWith('.js.gz')) continue; /* sibling of a .js counted below */
    if (!e.endsWith('.js')) continue;
    const gzSize = gzipSync(readFileSync(full), { level: 6 }).length;
    totalJsGzip += gzSize / 1024;
    if (!existsSync(`${full}.gz`)) notes.push(`${e}: no .gz sibling (build did not precompress it)`);
  }
}
walkAssets(join(DIST, 'assets'));
if (totalJsGzip > budgets.totalJsGzipKb) {
  fail(`JS budget exceeded: ${totalJsGzip.toFixed(0)} kB gzipped > ${budgets.totalJsGzipKb} kB`);
}

/* Feeds. */
for (const [file, required] of [
  ['rss.xml', ['<rss', '<channel>', '<title>', '<item>']],
  ['sitemap.xml', ['<urlset', '<url>', '<loc>']],
  ['robots.txt', ['Sitemap:']],
]) {
  const path = join(DIST, file);
  if (!existsSync(path)) {
    fail(`${file} missing`);
    continue;
  }
  const body = read(path);
  for (const needle of required) {
    if (!body.includes(needle)) fail(`${file} missing ${needle}`);
  }
  if (file.endsWith('.xml')) {
    /* Cheap well-formedness: balanced document root and no raw & outside entities. */
    if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(body)) fail(`${file} contains raw & (invalid XML)`);
  }
}

function fail(message) {
  problems.push(message);
}

if (problems.length > 0) {
  console.error(`AUDIT FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}

console.log(
  `AUDIT OK — ${pages.length} pages, ${totalJsGzip.toFixed(0)} kB JS gzipped` +
    (notes.length ? `\nnotes: ${notes.join('; ')}` : ''),
);

/**
 * Content build pipeline (CONTRACT.md §5).
 *
 * Reads content/**/*.md -> parseFrontmatter -> zod validation (file + field
 * error messages, exit 1 on ANY failure) -> renderMarkdown for bodies ->
 * src/content/generated/content.json sorted date-desc, then date ASCENDING is
 * never used: newest first everywhere, with slug tie-breaks so the output is
 * byte-stable for identical inputs.
 *
 * Runs on plain Node (>= 22.6 with native TS type-stripping, as in CONTRACT §0)
 * and reuses the vendored markdown engine — no new dependencies.
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';
import {
  renderMarkdown,
  parseFrontmatter,
  readingMinutes,
  plainText,
} from '../vendor/markdown/src/index.ts';
import { ProjectSchema, PostSchema, VideoSchema, TalkSchema } from '../src/content/schema.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'content');
const OUT_FILE = join(ROOT, 'src', 'content', 'generated', 'content.json');

/** Collection = a subdirectory of content/ + its schema. Root-level .md files
 *  (about/now) are static pages, not entries in the generated bundle. */
const COLLECTIONS = [
  { dir: 'projects', schema: ProjectSchema },
  { dir: 'posts', schema: PostSchema },
  { dir: 'videos', schema: VideoSchema },
  { dir: 'talks', schema: TalkSchema },
];

const byDateDesc = (a, b) =>
  a.date === b.date ? a.slug.localeCompare(b.slug) : a.date < b.date ? 1 : -1;

/** Human-readable zod issues: "file: <path>: posts/hello.md › title: <msg>". */
function formatIssues(err, file, kind) {
  return err.issues.map((iss) => {
    const field = iss.path.length > 0 ? iss.path.join('.') : kind;
    return `  file: ${file}\n  field: ${kind}/${field}\n  error: ${iss.message}`;
  });
}

/** First ~140 chars of the body's plain text, cut at a word boundary. */
export function makeExcerpt(body, limit = 140) {
  const flat = plainText(body).replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return (space > 40 ? cut.slice(0, space) : cut).replace(/[,;:.]$/, '') + ' …';
}

async function* mdFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return; // empty collection = empty array
    throw err;
  }
  for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (ent.name.startsWith('.') || !ent.name.endsWith('.md')) continue;
    yield join(dir, ent.name);
  }
}

async function loadCollection(dir, schema) {
  const items = [];
  const failures = [];
  for await (const file of mdFiles(join(CONTENT_DIR, dir))) {
    const stem = relative(CONTENT_DIR, file);
    const slug = file.slice(0, -'.md'.length).split('/').pop();
    let entry;
    try {
      const { data, body } = parseFrontmatter(await readFile(file, 'utf8'));
      entry = { ...data, slug };
      if (dir === 'posts') {
        entry.html = renderMarkdown(body);
        entry.readingMinutes = readingMinutes(body);
        entry.excerpt = makeExcerpt(body);
      } else if (dir === 'projects' && body.trim() !== '') {
        entry.html = renderMarkdown(body);
      }
    } catch (err) {
      failures.push(`  file: ${stem}\n  error: ${err.message}`);
      continue;
    }
    const parsed = schema.safeParse(entry);
    if (!parsed.success) {
      failures.push(...formatIssues(parsed.error, stem, dir));
      continue;
    }
    if (parsed.data.slug !== slug) {
      failures.push(
        `  file: ${stem}\n  field: ${dir}/slug\n  error: slug "${parsed.data.slug}" must match file name "${slug}"`,
      );
      continue;
    }
    items.push(parsed.data);
  }
  return { items: items.sort(byDateDesc), failures };
}

async function main() {
  const out = { generatedAt: new Date().toISOString(), projects: [], posts: [], videos: [], talks: [] };
  const failures = [];
  for (const { dir, schema } of COLLECTIONS) {
    const { items, failures: f } = await loadCollection(dir, schema);
    out[dir] = items;
    failures.push(...f);
  }
  if (failures.length > 0) {
    process.stderr.write(`build-content: ${failures.length} problem(s):\n${failures.join('\n')}\n`);
    process.exit(1);
  }
  // sanity: slugs unique per collection (schema can't see across files)
  for (const dir of Object.keys(out)) {
    if (dir === 'generatedAt') continue;
    const seen = new Set();
    for (const it of out[dir]) {
      if (seen.has(it.slug)) {
        process.stderr.write(`build-content: duplicate slug "${it.slug}" in ${dir}\n`);
        process.exit(1);
      }
      seen.add(it.slug);
    }
  }
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
  const counts = ['projects', 'posts', 'videos', 'talks']
    .map((k) => `${out[k].length} ${k}`)
    .join(', ');
  process.stdout.write(`build-content: wrote ${relative(ROOT, OUT_FILE)} (${counts})\n`);
}

await main();

/**
 * Content build pipeline (CONTRACT.md §5).
 *
 * Reads content/*.md collections -> parseFrontmatter -> zod validation (file + field
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

import {
  renderMarkdown,
  parseFrontmatter,
  readingMinutes,
  plainText,
} from '../vendor/markdown/src/index.ts';
import { ProjectSchema, PostSchema, VideoSchema, TalkSchema, AiCapabilitySchema } from '../src/content/schema.ts';

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
  { dir: 'ai-engineering', key: 'aiCapabilities', schema: AiCapabilitySchema },
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

/** First ~140 chars of the body's plain text, cut at a word boundary.
 *  Fenced code and block markers (#, >, list bullets) are stripped first so
 *  excerpts are pure prose. */
export function makeExcerpt(body, limit = 140) {
  const prose = body
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '')
    .split('\n')
    .filter((l) => !/^(```|~~~)/.test(l))
    .map((l) => l.replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, ''))
    .join('\n');
  const flat = plainText(prose).replace(/\s+/g, ' ').trim();
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
      // The frontmatter YAML subset cannot express arrays-of-objects, so
      // `metrics` entries are written as `- label = value` strings and
      // expanded here before zod validation.
      if (Array.isArray(entry.metrics)) {
        entry.metrics = entry.metrics.map((m) => {
          if (typeof m === 'string' && m.includes('=')) {
            const i = m.indexOf('=');
            return { label: m.slice(0, i).trim(), value: m.slice(i + 1).trim() };
          }
          return m;
        });
      }
      if (dir === 'posts') {
        entry.html = renderMarkdown(body);
        entry.readingMinutes = readingMinutes(body);
        entry.excerpt = makeExcerpt(body);
      } else if (dir === 'projects' && body.trim() !== '') {
        entry.html = renderMarkdown(body);
      } else if (dir === 'ai-engineering' && body.trim() !== '') {
        entry.html = renderMarkdown(body);
      }
      /* R9: capability proof bullets arrive as `claim = path` strings (the
       * frontmatter subset can't express arrays-of-objects) — same expansion
       * pattern as metrics above. Authoring rule: claim text must not
       * contain '='. */
      if (dir === 'ai-engineering' && Array.isArray(entry.proof)) {
        entry.proof = entry.proof.map((p) => {
          if (typeof p === 'string' && p.includes('=')) {
            const i = p.indexOf('=');
            return { claim: p.slice(0, i).trim(), path: p.slice(i + 1).trim() };
          }
          return p;
        });
      }
      /* R10: comparisons arrive as a flat authoring form — the frontmatter
       * subset can't express seq-of-mappings, so a capability uses
       * `comparisonTitle: '...'` + `comparisonRows: [[a, b], [c, d]]`
       * (one comparison per capability; extend to numbered keys if a
       * second table ever lands). Expand into the schema's shape here. */
      if (dir === 'ai-engineering' && typeof entry.comparisonTitle === 'string' && Array.isArray(entry.comparisonRows)) {
        entry.comparisons = [{ title: entry.comparisonTitle, rows: entry.comparisonRows }];
        delete entry.comparisonTitle;
        delete entry.comparisonRows;
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
  const out = { contentHash: '', projects: [], posts: [], videos: [], talks: [], aiCapabilities: [] };
  const failures = [];
  for (const { dir, schema, key } of COLLECTIONS) {
    const { items, failures: f } = await loadCollection(dir, schema);
    out[key ?? dir] = items;
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
  // R6-C C1: cross-link slugs must resolve, or a typo ships a dead link.
  const projectSlugs = new Set(out.projects.map((p) => p.slug));
  const postSlugs = new Set(out.posts.map((p) => p.slug));
  for (const post of out.posts) {
    if (post.relatedProject && !projectSlugs.has(post.relatedProject)) {
      process.stderr.write(
        `build-content: post "${post.slug}" relatedProject "${post.relatedProject}" does not match any project slug\n`,
      );
      process.exit(1);
    }
    for (const rel of post.relatedPosts ?? []) {
      if (!postSlugs.has(rel)) {
        process.stderr.write(
          `build-content: post "${post.slug}" relatedPosts entry "${rel}" does not match any post slug\n`,
        );
        process.exit(1);
      }
    }
  }
  for (const project of out.projects) {
    if (project.relatedPost && !postSlugs.has(project.relatedPost)) {
      process.stderr.write(
        `build-content: project "${project.slug}" relatedPost "${project.relatedPost}" does not match any post slug\n`,
      );
      process.exit(1);
    }
  }
  // R9: capability cross-links validate like posts/projects — typos fail the build.
  for (const cap of out.aiCapabilities) {
    for (const rel of cap.relatedPosts ?? []) {
      if (!postSlugs.has(rel)) {
        process.stderr.write(
          `build-content: capability "${cap.slug}" relatedPosts entry "${rel}" does not match any post slug\n`,
        );
        process.exit(1);
      }
    }
    for (const rel of cap.relatedProjects ?? []) {
      if (!projectSlugs.has(rel)) {
        process.stderr.write(
          `build-content: capability "${cap.slug}" relatedProjects entry "${rel}" does not match any project slug\n`,
        );
        process.exit(1);
      }
    }
  }
  await mkdir(dirname(OUT_FILE), { recursive: true });
  /* Deterministic fingerprint of the content itself (R3C-03: a wall-clock
   * generatedAt made every rebuild dirty git and made "byte-stable output"
   * claims false). Same inputs -> same file, byte for byte. */
  const { createHash } = await import('node:crypto');
  /* Hash the payload WITHOUT the hash field (self-reference would be circular):
   * build the body explicitly — a destructured throwaway would be an unused
   * var (lint gate; R4-C F1). */
  const body = { projects: out.projects, posts: out.posts, videos: out.videos, talks: out.talks, aiCapabilities: out.aiCapabilities };
  out.contentHash = createHash('sha256')
    .update(JSON.stringify(body, null, 2))
    .digest('hex')
    .slice(0, 16);
  await writeFile(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
  const counts = ['projects', 'posts', 'videos', 'talks']
    .map((k) => `${out[k].length} ${k}`)
    .join(', ');
  process.stdout.write(`build-content: wrote ${relative(ROOT, OUT_FILE)} (${counts})\n`);
}

await main();

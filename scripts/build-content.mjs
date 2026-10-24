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
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderMarkdown,
  parseFrontmatter,
  readingMinutes,
  plainText,
} from '../vendor/markdown/src/index.ts';
import {
  ProjectSchema,
  PostSchema,
  VideoSchema,
  TalkSchema,
  AiCapabilitySchema,
  RecipeSchema,
  RecipeSourceSchema,
  RecipeBodySchema,
} from '../src/content/schema.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'content');
const OUT_FILE = join(ROOT, 'src', 'content', 'generated', 'content.json');
/** One <slug>.json per recipe body; public/ so the dev server and the build serve them. */
const RECIPE_BODY_DIR = join(ROOT, 'public', 'recipe-bodies');

/** Collection = a subdirectory of content/ + its schema. Root-level .md files
 *  (about/now) are static pages, not entries in the generated bundle. */
const COLLECTIONS = [
  { dir: 'projects', schema: ProjectSchema },
  { dir: 'posts', schema: PostSchema },
  { dir: 'videos', schema: VideoSchema },
  { dir: 'talks', schema: TalkSchema },
  { dir: 'ai-engineering', key: 'aiCapabilities', schema: AiCapabilitySchema },
  /* AI Engineering › Local recipes (rendered under /ai-engineering/local-recipes).
   * Validated with the body; main() moves the body to its own file. */
  { dir: 'recipes', schema: RecipeSourceSchema },
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
      // `metrics` (projects) and `results` (recipes) entries are written as
      // `- label = value` strings and expanded here before zod validation.
      for (const key of ['metrics', 'results']) {
        if (!Array.isArray(entry[key])) continue;
        entry[key] = entry[key].map((m) => {
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
      } else if (dir === 'recipes') {
        /* The body IS the recipe: required, so an empty one fails the schema. */
        if (body.trim() !== '') entry.html = renderMarkdown(body);
        entry.readingMinutes = readingMinutes(body);
      } else if (dir === 'projects' && body.trim() !== '') {
        entry.html = renderMarkdown(body);
      } else if (dir === 'ai-engineering' && body.trim() !== '') {
        entry.html = renderMarkdown(body);
      }
      /* Capability proof bullets arrive as `claim = https://…` or a bare
       * `claim` string (the frontmatter subset can't express
       * arrays-of-objects) — same expansion pattern as metrics above. The
       * right-hand side must be a public URL; the schema rejects anything
       * else, so a workstation path can't be published again. Authoring
       * rule: claim text must not contain '='. */
      if (dir === 'ai-engineering' && Array.isArray(entry.proof)) {
        entry.proof = entry.proof.map((p) => {
          if (typeof p !== 'string') return p;
          if (!p.includes('=')) return { claim: p.trim() };
          const i = p.indexOf('=');
          return { claim: p.slice(0, i).trim(), url: p.slice(i + 1).trim() };
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
  const out = { contentHash: '', projects: [], posts: [], videos: [], talks: [], aiCapabilities: [], recipes: [] };
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
  // Workstation paths never ship: an agent once published its sandbox paths
  // (/opt/data/workspace/...) as "proof". Rendered fields only; frontmatter
  // comments never reach content.json.
  const LOCAL_PATH = /\/opt\/data\b|\/home\/[a-z]|\/fast\/|~\/Projects\b/;
  const pathFailures = [];
  for (const [kind, collection] of Object.entries(out)) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      const hit = LOCAL_PATH.exec(JSON.stringify(item));
      if (hit) pathFailures.push(`  ${kind}/${item.slug}: contains a workstation path ("${hit[0]}…")`);
    }
  }
  if (pathFailures.length > 0) {
    process.stderr.write(`build-content: local file paths must not be published:\n${pathFailures.join('\n')}\n`);
    process.exit(1);
  }
  // R7H-01: markdown images fail closed. This site ships zero external URLs
  // (rot policy), so a remote src is an error too, not just a missing file.
  const PUBLIC_DIR = join(ROOT, 'public');
  const imgRe = /<img\b[^>]*\ssrc="([^"]+)"/g;
  const imageFailures = [];
  const collect = (collection, kind) => {
    for (const item of collection) {
      if (typeof item.html !== 'string') continue; // html is optional on some schemas
      for (const match of item.html.matchAll(imgRe)) {
        const src = match[1];
        if (/^(https?:)?\/\/|^data:/i.test(src)) {
          imageFailures.push(
            `  file: ${kind}/${item.slug}.md\n  error: image src "${src}" is remote — this site ships zero external URLs; commit the image under public/ and reference it locally`,
          );
          continue;
        }
        const rel = src.replace(/^\//, '').split(/[?#]/)[0];
        if (!existsSync(join(PUBLIC_DIR, rel))) {
          imageFailures.push(
            `  file: ${kind}/${item.slug}.md\n  error: image src "${src}" does not exist (looked for public/${rel})`,
          );
        }
      }
    }
  };
  collect(out.projects, 'projects');
  collect(out.posts, 'posts');
  collect(out.videos, 'videos');
  collect(out.talks, 'talks');
  collect(out.aiCapabilities, 'ai-engineering');
  collect(out.recipes, 'recipes');
  if (imageFailures.length > 0) {
    process.stderr.write(
      `build-content: ${imageFailures.length} broken image reference(s):\n${imageFailures.join('\n')}\n`,
    );
    process.exit(1);
  }
  // R7C-1 guardrail: summaries are skim copy. Warn (never fail) when one is
  // a single long sentence or exceeds ~30 words — the grid pages measure
  // this (reviews/round7/R7C-cognitive-language.md).
  const summaryWarnings = [];
  const checkSummary = (collection, kind) => {
    for (const item of collection) {
      if (typeof item.summary !== 'string') continue;
      const words = item.summary.trim().split(/\s+/).length;
      const sentences = item.summary.split(/[.!?]+\s/).filter(Boolean).length;
      if (words > 30 || sentences < 2) {
        summaryWarnings.push(
          `  ${kind}/${item.slug}.md: summary is ${words} words / ${sentences} sentence(s) — skim copy should be ≤2 short sentences, outcome first`,
        );
      }
    }
  };
  checkSummary(out.projects, 'projects');
  checkSummary(out.posts, 'posts');
  checkSummary(out.aiCapabilities, 'ai-engineering');
  checkSummary(out.recipes, 'recipes');
  /* Local recipes: each body ships as its own file and the bundle keeps only
   * what the cards and the "at a glance" block show. Every body in the bundle
   * counted against the site's JS budget (one recipe was 12.8 kB of the 220 kB,
   * gzipped; 2026-10-24); the page loads a body only when someone opens that
   * recipe (src/content/recipe-bodies.ts). bodyHash versions its URL. Files of
   * recipes that no longer exist are removed. Runs after every check above, so
   * the path, image and summary checks still read each body. */
  await mkdir(RECIPE_BODY_DIR, { recursive: true });
  const bodyFiles = new Set();
  out.recipes = await Promise.all(
    out.recipes.map(async ({ html, ...recipe }) => {
      const file = `${recipe.slug}.json`;
      const bodyJson = JSON.stringify(RecipeBodySchema.parse({ slug: recipe.slug, html }), null, 2);
      await writeFile(join(RECIPE_BODY_DIR, file), bodyJson + '\n', 'utf8');
      bodyFiles.add(file);
      const bodyHash = createHash('sha256').update(html).digest('hex').slice(0, 12);
      return RecipeSchema.parse({ ...recipe, bodyHash });
    }),
  );
  for (const file of await readdir(RECIPE_BODY_DIR)) {
    if (file.endsWith('.json') && !bodyFiles.has(file)) await rm(join(RECIPE_BODY_DIR, file));
  }
  await mkdir(dirname(OUT_FILE), { recursive: true });
  /* Deterministic fingerprint of the content itself (R3C-03: a wall-clock
   * generatedAt made every rebuild dirty git and made "byte-stable output"
   * claims false). Same inputs -> same file, byte for byte. */
  /* Hash the payload WITHOUT the hash field (self-reference would be circular):
   * build the body explicitly — a destructured throwaway would be an unused
   * var (lint gate; R4-C F1). */
  const body = {
    projects: out.projects,
    posts: out.posts,
    videos: out.videos,
    talks: out.talks,
    aiCapabilities: out.aiCapabilities,
    recipes: out.recipes,
  };
  out.contentHash = createHash('sha256')
    .update(JSON.stringify(body, null, 2))
    .digest('hex')
    .slice(0, 16);
  await writeFile(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
  const counts = ['projects', 'posts', 'videos', 'talks', 'recipes']
    .map((k) => `${out[k].length} ${k}`)
    .join(', ');
  process.stdout.write(`build-content: wrote ${relative(ROOT, OUT_FILE)} (${counts})\n`);
  process.stdout.write(
    `build-content: wrote ${bodyFiles.size} recipe bod${bodyFiles.size === 1 ? 'y' : 'ies'} to ${relative(ROOT, RECIPE_BODY_DIR)}/\n`,
  );
}

await main();

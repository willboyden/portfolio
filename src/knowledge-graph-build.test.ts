/**
 * The knowledge graph's build step (scripts/knowledge-graph.mjs) and the file it
 * wrote (public/knowledge-graph.json). The file must come from THIS content:
 * build-content.mjs rewrites it on every build, and a stale one fails here, as
 * a stale post body does.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import raw from './content/generated/content.json';
import { KnowledgeGraphSchema } from './content/knowledge-graph';

interface Node {
  id: string;
  type: string;
  label: string;
  url?: string;
  summary?: string;
}
interface GraphModule {
  topicKey(label: string): string;
  internalLinks(html: unknown): string[];
  buildKnowledgeGraph(content: unknown): { nodes: Node[]; edges: [string, string, string][] };
  layoutGraph(nodes: Node[], edges: [string, string, string][], opts?: { iterations?: number; seed?: number }): number[][];
  graphFile(content: unknown, contentHash: string): unknown;
  MIN_TOPIC_ITEMS: number;
}

const ROOT = resolve(import.meta.dirname, '..');
const mod = (await import(pathToFileURL(resolve(ROOT, 'scripts/knowledge-graph.mjs')).href)) as GraphModule;

const empty = { projects: [], posts: [], videos: [], talks: [], aiCapabilities: [], recipes: [] };
const fixture = {
  ...empty,
  projects: [
    { slug: 'alpha', title: 'Alpha', summary: 'First.', tags: ['security', 'mcp'], stack: ['Python 3.13', 'SQLite (WAL)'], relatedPost: 'one' },
    { slug: 'beta', title: 'Beta', summary: 'Second.', tags: ['Security'], stack: ['python', 'Rust'] },
  ],
  posts: [
    { slug: 'one', title: 'One', summary: 'Post one.', tags: ['mcp'], series: 'Notes', html: '<p><a href="/projects/beta">beta</a> <a href="//evil.example/x">x</a> <a href="/writing/two/">two</a></p>' },
    { slug: 'two', title: 'Two', summary: 'Post two.', tags: ['solo-tag'], series: 'Notes', relatedPosts: ['one'] },
  ],
};

describe('topicKey', () => {
  it('merges spellings, versions and notes in parentheses', () => {
    expect(mod.topicKey('Python 3.13')).toBe('python');
    expect(mod.topicKey('python')).toBe('python');
    expect(mod.topicKey('SQLite (WAL)')).toBe('sqlite');
    expect(mod.topicKey('Vanilla JS/CSS')).toBe('vanilla js css');
    expect(mod.topicKey('  ')).toBe('');
  });
});

describe('internalLinks', () => {
  it('keeps root-absolute site links only, without a trailing slash', () => {
    expect(mod.internalLinks('<a href="/writing/x/">a</a><a href="https://x.y/z">b</a><a href="//h/p">c</a><a href="/">d</a>')).toEqual([
      '/writing/x',
      '/',
    ]);
    expect(mod.internalLinks(undefined)).toEqual([]);
  });
});

describe('buildKnowledgeGraph', () => {
  const g = mod.buildKnowledgeGraph(fixture);
  const ids = g.nodes.map((n) => n.id);
  const edge = (a: string, b: string): string | undefined =>
    g.edges.find((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))?.[2];

  it('has a node per item and per non-empty section, with its page', () => {
    expect(ids).toEqual(expect.arrayContaining(['project:alpha', 'project:beta', 'post:one', 'post:two', 'section:projects', 'section:writing']));
    expect(ids).not.toContain('section:talks'); /* empty collections get no section */
    expect(g.nodes.find((n) => n.id === 'project:alpha')).toMatchObject({ url: '/projects/alpha', label: 'Alpha', summary: 'First.' });
  });

  it('keeps only topics at least two items share, merged across tags and stacks', () => {
    expect(mod.MIN_TOPIC_ITEMS).toBe(2);
    expect(ids).toContain('topic:security'); /* "security" + "Security" */
    expect(ids).toContain('topic:python'); /* "Python 3.13" + "python" */
    expect(ids).toContain('topic:mcp');
    expect(ids).not.toContain('topic:rust');
    expect(ids).not.toContain('topic:solo-tag');
    expect(g.nodes.find((n) => n.id === 'topic:python')?.label).toBe('Python'); /* the stack spelling, version dropped */
  });

  it('links series, cross-links and body links, the strongest kind winning', () => {
    expect(ids).toContain('series:notes');
    expect(edge('post:one', 'series:notes')).toBe('series');
    expect(edge('project:alpha', 'post:one')).toBe('related'); /* frontmatter */
    expect(edge('post:one', 'project:beta')).toBe('mentions'); /* body link */
    expect(edge('post:two', 'post:one')).toBe('related'); /* related beats the body link */
    expect(edge('section:projects', 'project:alpha')).toBe('section');
    expect(edge('project:alpha', 'topic:mcp')).toBe('topic');
  });

  it('has one edge per pair and none to itself', () => {
    const keys = g.edges.map(([a, b]) => [a, b].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(g.edges.every(([a, b]) => a !== b)).toBe(true);
  });
});

describe('layoutGraph', () => {
  const g = mod.buildKnowledgeGraph(fixture);
  it('is deterministic and stays inside the unit ball', () => {
    const a = mod.layoutGraph(g.nodes, g.edges, { iterations: 120 });
    const b = mod.layoutGraph(g.nodes, g.edges, { iterations: 120 });
    expect(a).toEqual(b);
    for (const p of a) {
      expect(p.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0)).toBeLessThanOrEqual(1.0001);
    }
    expect(Math.max(...a.map((p) => Math.hypot(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0)))).toBeGreaterThan(0.99);
  });
  it('handles an empty graph', () => {
    expect(mod.layoutGraph([], [])).toEqual([]);
  });
});

describe('graphFile', () => {
  it('matches the schema the page validates', () => {
    expect(KnowledgeGraphSchema.safeParse(mod.graphFile(fixture, 'abc')).success).toBe(true);
  });
});

describe('public/knowledge-graph.json (the file the site ships)', () => {
  const file = KnowledgeGraphSchema.parse(JSON.parse(readFileSync(resolve(ROOT, 'public/knowledge-graph.json'), 'utf8')));
  const site = raw as { contentHash: string; projects: { slug: string }[]; posts: { slug: string }[]; aiCapabilities: { slug: string }[]; recipes: { slug: string }[] };

  it('was built from this content.json — run node scripts/build-content.mjs if not', () => {
    expect(file.contentHash).toBe(site.contentHash);
  });

  it('has a node for every page the site has, linking to it', () => {
    const urls = new Set(file.nodes.map((n) => n.url));
    for (const p of site.projects) expect(urls).toContain(`/projects/${p.slug}`);
    for (const p of site.posts) expect(urls).toContain(`/writing/${p.slug}`);
    for (const c of site.aiCapabilities) expect(urls).toContain(`/ai-engineering/${c.slug}`);
    for (const r of site.recipes) expect(urls).toContain(`/ai-engineering/local-recipes/${r.slug}`);
  });

  it('ships no workstation paths or off-site links', () => {
    const text = JSON.stringify(file);
    expect(text).not.toMatch(/\/opt\/data\b|\/home\/[a-z]|\/fast\/|~\/Projects\b/);
    expect(text).not.toMatch(/https?:\/\//);
  });
});

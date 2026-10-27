/**
 * Knowledge graph of the site's own content, built at content-build time
 * (scripts/build-content.mjs) and written to public/knowledge-graph.json, so
 * every build — and so every deploy — redraws it from what the site actually
 * says. The /graph page (src/pages/KnowledgeGraph.tsx) fetches the file; it is
 * NOT in the JS bundle, so the graph never counts against the 220 kB budget.
 *
 * Nodes:
 *   section:*  the site's sections (Projects, Writing, AI Engineering, …)
 *   item       every project, post, AI capability, recipe, talk and video
 *   topic:*    a tag or a stack entry shared by at least two items. Tags and
 *              stack entries merge on a normalized key ("Python 3.13", "python"
 *              → python), so one technology is one node however it is spelled.
 *   series:*   a post series with at least two posts
 * Edges (one per pair, the strongest kind wins): related (frontmatter cross-
 * links) > mentions (a link inside a body) > series > section > topic.
 *
 * The 3D layout is computed here too (a seeded force layout), so the page only
 * draws: same content → same file, byte for byte, like content.json.
 */

export const GRAPH_VERSION = 1;

/** Below this many items, a topic is only a leaf and adds clutter, not links. */
export const MIN_TOPIC_ITEMS = 2;

const SUMMARY_MAX = 180;

/** Content collections in graph order: key in content.json, node type, routes. */
export const SECTIONS = [
  { key: 'projects', type: 'project', id: 'section:projects', label: 'Projects', url: '/projects', item: (s) => `/projects/${s}` },
  { key: 'posts', type: 'post', id: 'section:writing', label: 'Writing', url: '/writing', item: (s) => `/writing/${s}` },
  {
    key: 'aiCapabilities',
    type: 'capability',
    id: 'section:ai-engineering',
    label: 'AI Engineering',
    url: '/ai-engineering',
    item: (s) => `/ai-engineering/${s}`,
  },
  {
    key: 'recipes',
    type: 'recipe',
    id: 'section:local-recipes',
    label: 'Local recipes',
    url: '/ai-engineering/local-recipes',
    item: (s) => `/ai-engineering/local-recipes/${s}`,
    parent: 'section:ai-engineering',
  },
  /* Talks and videos have no detail pages: their nodes open the section. */
  { key: 'talks', type: 'talk', id: 'section:talks', label: 'Talks', url: '/talks', item: () => '/talks' },
  { key: 'videos', type: 'video', id: 'section:videos', label: 'Videos', url: '/videos', item: () => '/videos' },
];

const EDGE_RANK = { related: 5, mentions: 4, series: 3, section: 2, topic: 1 };

/** Normalized key for a tag or stack entry: lowercase, no "(…)", no version. */
export function topicKey(label) {
  return String(label)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(^|\s)v?\d+(\.\d+)*\+?(?=\s|$)/g, ' ')
    .replace(/[^a-z0-9+#.\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Display label for a stack entry: the original without "(…)" or a version. */
function cleanLabel(label) {
  return String(label)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+v?\d+(\.\d+)+\+?$/, '')
    .trim();
}

function shortSummary(text) {
  if (typeof text !== 'string') return undefined;
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= SUMMARY_MAX) return flat;
  const cut = flat.slice(0, SUMMARY_MAX - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), SUMMARY_MAX - 40)).trimEnd()}…`;
}

/** Root-absolute internal hrefs in rendered markdown ("/writing/x", not "//host"). */
export function internalLinks(html) {
  if (typeof html !== 'string') return [];
  const out = [];
  for (const m of html.matchAll(/\shref="(\/(?!\/)[^"#?]*)/g)) {
    out.push(m[1].length > 1 ? m[1].replace(/\/$/, '') : m[1]);
  }
  return out;
}

/**
 * Nodes and edges from content (content.json's shape, with body `html` still
 * attached where a collection has one, so body links can be read).
 * @returns {{ nodes: object[], edges: [string, string, string][] }}
 */
export function buildKnowledgeGraph(content) {
  const nodes = new Map();
  const edges = new Map();
  const addEdge = (a, b, kind) => {
    if (a === b || !nodes.has(a) || !nodes.has(b)) return;
    const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
    const prev = edges.get(key);
    if (!prev || EDGE_RANK[kind] > EDGE_RANK[prev[2]]) edges.set(key, a < b ? [a, b, kind] : [b, a, kind]);
  };

  /* Sections (only those with content) and every item. */
  const byRoute = new Map();
  const items = [];
  for (const section of SECTIONS) {
    const list = content[section.key] ?? [];
    if (list.length === 0) continue;
    nodes.set(section.id, { id: section.id, type: 'section', label: section.label, url: section.url });
    byRoute.set(section.url, section.id);
    for (const item of list) {
      const id = `${section.type}:${item.slug}`;
      const url = section.item(item.slug);
      const summary = shortSummary(item.summary ?? item.oneLiner ?? item.abstract);
      nodes.set(id, { id, type: section.type, label: item.title, url, ...(summary ? { summary } : {}) });
      if (url !== section.url) byRoute.set(url, id);
      items.push({ id, item, section });
    }
  }
  for (const section of SECTIONS) {
    if (section.parent && nodes.has(section.id)) addEdge(section.parent, section.id, 'section');
  }
  for (const { id, section } of items) addEdge(section.id, id, 'section');

  /* Topics: tags + stack entries (+ a recipe's engine), merged by key. */
  const topics = new Map();
  const noteTopic = (raw, itemId, fromStack) => {
    const key = topicKey(raw);
    if (!key) return;
    const t = topics.get(key) ?? { key, label: '', stackLabel: '', items: new Set() };
    if (fromStack && !t.stackLabel) t.stackLabel = cleanLabel(raw);
    if (!fromStack && !t.label) t.label = String(raw);
    t.items.add(itemId);
    topics.set(key, t);
  };
  for (const { id, item } of items) {
    for (const tag of item.tags ?? []) noteTopic(tag, id, false);
    for (const tech of item.stack ?? []) noteTopic(tech, id, true);
    if (typeof item.engine === 'string') noteTopic(item.engine, id, true);
  }
  for (const t of [...topics.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    if (t.items.size < MIN_TOPIC_ITEMS) continue;
    const id = `topic:${t.key}`;
    nodes.set(id, { id, type: 'topic', label: t.stackLabel || t.label || t.key });
    for (const itemId of [...t.items].sort()) addEdge(itemId, id, 'topic');
  }

  /* Post series. */
  const series = new Map();
  for (const { id, item, section } of items) {
    if (section.key !== 'posts' || !item.series) continue;
    const list = series.get(item.series) ?? [];
    list.push(id);
    series.set(item.series, list);
  }
  for (const [name, members] of [...series.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (members.length < 2) continue;
    const id = `series:${topicKey(name)}`;
    nodes.set(id, { id, type: 'series', label: name, url: '/writing' });
    for (const m of members) addEdge(m, id, 'series');
  }

  /* Frontmatter cross-links and links inside bodies. */
  for (const { id, item } of items) {
    if (item.relatedProject) addEdge(id, `project:${item.relatedProject}`, 'related');
    if (item.relatedPost) addEdge(id, `post:${item.relatedPost}`, 'related');
    for (const s of item.relatedPosts ?? []) addEdge(id, `post:${s}`, 'related');
    for (const s of item.relatedProjects ?? []) addEdge(id, `project:${s}`, 'related');
    for (const href of internalLinks(item.html)) {
      const target = byRoute.get(href);
      if (target) addEdge(id, target, 'mentions');
    }
  }

  const sortedNodes = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...edges.values()].sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  return { nodes: sortedNodes, edges: sortedEdges };
}

/** Small seeded PRNG (mulberry32): the layout must not change between builds. */
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPRING = { related: 0.6, mentions: 0.7, series: 0.8, section: 1.4, topic: 1 };

/**
 * A 3D force layout (Fruchterman–Reingold with gravity), seeded so the same
 * graph always lands in the same place. Coordinates are scaled into the unit
 * ball and rounded to 4 decimals (stable JSON, ~1/10000 of the view).
 * @returns {number[][]} [x, y, z] per node, in `nodes` order
 */
export function layoutGraph(nodes, edges, { iterations = 400, seed = 1 } = {}) {
  const n = nodes.length;
  if (n === 0) return [];
  const rand = prng(seed);
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const pos = nodes.map(() => {
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const r = Math.cbrt(rand());
    const s = Math.sqrt(1 - u * u);
    return [r * s * Math.cos(phi), r * s * Math.sin(phi), r * u];
  });
  const links = edges
    .map(([a, b, kind]) => [index.get(a), index.get(b), SPRING[kind] ?? 1])
    .filter(([a, b]) => a !== undefined && b !== undefined);
  const k = 0.9 / Math.cbrt(n);
  const disp = nodes.map(() => [0, 0, 0]);
  for (let step = 0; step < iterations; step++) {
    const temp = 0.12 * (1 - step / iterations) + 0.002;
    for (const d of disp) d[0] = d[1] = d[2] = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const dz = pos[i][2] - pos[j][2];
        const d2 = dx * dx + dy * dy + dz * dz + 1e-6;
        const f = (k * k) / d2;
        disp[i][0] += dx * f; disp[i][1] += dy * f; disp[i][2] += dz * f;
        disp[j][0] -= dx * f; disp[j][1] -= dy * f; disp[j][2] -= dz * f;
      }
    }
    for (const [a, b, len] of links) {
      const dx = pos[a][0] - pos[b][0];
      const dy = pos[a][1] - pos[b][1];
      const dz = pos[a][2] - pos[b][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
      const f = d / (k * len);
      disp[a][0] -= dx * f; disp[a][1] -= dy * f; disp[a][2] -= dz * f;
      disp[b][0] += dx * f; disp[b][1] += dy * f; disp[b][2] += dz * f;
    }
    for (let i = 0; i < n; i++) {
      const p = pos[i];
      const d = disp[i];
      d[0] -= p[0] * 0.6; d[1] -= p[1] * 0.6; d[2] -= p[2] * 0.6; /* gravity */
      const len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) + 1e-9;
      const move = Math.min(len, temp) / len;
      p[0] += d[0] * move; p[1] += d[1] * move; p[2] += d[2] * move;
    }
  }
  const c = [0, 1, 2].map((ax) => pos.reduce((s, p) => s + p[ax], 0) / n);
  const radius = Math.max(...pos.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]))) || 1;
  const round = (v) => Math.round(v * 10000) / 10000 + 0; /* + 0: no "-0" in the JSON */
  return pos.map((p) => [0, 1, 2].map((ax) => round((p[ax] - c[ax]) / radius)));
}

/**
 * The file the /graph page loads: nodes with their position, edges as node
 * indexes. `contentHash` ties it to the content.json it was built from (a unit
 * test fails a stale file, as it does a stale post body).
 */
export function graphFile(content, contentHash) {
  const { nodes, edges } = buildKnowledgeGraph(content);
  const positions = layoutGraph(nodes, edges);
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  return {
    version: GRAPH_VERSION,
    contentHash,
    nodes: nodes.map((node, i) => ({ ...node, x: positions[i][0], y: positions[i][1], z: positions[i][2] })),
    edges: edges.map(([a, b, kind]) => [index.get(a), index.get(b), kind]),
  };
}

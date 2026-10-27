/**
 * The knowledge graph the /graph page draws: scripts/build-content.mjs builds
 * it from this site's content on every build (scripts/knowledge-graph.mjs) and
 * writes public/knowledge-graph.json. Like post bodies (./post-bodies.ts), it
 * stays out of the JS bundle and reaches the page from one of two places:
 *
 *   1. the prerender (prerender/entry.ts) reads the file and primes it, so the
 *      static /graph page carries the full list of pages and connections for
 *      no-JS readers and crawlers;
 *   2. the client fetches it once (same origin, CSP connect-src 'self'), the
 *      URL versioned by content.json's contentHash, which changes whenever any
 *      content does.
 */
import { z } from 'zod';
import { withBase } from 'app/lib/seo';

export const GRAPH_NODE_TYPES = ['section', 'project', 'post', 'capability', 'recipe', 'talk', 'video', 'topic', 'series'] as const;
export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];
export const GRAPH_EDGE_KINDS = ['related', 'mentions', 'series', 'section', 'topic'] as const;
export type GraphEdgeKind = (typeof GRAPH_EDGE_KINDS)[number];

/* Site routes only: root-absolute, no scheme, no "//host". */
const SiteRoute = z.string().regex(/^\/(?!\/)[a-z0-9\-/]*$/, 'expected a root-absolute site route');
const Coord = z.number().min(-1.0001).max(1.0001);

export const GraphNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(GRAPH_NODE_TYPES),
    label: z.string().min(1),
    url: SiteRoute.optional(),
    summary: z.string().min(1).optional(),
    x: Coord,
    y: Coord,
    z: Coord,
  })
  .strict();

export const KnowledgeGraphSchema = z
  .object({
    version: z.literal(1),
    contentHash: z.string().min(1),
    nodes: z.array(GraphNodeSchema),
    edges: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), z.enum(GRAPH_EDGE_KINDS)])),
  })
  .strict()
  .superRefine((g, ctx) => {
    for (const [a, b] of g.edges) {
      if (a >= g.nodes.length || b >= g.nodes.length || a === b) {
        ctx.addIssue({ code: 'custom', message: `edge [${a}, ${b}] does not join two different nodes` });
        return;
      }
    }
  });

export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;

let cached: KnowledgeGraph | undefined;

/** Keep a graph read by the prerender (or a test) for synchronous rendering. */
export function primeKnowledgeGraph(graph: unknown): KnowledgeGraph {
  cached = KnowledgeGraphSchema.parse(graph);
  return cached;
}

/** The graph if this page already has it. */
export function cachedKnowledgeGraph(): KnowledgeGraph | undefined {
  return cached;
}

/** Where the graph file is served, versioned by the content it was built from. */
export function knowledgeGraphUrl(contentHash: string): string {
  return withBase(`/knowledge-graph.json?v=${contentHash}`);
}

/** The graph: cached, else fetched once. Rejects on HTTP errors, an invalid
 * file, and a file built from other content than this bundle's. */
export async function loadKnowledgeGraph(
  contentHash: string,
  fetcher: (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>> = (url) => fetch(url),
): Promise<KnowledgeGraph> {
  if (cached && cached.contentHash === contentHash) return cached;
  const res = await fetcher(knowledgeGraphUrl(contentHash));
  if (!res.ok) throw new Error(`knowledge graph: HTTP ${res.status}`);
  const parsed = KnowledgeGraphSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error('knowledge graph: the file is not a valid graph');
  if (parsed.data.contentHash !== contentHash) throw new Error('knowledge graph: the file was built from other content');
  cached = parsed.data;
  return cached;
}

/** Neighbours of each node (indexes), and each node's degree. */
export function adjacency(graph: KnowledgeGraph): number[][] {
  const out = graph.nodes.map((): number[] => []);
  for (const [a, b] of graph.edges) {
    out[a]?.push(b);
    out[b]?.push(a);
  }
  return out;
}

/** Reset the cache (tests only). */
export function resetKnowledgeGraphForTests(): void {
  cached = undefined;
}

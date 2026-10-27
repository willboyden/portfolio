/**
 * Loading the knowledge graph file (./knowledge-graph.ts): versioned URL, cache,
 * and refusing a file that is broken or built from other content.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  KnowledgeGraphSchema,
  adjacency,
  cachedKnowledgeGraph,
  knowledgeGraphUrl,
  loadKnowledgeGraph,
  primeKnowledgeGraph,
  resetKnowledgeGraphForTests,
  type KnowledgeGraph,
} from './knowledge-graph';

const graph: KnowledgeGraph = {
  version: 1,
  contentHash: 'h1',
  nodes: [
    { id: 'section:projects', type: 'section', label: 'Projects', url: '/projects', x: 0, y: 0, z: 0 },
    { id: 'project:a', type: 'project', label: 'A', url: '/projects/a', summary: 'A project.', x: 0.5, y: 0, z: 0 },
    { id: 'topic:mcp', type: 'topic', label: 'MCP', x: -0.5, y: 0.2, z: 0.1 },
  ],
  edges: [
    [0, 1, 'section'],
    [1, 2, 'topic'],
  ],
};

const reply = (status: number, body: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

afterEach(() => resetKnowledgeGraphForTests());

describe('KnowledgeGraphSchema', () => {
  it('accepts a graph and refuses edges to missing nodes, self-loops and off-site urls', () => {
    expect(KnowledgeGraphSchema.safeParse(graph).success).toBe(true);
    expect(KnowledgeGraphSchema.safeParse({ ...graph, edges: [[0, 9, 'topic']] }).success).toBe(false);
    expect(KnowledgeGraphSchema.safeParse({ ...graph, edges: [[1, 1, 'topic']] }).success).toBe(false);
    const offsite = { ...graph, nodes: [{ ...graph.nodes[0], url: '//evil.example/x' }, ...graph.nodes.slice(1)] };
    expect(KnowledgeGraphSchema.safeParse(offsite).success).toBe(false);
    const js = { ...graph, nodes: [{ ...graph.nodes[0], url: 'javascript:alert(1)' }, ...graph.nodes.slice(1)] };
    expect(KnowledgeGraphSchema.safeParse(js).success).toBe(false);
  });
});

describe('loadKnowledgeGraph', () => {
  it('fetches the versioned file once, then serves the cache', async () => {
    let calls = 0;
    const urls: string[] = [];
    const fetcher = async (url: string) => {
      calls++;
      urls.push(url);
      return reply(200, graph)();
    };
    await expect(loadKnowledgeGraph('h1', fetcher)).resolves.toMatchObject({ contentHash: 'h1' });
    await loadKnowledgeGraph('h1', fetcher);
    expect(calls).toBe(1);
    expect(urls[0]).toBe(knowledgeGraphUrl('h1'));
    expect(urls[0]).toMatch(/\/knowledge-graph\.json\?v=h1$/);
    expect(cachedKnowledgeGraph()?.nodes).toHaveLength(3);
  });

  it('rejects HTTP errors, invalid files and files built from other content', async () => {
    await expect(loadKnowledgeGraph('h1', reply(404, null))).rejects.toThrow(/HTTP 404/);
    await expect(loadKnowledgeGraph('h1', reply(200, { nope: true }))).rejects.toThrow(/not a valid graph/);
    await expect(loadKnowledgeGraph('h2', reply(200, graph))).rejects.toThrow(/other content/);
    expect(cachedKnowledgeGraph()).toBeUndefined();
  });

  it('uses a primed graph without fetching', async () => {
    primeKnowledgeGraph(graph);
    await expect(loadKnowledgeGraph('h1', reply(500, null))).resolves.toBe(cachedKnowledgeGraph());
  });
});

describe('adjacency', () => {
  it('lists each node’s neighbours both ways', () => {
    expect(adjacency(graph)).toEqual([[1], [0, 2], [1]]);
  });
});

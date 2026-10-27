/**
 * /graph (src/pages/KnowledgeGraph.tsx), rendered to static HTML the way the
 * prerender does (no DOM: environment 'node'). Uses the real shipped graph
 * file, so these also prove the panel and the list link every page the site has.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { RouterProvider, type RouteDefinition } from '@portfolio/router';
import { AppThemeProvider } from 'app/theme/ThemeProvider';
import { content } from 'app/content';
import { adjacency, primeKnowledgeGraph, resetKnowledgeGraphForTests } from 'app/content/knowledge-graph';
import {
  GraphList,
  KnowledgeGraph,
  SelectionPanel,
  TYPE_INFO,
  TYPE_ORDER,
  groupNodes,
  indexOfId,
  nodeRadius,
  searchNodes,
} from './KnowledgeGraph';

const routes: RouteDefinition[] = [{ path: '*', component: () => null }];
const render = (ui: ReactNode): string =>
  renderToStaticMarkup(createElement(AppThemeProvider, null, createElement(RouterProvider, { routes, initialPath: '/graph' }, ui)));

const file = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../public/knowledge-graph.json'), 'utf8')) as unknown;

afterEach(() => resetKnowledgeGraphForTests());

describe('KnowledgeGraph page', () => {
  it('shows a loading state until the graph arrives', () => {
    resetKnowledgeGraphForTests();
    const html = render(<KnowledgeGraph />);
    expect(html).toContain('Knowledge graph');
    expect(html).toContain('Loading the graph');
    expect(html).not.toContain('data-testid="graph-canvas"');
  });

  it('prerenders the graph, the starting links and every page with its connections', () => {
    const graph = primeKnowledgeGraph(file);
    const html = render(<KnowledgeGraph />);
    expect(html).toContain('data-testid="graph-canvas"');
    expect(html).toMatch(/role="img"/);
    expect(html).toContain(`${graph.edges.length} connections`);
    /* The starting panel links every section. */
    for (const n of graph.nodes.filter((x) => x.type === 'section')) expect(html).toContain(`href="${n.url}"`);
    /* The list links every page the site has. */
    for (const p of content.projects) expect(html).toContain(`href="/projects/${p.slug}"`);
    for (const p of content.posts) expect(html).toContain(`href="/writing/${p.slug}"`);
    for (const c of content.aiCapabilities) expect(html).toContain(`href="/ai-engineering/${c.slug}"`);
  });
});

describe('SelectionPanel', () => {
  it('links the selected page and every page connected to it', () => {
    const graph = primeKnowledgeGraph(file);
    const neighbours = adjacency(graph);
    const i = graph.nodes.findIndex((n) => n.type === 'project' && (neighbours[graph.nodes.indexOf(n)]?.length ?? 0) > 3);
    const node = graph.nodes[i];
    expect(node).toBeDefined();
    const html = render(<SelectionPanel graph={graph} neighbours={neighbours} selected={i} onSelect={() => {}} />);
    expect(html).toContain('data-testid="graph-open-link"');
    expect(html).toContain(`href="${node?.url}"`);
    for (const j of neighbours[i] ?? []) {
      const m = graph.nodes[j];
      if (m?.url && m.type !== 'topic') expect(html).toContain(`href="${m.url}"`);
    }
  });

  it('lists every page about a topic', () => {
    const graph = primeKnowledgeGraph(file);
    const neighbours = adjacency(graph);
    const t = graph.nodes.findIndex((n) => n.type === 'topic');
    const html = render(<SelectionPanel graph={graph} neighbours={neighbours} selected={t} onSelect={() => {}} />);
    expect(html).toContain(`Pages about ${graph.nodes[t]?.label}`);
    expect(html).not.toContain('data-testid="graph-open-link"'); /* a topic has no page of its own */
    const pages = (neighbours[t] ?? []).filter((j) => graph.nodes[j]?.url);
    expect((html.match(/<a /g) ?? []).length).toBeGreaterThanOrEqual(pages.length);
  });
});

describe('GraphList', () => {
  it('names each page’s topics', () => {
    const graph = primeKnowledgeGraph(file);
    const html = render(<GraphList graph={graph} neighbours={adjacency(graph)} />);
    expect(html).toContain('Every page and its connections');
    expect(html).toContain('Topics:');
  });
});

describe('helpers', () => {
  const graph = primeKnowledgeGraph(file);
  const neighbours = adjacency(graph);

  it('groups nodes in display order, sorted by label', () => {
    const groups = groupNodes(graph, graph.nodes.map((_, i) => i));
    expect(groups.map((g) => g.type)).toEqual(TYPE_ORDER.filter((t) => graph.nodes.some((n) => n.type === t)));
    for (const g of groups) {
      const labels = g.indexes.map((i) => graph.nodes[i]?.label ?? '');
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    }
  });

  it('searches labels and slugs, prefix matches first, respecting hidden types', () => {
    const mcp = searchNodes(graph, neighbours, 'mcp');
    expect(mcp.length).toBeGreaterThan(0);
    expect(graph.nodes[mcp[0] ?? -1]?.label.toLowerCase().startsWith('mcp')).toBe(true);
    expect(searchNodes(graph, neighbours, 'mcp', new Set(['topic'])).every((i) => graph.nodes[i]?.type !== 'topic')).toBe(true);
    expect(searchNodes(graph, neighbours, '   ')).toEqual([]);
    expect(searchNodes(graph, neighbours, 'zzzz-nothing')).toEqual([]);
  });

  it('finds nodes by id and sizes topics by how many pages share them', () => {
    expect(indexOfId(graph, 'section:projects')).toBeGreaterThanOrEqual(0);
    expect(indexOfId(graph, 'nope')).toBe(-1);
    const topic = graph.nodes.find((n) => n.type === 'topic');
    expect(topic && nodeRadius(topic, 16)).toBeGreaterThan(topic ? nodeRadius(topic, 1) : 0);
    expect(nodeRadius({ ...graph.nodes[0]!, type: 'project' }, 50)).toBe(TYPE_INFO.project.radius);
  });
});

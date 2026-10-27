/**
 * /graph — a 3D knowledge graph of this site: every project, post, AI
 * capability and recipe, the sections they live in, and the topics they share.
 * scripts/build-content.mjs rebuilds the graph from the content on every build
 * (so every deploy), and src/content/knowledge-graph.ts loads it.
 *
 * Interacting with a node always ends in links to the site's pages: the side
 * panel shows the selected node's own page and every connected page, grouped by
 * section; a topic lists every page about it. Double-click opens a node's page.
 *
 * A11Y: the canvas is one labelled image; everything it shows is also in the
 * search, the panel (real links and buttons) and the full list below the graph,
 * which the prerender writes into the static HTML for no-JS readers.
 *
 * The home page shows the same explorer (KnowledgeGraphPreview), smaller and
 * without the full list, which stays on /graph.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { Link, useNavigate } from '@portfolio/router';
import { Button, EmptyState, Heading, Spinner } from 'app/components/ui';
import { contentHash } from 'app/content';
import {
  adjacency,
  cachedKnowledgeGraph,
  loadKnowledgeGraph,
  type GraphNode,
  type GraphNodeType,
  type KnowledgeGraph as Graph,
} from 'app/content/knowledge-graph';
import { darkTheme, type Tokens } from 'app/theme/tokens';
import type { GraphScene, SceneNode, ScenePalette } from 'app/lib/graph3d';

/* -------------------------------------------------------------------------- */
/* Graph helpers (pure; unit-tested)                                           */
/* -------------------------------------------------------------------------- */

type ColorKey = keyof Tokens['color'];

export interface TypeInfo {
  /** One node of this type ("Project"). */
  label: string;
  /** The group heading in lists ("Projects"). */
  group: string;
  radius: number;
  color: ColorKey;
}

/** Display order and look of each node type. */
export const TYPE_INFO: Record<GraphNodeType, TypeInfo> = {
  section: { label: 'Section', group: 'Sections', radius: 9, color: 'text' },
  project: { label: 'Project', group: 'Projects', radius: 6.5, color: 'accent' },
  capability: { label: 'AI capability', group: 'AI Engineering', radius: 6.5, color: 'warning' },
  recipe: { label: 'Local recipe', group: 'Local recipes', radius: 6, color: 'danger' },
  post: { label: 'Post', group: 'Writing', radius: 5.5, color: 'success' },
  series: { label: 'Series', group: 'Series', radius: 6, color: 'textMuted' },
  talk: { label: 'Talk', group: 'Talks', radius: 5.5, color: 'focus' },
  video: { label: 'Video', group: 'Videos', radius: 5.5, color: 'focus' },
  topic: { label: 'Topic', group: 'Topics', radius: 3, color: 'textSubtle' },
};

export const TYPE_ORDER = Object.keys(TYPE_INFO) as GraphNodeType[];

export interface Group {
  type: GraphNodeType;
  indexes: number[];
}

/** Nodes grouped by type in TYPE_ORDER, each group sorted by label. */
export function groupNodes(graph: Graph, indexes: readonly number[]): Group[] {
  const byType = new Map<GraphNodeType, number[]>();
  for (const i of indexes) {
    const node = graph.nodes[i];
    if (!node) continue;
    const list = byType.get(node.type) ?? [];
    list.push(i);
    byType.set(node.type, list);
  }
  return TYPE_ORDER.filter((t) => byType.has(t)).map((type) => ({
    type,
    indexes: (byType.get(type) ?? []).sort((a, b) => (graph.nodes[a]?.label ?? '').localeCompare(graph.nodes[b]?.label ?? '')),
  }));
}

/**
 * The page links the panel lists for a node: topics and series are left out
 * (they show as chips: a series' page is just /writing, which the Writing
 * section link already gives), and each URL appears once, never repeating
 * the selected node's own page.
 */
export function panelPageGroups(graph: Graph, groups: readonly Group[], ownUrl?: string): Group[] {
  const seen = new Set<string>(ownUrl ? [ownUrl] : []);
  return groups
    .filter((g) => g.type !== 'topic' && g.type !== 'series')
    .map((g) => ({
      type: g.type,
      indexes: g.indexes.filter((i) => {
        const url = graph.nodes[i]?.url;
        if (!url) return true;
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      }),
    }))
    .filter((g) => g.indexes.length > 0);
}

/** Search by label (and slug): prefix matches first, then by connections. */
export function searchNodes(
  graph: Graph,
  neighbours: readonly (readonly number[])[],
  query: string,
  hidden: ReadonlySet<GraphNodeType> = new Set(),
  limit = 8,
): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: { i: number; rank: number }[] = [];
  graph.nodes.forEach((n, i) => {
    if (hidden.has(n.type)) return;
    const label = n.label.toLowerCase();
    const slug = n.id.slice(n.id.indexOf(':') + 1);
    const at = label.indexOf(q);
    if (at < 0 && !slug.includes(q)) return;
    hits.push({ i, rank: (at === 0 ? 0 : at > 0 ? 1 : 2) * 1000 - (neighbours[i]?.length ?? 0) });
  });
  return hits
    .sort((a, b) => a.rank - b.rank || (graph.nodes[a.i]?.label ?? '').localeCompare(graph.nodes[b.i]?.label ?? ''))
    .slice(0, limit)
    .map((h) => h.i);
}

/** The node index for an id, or -1. */
export function indexOfId(graph: Graph, id: string): number {
  return graph.nodes.findIndex((n) => n.id === id);
}

/** Node radius: topics grow with how many pages share them. */
export function nodeRadius(node: GraphNode, degree: number): number {
  const base = TYPE_INFO[node.type].radius;
  return node.type === 'topic' ? base + Math.min(4, Math.sqrt(degree)) : base;
}

/* -------------------------------------------------------------------------- */
/* Colours: the canvas needs real colours, not the theme's var(--c-*) refs     */
/* -------------------------------------------------------------------------- */

type Palette = Record<ColorKey, string> & { fontFamily: string };

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Resolve the live palette from the CSS variables the theme sets on :root. */
function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const out = { fontFamily: style.getPropertyValue('--font-sans').trim() || darkTheme.font.sans } as Palette;
  for (const key of Object.keys(darkTheme.color) as ColorKey[]) {
    out[key] = style.getPropertyValue(`--c-${kebab(key)}`).trim() || darkTheme.color[key];
  }
  return out;
}

/** The palette, re-read whenever the light/dark theme flips. */
function useLivePalette(): Palette | null {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const refresh = (): void => setPalette(readPalette());
    refresh();
    const mo = new MutationObserver(refresh);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    mq?.addEventListener?.('change', refresh);
    return () => {
      mo.disconnect();
      mq?.removeEventListener?.('change', refresh);
    };
  }, []);
  return palette;
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */


const PageHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding-block-end: ${(p) => p.theme.space[6]};
`;

const Lede = styled.p`
  margin: 0;
  max-width: 66ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

const MetaLine = styled.p`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  align-items: center;
  margin-block-end: ${(p) => p.theme.space[4]};
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1 1 260px;
  max-width: 420px;
`;

const SearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: ${(p) => `${p.theme.space[2]} ${p.theme.space[3]}`};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: ${(p) => p.theme.color.surface};
  color: ${(p) => p.theme.color.text};
  font: inherit;
  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;

const Results = styled.ul`
  position: absolute;
  z-index: 5;
  inset-inline: 0;
  top: calc(100% + 4px);
  margin: 0;
  padding: ${(p) => p.theme.space[1]};
  list-style: none;
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: ${(p) => p.theme.color.bgElevated};
  box-shadow: ${(p) => p.theme.shadow.md};
`;

const ResultButton = styled.button`
  /* >=44px touch target on phones and tablets (WCAG 2.5.5; e2e 04-responsive). */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-height: 44px;
  }
  display: flex;
  width: 100%;
  gap: ${(p) => p.theme.space[2]};
  align-items: baseline;
  padding: ${(p) => `${p.theme.space[2]} ${p.theme.space[3]}`};
  border: 0;
  border-radius: ${(p) => p.theme.radius.sm};
  background: transparent;
  color: ${(p) => p.theme.color.text};
  font: inherit;
  text-align: start;
  cursor: pointer;
  &:hover,
  &:focus-visible {
    background: ${(p) => p.theme.color.surfaceHover};
    outline: none;
  }
`;

const Kind = styled.span`
  flex: none;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
`;

const Toggle = styled.button`
  /* >=44px touch target on phones and tablets (WCAG 2.5.5; e2e 04-responsive). */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-height: 44px;
  }
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  padding: ${(p) => `${p.theme.space[1]} ${p.theme.space[3]}`};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.full};
  background: ${(p) => p.theme.color.surface};
  color: ${(p) => p.theme.color.text};
  font: inherit;
  font-size: ${(p) => p.theme.font.sizes.sm};
  cursor: pointer;
  &[aria-pressed='false'] {
    color: ${(p) => p.theme.color.textSubtle};
    background: transparent;
    text-decoration: line-through;
  }
  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;

const Swatch = styled.span<{ $color: ColorKey }>`
  width: 10px;
  height: 10px;
  border-radius: ${(p) => p.theme.radius.full};
  background: ${(p) => p.theme.color[p.$color]};
`;

const Stage = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[4]};
  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    grid-template-columns: minmax(0, 1fr) 340px;
  }
`;

const CanvasWrap = styled.div<{ $compact: boolean }>`
  position: relative;
  min-height: ${(p) => (p.$compact ? '360px' : '420px')};
  height: ${(p) => (p.$compact ? 'min(60vh, 520px)' : 'min(70vh, 640px)')};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
  background: ${(p) => p.theme.color.bgSunken};
  overflow: hidden;
`;

/* The home preview's loading state: a still box the size of the compact canvas
 * (no spinner: it sits near the top of the home page, so it must not animate
 * under reduced motion, and reserving the height keeps the page from jumping
 * when the graph arrives). */
const LoadingBox = styled.p`
  display: grid;
  place-items: center;
  margin: 0;
  min-height: 360px;
  height: min(60vh, 520px);
  border: 1px dashed ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
  background: ${(p) => p.theme.color.bgSunken};
  color: ${(p) => p.theme.color.textSubtle};
  font-size: ${(p) => p.theme.font.sizes.sm};
`;

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  touch-action: pan-y;
  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: -2px;
  }
`;

const CanvasNote = styled.p`
  position: absolute;
  inset-inline: ${(p) => p.theme.space[3]};
  bottom: ${(p) => p.theme.space[3]};
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
  pointer-events: none;
`;

const Controls = styled.div`
  position: absolute;
  top: ${(p) => p.theme.space[3]};
  right: ${(p) => p.theme.space[3]};
  display: flex;
  gap: ${(p) => p.theme.space[2]};
`;

const Tooltip = styled.div`
  position: absolute;
  z-index: 4;
  max-width: 260px;
  padding: ${(p) => `${p.theme.space[2]} ${p.theme.space[3]}`};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: ${(p) => p.theme.color.bgElevated};
  box-shadow: ${(p) => p.theme.shadow.md};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.text};
  pointer-events: none;
  transform: translate(12px, 12px);
`;

const Panel = styled.aside<{ $compact?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => p.theme.space[4]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
  background: ${(p) => p.theme.color.surface};
  align-self: start;
  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    max-height: ${(p) => (p.$compact ? 'min(60vh, 520px)' : 'min(70vh, 640px)')};
    overflow-y: auto;
  }
`;

const PanelText = styled.p`
  margin: 0;
  color: ${(p) => p.theme.color.textMuted};
  line-height: ${(p) => p.theme.font.leading.relaxed};
`;

const GroupTitle = styled.h3`
  margin: ${(p) => p.theme.space[2]} 0 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const LinkList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
`;

const LinkRow = styled.li`
  display: flex;
  gap: ${(p) => p.theme.space[2]};
  align-items: baseline;
  justify-content: space-between;
  & > a {
    color: ${(p) => p.theme.color.accent};
    text-underline-offset: 3px;
    @media (max-width: ${(p) => p.theme.breakpoint.md}) {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
`;

const ChipButton = styled.button`
  /* >=44px touch target on phones and tablets (WCAG 2.5.5; e2e 04-responsive). */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-height: 44px;
  }
  padding: ${(p) => `2px ${p.theme.space[2]}`};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.full};
  background: ${(p) => p.theme.color.bgSunken};
  color: ${(p) => p.theme.color.textMuted};
  font: inherit;
  font-size: ${(p) => p.theme.font.sizes.sm};
  cursor: pointer;
  &:hover,
  &:focus-visible {
    color: ${(p) => p.theme.color.text};
    border-color: ${(p) => p.theme.color.accentBorder};
  }
`;

const ShowButton = styled.button`
  /* >=44px touch target on phones and tablets (WCAG 2.5.5; e2e 04-responsive). */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-height: 44px;
  }
  flex: none;
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-width: 44px;
  }
  padding: 0 ${(p) => p.theme.space[1]};
  border: 0;
  background: transparent;
  color: ${(p) => p.theme.color.textSubtle};
  font: inherit;
  font-size: ${(p) => p.theme.font.sizes.xs};
  cursor: pointer;
  &:hover,
  &:focus-visible {
    color: ${(p) => p.theme.color.text};
  }
`;

const ListSection = styled.section`
  margin-block-start: ${(p) => p.theme.space[8]};
`;

const Entries = styled.ul`
  margin: ${(p) => p.theme.space[3]} 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: ${(p) => p.theme.space[3]};
  grid-template-columns: minmax(0, 1fr);
  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Entry = styled.li`
  padding: ${(p) => p.theme.space[3]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  & > a {
    font-weight: 600;
    color: ${(p) => p.theme.color.accent};
    @media (max-width: ${(p) => p.theme.breakpoint.md}) {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }
  }
`;

const EntryMeta = styled.p`
  margin: ${(p) => p.theme.space[1]} 0 0;
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
  & a {
    color: ${(p) => p.theme.color.textMuted};
  }
`;

/* Cast per the ui.test.tsx polymorphic-`as` pattern — see Home.tsx. */
const ROUTER_LINK = Link as unknown as 'a';

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

function NodeLink({ node }: { node: GraphNode }): ReactNode {
  return node.url ? <Link to={node.url}>{node.label}</Link> : <span>{node.label}</span>;
}

export type PanelLevel = 2 | 3;

interface PanelProps {
  graph: Graph;
  neighbours: number[][];
  selected: number;
  onSelect: (i: number) => void;
  /** Heading level of the panel's title; its group titles sit one level below. */
  level?: PanelLevel;
  compact?: boolean;
}

/** The selected node's own page and every connected page, as real links. */
export function SelectionPanel({ graph, neighbours, selected, onSelect, level = 2, compact = false }: PanelProps): ReactNode {
  const node = graph.nodes[selected];
  const groupTag = level === 3 ? 'h4' : 'h3';
  if (!node) {
    const sections = graph.nodes.map((n, i) => (n.type === 'section' ? i : -1)).filter((i) => i >= 0);
    const topTopics = graph.nodes
      .map((n, i) => ({ n, i, d: neighbours[i]?.length ?? 0 }))
      .filter((x) => x.n.type === 'topic')
      .sort((a, b) => b.d - a.d)
      .slice(0, 10);
    return (
      <Panel aria-label="Links from the graph" data-testid="graph-panel" $compact={compact}>
        <Heading level={level} size="md">
          Explore
        </Heading>
        <PanelText>
          Click a node, or search, to see its page and every page connected to it. Double-click a node to open its
          page.
        </PanelText>
        <GroupTitle as={groupTag}>Sections</GroupTitle>
        <LinkList>
          {sections.map((i) => {
            const n = graph.nodes[i];
            return n ? (
              <LinkRow key={n.id}>
                <NodeLink node={n} />
                <ShowButton type="button" onClick={() => onSelect(i)} aria-label={`Show ${n.label} in the graph`}>
                  show
                </ShowButton>
              </LinkRow>
            ) : null;
          })}
        </LinkList>
        <GroupTitle as={groupTag}>Most connected topics</GroupTitle>
        <Chips>
          {topTopics.map(({ n, i, d }) => (
            <ChipButton key={n.id} type="button" onClick={() => onSelect(i)} aria-label={`${n.label}: ${d} pages`}>
              {n.label}
            </ChipButton>
          ))}
        </Chips>
      </Panel>
    );
  }
  const info = TYPE_INFO[node.type];
  const linked = neighbours[selected] ?? [];
  const groups = groupNodes(graph, linked);
  const pageGroups = panelPageGroups(graph, groups, node.url);
  const topics = groups.find((g) => g.type === 'topic')?.indexes ?? [];
  const series = groups.find((g) => g.type === 'series')?.indexes ?? [];
  const pageCount = pageGroups.reduce((s, g) => s + g.indexes.length, 0);
  const chips = (indexes: number[]): ReactNode => (
    <Chips>
      {indexes.map((i) => {
        const n = graph.nodes[i];
        return n ? (
          <ChipButton key={n.id} type="button" onClick={() => onSelect(i)}>
            {n.label}
          </ChipButton>
        ) : null;
      })}
    </Chips>
  );
  return (
    <Panel aria-label={`Links for ${node.label}`} data-testid="graph-panel" aria-live="polite" $compact={compact}>
      <Kind>{info.label}</Kind>
      <Heading level={level} size="md" data-testid="graph-selected-title">
        {node.label}
      </Heading>
      {node.summary && <PanelText>{node.summary}</PanelText>}
      {node.url && (
        <Button as={ROUTER_LINK} to={node.url} size="sm" iconRight="arrow-right" data-testid="graph-open-link">
          {node.type === 'section' ? `Go to ${node.label}` : node.type === 'series' ? 'Go to Writing' : `Open this ${info.label.toLowerCase()}`}
        </Button>
      )}
      {pageCount > 0 && (
        <>
          <GroupTitle as={groupTag}>
            {node.type === 'topic' ? `Pages about ${node.label}` : node.type === 'series' ? `Posts in ${node.label}` : 'Connected pages'}{' '}
            ({pageCount})
          </GroupTitle>
          {pageGroups.map((g) => (
            <div key={g.type}>
              <Kind>{TYPE_INFO[g.type].group}</Kind>
              <LinkList data-testid={`graph-links-${g.type}`}>
                {g.indexes.map((i) => {
                  const n = graph.nodes[i];
                  return n ? (
                    <LinkRow key={n.id}>
                      <NodeLink node={n} />
                      <ShowButton type="button" onClick={() => onSelect(i)} aria-label={`Show ${n.label} in the graph`}>
                        show
                      </ShowButton>
                    </LinkRow>
                  ) : null;
                })}
              </LinkList>
            </div>
          ))}
        </>
      )}
      {series.length > 0 && (
        <>
          <GroupTitle as={groupTag}>Series</GroupTitle>
          {chips(series)}
        </>
      )}
      {topics.length > 0 && (
        <>
          <GroupTitle as={groupTag}>Topics ({topics.length})</GroupTitle>
          {chips(topics)}
        </>
      )}
      <ShowButton type="button" onClick={() => onSelect(-1)} data-testid="graph-clear">
        Clear selection
      </ShowButton>
    </Panel>
  );
}

/** Every page and what it connects to: the graph as a document (prerendered). */
export function GraphList({ graph, neighbours }: { graph: Graph; neighbours: number[][] }): ReactNode {
  const pages = graph.nodes.map((n, i) => (n.type !== 'topic' && n.type !== 'section' && n.type !== 'series' ? i : -1));
  const groups = groupNodes(
    graph,
    pages.filter((i) => i >= 0),
  );
  return (
    <ListSection aria-labelledby="graph-list-title" data-testid="graph-list">
      <Heading level={2} id="graph-list-title">
        Every page and its connections
      </Heading>
      {groups.map((g) => (
        <div key={g.type}>
          <GroupTitle as="h3">{TYPE_INFO[g.type].group}</GroupTitle>
          <Entries>
            {g.indexes.map((i) => {
              const n = graph.nodes[i];
              if (!n) return null;
              const linked = groupNodes(graph, neighbours[i] ?? []);
              const topics = linked.find((x) => x.type === 'topic')?.indexes ?? [];
              const pagesLinked = linked
                .filter((x) => x.type !== 'topic' && x.type !== 'section' && x.type !== 'series')
                .flatMap((x) => x.indexes);
              const series = linked.find((x) => x.type === 'series')?.indexes ?? [];
              return (
                <Entry key={n.id}>
                  <NodeLink node={n} />
                  {pagesLinked.length > 0 && (
                    <EntryMeta>
                      Connects to:{' '}
                      {pagesLinked.map((j, k) => {
                        const m = graph.nodes[j];
                        return m ? (
                          <span key={m.id}>
                            {k > 0 && ', '}
                            <NodeLink node={m} />
                          </span>
                        ) : null;
                      })}
                    </EntryMeta>
                  )}
                  {series.length > 0 && (
                    <EntryMeta>Series: {series.map((j) => graph.nodes[j]?.label).join(', ')}</EntryMeta>
                  )}
                  {topics.length > 0 && (
                    <EntryMeta>Topics: {topics.map((j) => graph.nodes[j]?.label).join(', ')}</EntryMeta>
                  )}
                </Entry>
              );
            })}
          </Entries>
        </div>
      ))}
    </ListSection>
  );
}

/* -------------------------------------------------------------------------- */
/* Explorer                                                                    */
/* -------------------------------------------------------------------------- */

interface ExplorerProps {
  graph: Graph;
  /** The full "every page and its connections" list (on /graph only). */
  showList?: boolean;
  level?: PanelLevel;
  /** Smaller canvas and panel (the home page). */
  compact?: boolean;
}

function Explorer({ graph, showList = true, level = 2, compact = false }: ExplorerProps): ReactNode {
  const navigate = useNavigate();
  const neighbours = useMemo(() => adjacency(graph), [graph]);
  const [selected, setSelected] = useState(-1);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [query, setQuery] = useState('');
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<GraphNodeType>>(new Set());
  const [rotating, setRotating] = useState(true);
  const [sceneError, setSceneError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GraphScene | null>(null);
  const palette = useLivePalette();

  const presentTypes = useMemo(() => TYPE_ORDER.filter((t) => graph.nodes.some((n) => n.type === t)), [graph]);
  const counts = useMemo(() => {
    const c = new Map<GraphNodeType, number>();
    for (const n of graph.nodes) c.set(n.type, (c.get(n.type) ?? 0) + 1);
    return c;
  }, [graph]);
  const matches = useMemo(() => searchNodes(graph, neighbours, query, hiddenTypes), [graph, neighbours, query, hiddenTypes]);

  const select = useCallback(
    (i: number) => {
      setSelected(i);
      setHover(null);
      if (i >= 0) sceneRef.current?.flyTo(i);
    },
    [],
  );

  const sceneNodes = useCallback(
    (pal: Palette): SceneNode[] =>
      graph.nodes.map((n, i) => ({
        position: [n.x, n.y, n.z],
        label: n.label,
        radius: nodeRadius(n, neighbours[i]?.length ?? 0),
        color: pal[TYPE_INFO[n.type].color],
        alwaysLabel: n.type === 'section',
      })),
    [graph, neighbours],
  );
  const scenePalette = (pal: Palette): ScenePalette => ({
    edge: pal.borderStrong,
    edgeStrong: pal.accent,
    label: pal.text,
    halo: pal.bgSunken,
  });

  /* Create the scene once the palette is known (client only). */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !palette || sceneRef.current) return;
    let cancelled = false;
    import('app/lib/graph3d')
      .then(({ GraphScene }) => {
        if (cancelled || !canvasRef.current) return;
        try {
          sceneRef.current = new GraphScene(canvasRef.current, {
            nodes: sceneNodes(palette),
            edges: graph.edges.map(([a, b]) => [a, b] as const),
            neighbours,
            palette: scenePalette(palette),
            font: `500 12px ${palette.fontFamily}`,
            reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
            onHover: (i, x, y) => setHover(i >= 0 ? { i, x, y } : null),
            onSelect: (i) => select(i),
            onOpen: (i) => {
              const url = graph.nodes[i]?.url;
              if (url) navigate(url);
            },
          });
          setRotating(sceneRef.current.isAutoRotating());
        } catch {
          setSceneError(true);
        }
      })
      .catch(() => setSceneError(true));
    return () => {
      cancelled = true;
    };
    /* The scene is created once per graph; palette changes go through update(). */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, palette !== null]);

  useEffect(
    () => () => {
      sceneRef.current?.destroy();
      sceneRef.current = null;
    },
    [],
  );

  /* Theme changes recolour the nodes in place. */
  useEffect(() => {
    if (palette) sceneRef.current?.update({ nodes: sceneNodes(palette), palette: scenePalette(palette), font: `500 12px ${palette.fontFamily}` });
  }, [palette, sceneNodes]);

  /* Selection, search and type filters → what the scene emphasises. */
  useEffect(() => {
    const hidden = new Set<number>();
    graph.nodes.forEach((n, i) => {
      if (hiddenTypes.has(n.type) && i !== selected) hidden.add(i);
    });
    const dimmed = new Set<number>();
    if (query.trim()) {
      const keep = new Set(searchNodes(graph, neighbours, query, hiddenTypes, graph.nodes.length));
      graph.nodes.forEach((_, i) => {
        if (!keep.has(i)) dimmed.add(i);
      });
    }
    sceneRef.current?.setFocus({ selected, dimmed, hidden });
  }, [graph, neighbours, selected, query, hiddenTypes, palette]);

  const toggleType = (t: GraphNodeType): void => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const hovered = hover ? graph.nodes[hover.i] : undefined;
  const pageNodes = graph.nodes.filter((n) => n.type !== 'topic' && n.type !== 'section' && n.type !== 'series').length;
  const topicNodes = counts.get('topic') ?? 0;

  return (
    <>
      <Toolbar>
        <SearchBox>
          <label htmlFor="graph-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Search the graph
          </label>
          <SearchInput
            id="graph-search"
            type="search"
            placeholder="Search pages and topics…"
            autoComplete="off"
            value={query}
            data-testid="graph-search"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0] !== undefined) {
                select(matches[0]);
                setQuery('');
              } else if (e.key === 'Escape') {
                setQuery('');
              }
            }}
          />
          {query.trim() !== '' && (
            <Results data-testid="graph-results">
              {matches.length === 0 ? (
                <li>
                  <PanelText style={{ padding: 8 }}>Nothing matches “{query.trim()}”.</PanelText>
                </li>
              ) : (
                matches.map((i) => {
                  const n = graph.nodes[i];
                  return n ? (
                    <li key={n.id}>
                      <ResultButton
                        type="button"
                        onClick={() => {
                          select(i);
                          setQuery('');
                        }}
                      >
                        <span>{n.label}</span>
                        <Kind>{TYPE_INFO[n.type].label}</Kind>
                      </ResultButton>
                    </li>
                  ) : null;
                })
              )}
            </Results>
          )}
        </SearchBox>
        <Legend role="group" aria-label="Show or hide node types">
          {presentTypes.map((t) => (
            <Toggle key={t} type="button" aria-pressed={!hiddenTypes.has(t)} onClick={() => toggleType(t)} data-testid={`graph-toggle-${t}`}>
              <Swatch $color={TYPE_INFO[t].color} aria-hidden="true" />
              {TYPE_INFO[t].group} ({counts.get(t) ?? 0})
            </Toggle>
          ))}
        </Legend>
      </Toolbar>
      <Stage>
        <CanvasWrap $compact={compact}>
          <Canvas
            ref={canvasRef}
            tabIndex={0}
            role="img"
            aria-label={`3D knowledge graph of ${pageNodes} pages and ${topicNodes} shared topics. Drag to turn it, arrow keys to rotate, plus and minus to zoom. Every link is also in the panel${showList ? ' and the list below' : ''}.`}
            data-testid="graph-canvas"
          />
          <Controls>
            <Button
              size="sm"
              variant="secondary"
              aria-pressed={rotating}
              onClick={() => {
                const next = !rotating;
                sceneRef.current?.setAutoRotate(next);
                setRotating(sceneRef.current?.isAutoRotating() ?? false);
              }}
            >
              {rotating ? 'Pause' : 'Rotate'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => sceneRef.current?.resetView()}>
              Reset view
            </Button>
          </Controls>
          {hovered && hover && (
            <Tooltip style={{ left: hover.x, top: hover.y }} data-testid="graph-tooltip">
              <strong>{hovered.label}</strong>
              <br />
              <Kind>
                {TYPE_INFO[hovered.type].label} · {neighbours[hover.i]?.length ?? 0} connections · click for links
              </Kind>
            </Tooltip>
          )}
          <CanvasNote>
            {sceneError
              ? `The 3D view could not start in this browser; every page and link is in the panel${showList ? ' and the list below' : ''}.`
              : 'Drag to turn · click a node for its links · focus the graph, then scroll (or Ctrl + scroll) to zoom'}
          </CanvasNote>
        </CanvasWrap>
        <SelectionPanel graph={graph} neighbours={neighbours} selected={selected} onSelect={select} level={level} compact={compact} />
      </Stage>
      {showList && <GraphList graph={graph} neighbours={neighbours} />}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

/** The graph: primed (prerender, tests) or fetched once; `failed` if it could not load. */
export function useKnowledgeGraph(): { graph: Graph | undefined; failed: boolean } {
  const [graph, setGraph] = useState<Graph | undefined>(() => cachedKnowledgeGraph());
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (graph) return;
    let live = true;
    loadKnowledgeGraph(contentHash).then(
      (g) => {
        if (live) setGraph(g);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [graph]);
  return { graph, failed };
}

/**
 * The explorer for the home page: the same graph, search and links panel, a
 * smaller canvas, no full list (that stays on /graph). Sits inside a section
 * whose title is an h2, so the panel's headings start at h3.
 */
export function KnowledgeGraphPreview(): ReactNode {
  const { graph, failed } = useKnowledgeGraph();
  if (graph) {
    return (
      <div data-testid="home-graph">
        <Explorer graph={graph} showList={false} level={3} compact />
      </div>
    );
  }
  if (failed) {
    return (
      <PanelText data-testid="home-graph">
        The graph did not load here; <Link to="/graph">open the knowledge graph</Link> to try again.
      </PanelText>
    );
  }
  return (
    <div data-testid="home-graph">
      <LoadingBox role="status">Loading the graph…</LoadingBox>
    </div>
  );
}

export function KnowledgeGraph(): ReactNode {
  const { graph, failed } = useKnowledgeGraph();

  const pages = graph?.nodes.filter((n) => n.type !== 'topic' && n.type !== 'section' && n.type !== 'series').length ?? 0;
  const topics = graph?.nodes.filter((n) => n.type === 'topic').length ?? 0;

  return (
    <>
      <PageHeader>
        <Heading level={1} data-testid="graph-title">
          Knowledge graph
        </Heading>
        <Lede>
          Everything on this site in one picture: projects, writing, AI engineering and recipes, linked by the topics
          and tools they share and by the pages that reference each other. Pick a node to get links to every page
          connected to it. The graph is rebuilt from the site&apos;s content on every update.
        </Lede>
        {graph && (
          <MetaLine data-testid="graph-count">
            {pages} pages · {topics} shared topics · {graph.edges.length} connections
          </MetaLine>
        )}
      </PageHeader>
      {graph ? (
        <Explorer graph={graph} />
      ) : failed ? (
        <EmptyState
          icon="search"
          title="The graph did not load"
          description="Reload the page to try again; every page is also listed under Projects, Writing and AI Engineering."
        />
      ) : (
        <Spinner label="Loading the graph" />
      )}
    </>
  );
}

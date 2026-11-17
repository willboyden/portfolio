/**
 * AI Engineering — the capability hub (/ai-engineering) plus the shared
 * detail template the three subsection routes render
 * (/ai-engineering/local-inference, /video-generation, /smart-routing —
 * each one is a thin shim in ./ai-engineering/).
 *
 * DATA POSTURE: the AI-capability API (`getAiCapability`,
 * `aiCapabilitiesBySlug`, `AiCapability`) ships with the content pipeline in
 * 'app/content' (integrator-owned). Until that lands this file codes against
 * the PLANNED interface with a guarded module access: the namespace is
 * widened with a structural cast and every read is narrowed at runtime, so a
 * missing export degrades to the designed EmptyState (hub) / NotFound
 * (detail) instead of crashing the prerender. Anti-fabrication: proof,
 * limits, steps, and statuses render exactly as content states them — the
 * only transformation is splitting a proof bullet's trailing repo path off
 * the claim so the path can render in mono (nothing is dropped or reworded).
 *
 * PAGE SHAPES (content plan):
 *  - hub: intro + one card per capability (title, oneLiner, status Tag,
 *    stack chips, link) + the subsection nav between the sections.
 *  - detail: crumb → hero (status/one-liner/stack) → How it works (ordered
 *    list) → Proof (grid; each bullet's repo path in mono) → Limits (honest,
 *    muted) → Related writing (resolved via getPost) → contact CTA.
 *
 * A11Y: one h1 per page; sections are labelled landmarks with h2s in order
 * (related-post titles are h3, never a skipped level); the subsection nav
 * marks the current page with aria-current="page" so active state never
 * depends on colour alone; every standalone link is ≥44px at ≤md
 * (WCAG 2.5.8); headings carry overflow-wrap anywhere so long slugs can't
 * push the page sideways at 320px.
 *
 * ROUTER QUIRK: links take css() classes on plain <Link> — styled(Link)
 * drops `to` (vendored styled() prop allow-list; Nav.tsx precedent).
 */

import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { Link, useLocation } from '@portfolio/router';
import * as contentModule from 'app/content';
import { getPost, type Post } from 'app/content';
import { formatIsoDate, formatReadingTime } from 'app/lib/format';
import { rebaseHtml } from 'app/lib/seo';
import type { Tokens } from 'app/theme/tokens';
import { actionLink, dataText, markerUnderline, titleLink } from 'app/theme/mixins';
import { NotFound } from './NotFound';
import {
  Button,
  Card,
  Container,
  EmptyState,
  Heading,
  Prose,
  Section,
  Stack,
  Tag,
  type TagTone,
} from 'app/components/ui';

/* Button's component-target path keeps `to` intact (ui.test.tsx §polymorphic
 * `as`); the cast mirrors Home.tsx / About.tsx. */
const ROUTER_LINK = Link as unknown as 'a';

/* -------------------------------------------------------------------------- */
/* Planned content interface + guarded access                                  */
/* -------------------------------------------------------------------------- */

/**
 * The pinned capability shape (content plan). Declared LOCALLY so tsc stays
 * green while 'app/content' grows the real export — it is structurally
 * identical, so the pipeline's zod-validated records satisfy it unchanged.
 */
export interface AiCapability {
  slug: string;
  title: string;
  /** Short section name, e.g. "Local inference" — nav + meta line. */
  capability: string;
  oneLiner: string;
  stack: string[];
  howItWorks: string[];
  /** Each bullet states a claim; `url` (when present) is a public repository
   * link. Plain strings are the legacy em-dash form. */
  proof: (string | { claim: string; url?: string })[];
  limits: string[];
  relatedPosts?: string[];
  status: 'offered' | 'in-progress' | 'shipped';
  /** R10: head-to-head comparison tables (expandable). */
  comparisons?: AiComparisonEntry[];
  /** Long-form body (markdown below the frontmatter), rendered at build time. */
  html?: string;
}

/** R10: one expandable comparison — first row is the header row. */
export interface AiComparisonEntry {
  title: string;
  rows: string[][];
}

/**
 * Guarded read of the AI-capability API. The members are typed `unknown` and
 * narrowed at call time: the cast `typeof contentModule & AiContentApi`
 * compiles today (members absent) and stays correct once the real exports
 * land — no named import of a not-yet-existing member, no `any`.
 */
interface AiContentApi {
  getAiCapability: unknown;
  aiCapabilitiesBySlug: unknown;
  recipesByDate: unknown;
}
const ai = contentModule as typeof contentModule & AiContentApi;

/** AI Engineering › Local recipes — the subsection's index route. */
export const LOCAL_RECIPES_PATH = '/ai-engineering/local-recipes';

/** The few recipe fields the hub block shows, narrowed like isCapability. */
export interface RecipeTeaser {
  slug: string;
  title: string;
  summary: string;
}

function isRecipeTeaser(value: unknown): value is RecipeTeaser {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.slug === 'string' && typeof r.title === 'string' && typeof r.summary === 'string';
}

/** The recipes API, or undefined when the content module lacks it. The read
 * itself is guarded: a strict module mock (vitest) throws on an export it does
 * not define, and the hub must still render its capabilities then. */
function recipesApi(): unknown {
  try {
    return ai.recipesByDate;
  } catch {
    return undefined;
  }
}

/** Recipes for the hub block, newest first; an absent API yields []. */
export function aiRecipeList(raw: unknown = recipesApi()): RecipeTeaser[] {
  if (typeof raw !== 'function') return [];
  const out = (raw as () => unknown)();
  return Array.isArray(out) ? out.filter(isRecipeTeaser) : [];
}

/** Light structural guard: a half-wired pipeline degrades to empty states
 * instead of rendering garbage. */
export function isCapability(value: unknown): value is AiCapability {
  if (value === null || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.slug === 'string' &&
    typeof c.title === 'string' &&
    typeof c.oneLiner === 'string' &&
    Array.isArray(c.howItWorks)
  );
}

/**
 * Every capability, in content order. `aiCapabilitiesBySlug` may ship as a
 * function returning an array or as a slug-keyed record — both are accepted;
 * `undefined` (API absent) yields the empty list.
 */
export function aiCapabilityList(raw: unknown = ai.aiCapabilitiesBySlug): AiCapability[] {
  if (typeof raw === 'function') {
    const out = (raw as () => unknown)();
    return Array.isArray(out) ? out.filter(isCapability) : [];
  }
  if (raw !== null && typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).filter(isCapability);
  }
  return [];
}

/**
 * One capability by slug: prefers `getAiCapability(slug)` and falls back to a
 * scan of the list, so the hub and the detail pages can never disagree.
 */
export function aiCapabilityBySlug(slug: string, fetcher: unknown = ai.getAiCapability): AiCapability | undefined {
  if (typeof fetcher === 'function') {
    const out = (fetcher as (s: string) => unknown)(slug);
    if (isCapability(out)) return out;
  }
  return aiCapabilityList().find((c) => c.slug === slug);
}

/** Contrast-checked Tag tone per status (same recipe as Projects.statusTone). */
export function capabilityStatusTone(status: AiCapability['status']): TagTone {
  return status === 'shipped' ? 'accent' : status === 'in-progress' ? 'default' : 'outline';
}

/**
 * Split a proof bullet into its claim and the repo path it traces to.
 * Content separates the two with an em dash ("Claim — src/x.py"); the LAST
 * dash wins so a claim that legitimately contains dashes survives. No
 * separator → the whole string is the claim. Nothing is dropped: the path is
 * the same characters, only rendered in mono.
 */
export function splitProof(entry: string): { claim: string; repoPath: string | undefined } {
  const dash = ' — ';
  const idx = entry.lastIndexOf(dash);
  if (idx === -1) return { claim: entry, repoPath: undefined };
  return {
    claim: entry.slice(0, idx),
    repoPath: entry.slice(idx + dash.length),
  };
}

/* -------------------------------------------------------------------------- */
/* Links (css() classes on plain <Link> — styled(Link) drops `to`)             */
/* -------------------------------------------------------------------------- */

/** Hub card title link — the card's real affordance (also the recipe cards). */
export function cardLinkClass(theme: Tokens): string {
  return css`
    ${titleLink(theme)}
    display: inline-block;
    min-height: 28px;

    @media (max-width: ${theme.breakpoint.md}) {
      min-height: 44px;
    }
  `;
}

/** A "go there" link under a card or a list ("How it works →"). */
export function moreLinkClass(theme: Tokens): string {
  return css`
    ${actionLink(theme)}
  `;
}

/** Detail crumb — standalone block-level nav link, 44px at phone widths. */
export function crumbClass(theme: Tokens): string {
  return css({
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: theme.font.sans,
    fontSize: theme.font.sizes.sm,
    color: theme.color.textMuted,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    minHeight: '28px',
    ['@media (max-width: ' + theme.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover': { background: theme.color.mark, color: theme.color.markInk, textDecoration: 'none' },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
  });
}

/**
 * Subsection nav link (hub + detail), in the same language as the site
 * header: the current section carries a stroke of the highlighter under it.
 * ONE class per state (never a base class plus an "active" class: two classes
 * leave the winner to stylesheet order).
 */
function subnavClass(theme: Tokens, current: boolean): string {
  return css`
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: ${theme.space[1]} 0;
    font-family: ${theme.font.sans};
    font-size: ${theme.font.sizes.sm};
    font-weight: ${theme.font.weights.normal};
    line-height: ${theme.font.leading.none};
    text-decoration: none;
    white-space: nowrap;
    color: ${current ? theme.color.text : theme.color.textMuted};
    box-shadow: inset 0 -3px 0 ${current ? theme.color.mark : 'transparent'};

    &:hover {
      color: ${theme.color.text};
      box-shadow: inset 0 -3px 0 ${current ? theme.color.mark : theme.color.borderStrong};
    }
    &:focus-visible {
      outline: 2px solid ${theme.color.focus};
      outline-offset: 2px;
    }
  `;
}

/** Related-post link (the whole entry is one <Link>), PostDetail pattern. */
function relatedPostCls(theme: Tokens): string {
  return css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.space[1],
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    color: 'inherit',
    minHeight: '28px',
    ['@media (max-width: ' + theme.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover .related-post-title': { background: theme.color.mark, color: theme.color.markInk },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '3px' },
  });
}

/* -------------------------------------------------------------------------- */
/* Shared page furniture                                                       */
/* -------------------------------------------------------------------------- */

const PageHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding-block-end: ${(p) => p.theme.space[6]};
`;

const Lede = styled.p`
  margin: 0;
  max-width: 62ch;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

/* A tab row on a hairline, like the header nav. */
const SubNav = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 0 ${(p) => p.theme.space[5]};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
`;

/** Hub grid: 1 col → 3 cols like the Projects grid. */
const CardGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[7]} ${(p) => p.theme.space[6]};
  margin-bottom: ${(p) => p.theme.space[8]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const CardMeta = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

/* h2 not h3: hub goes h1 → card titles directly (Projects.tsx rationale:
 * jumping to h3 skips a level and the a11y e2e treats that as a violation). */
const CardTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: ${(p) => p.theme.font.leading.snug};
`;

const CardSummary = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

/* On a hub card the stack is one run of text, set like data: twenty chips
 * per card read as noise, a line reads as a parts list. */
const StackLine = styled.p`
  margin: 0;
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  line-height: 1.7;
  color: ${(p) => p.theme.color.textSubtle};
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardFooter = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[3]};
`;

/* Detail head: the same data-sheet shape as a project page (facts in the
 * margin column from `xl`, a compact row above the title below it). */
const Hero = styled.header`
  padding-block-end: ${(p) => p.theme.space[7]};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    display: grid;
    grid-template-columns: ${(p) => p.theme.layout.marginCol} minmax(0, 1fr);
    column-gap: ${(p) => p.theme.space[7]};
    align-items: start;
  }
`;

const HeroMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  min-width: 0;
`;

const DetailMeta = styled.p`
  margin: 0 0 ${(p) => p.theme.space[3]};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    margin: ${(p) => p.theme.space[3]} 0 0;
    padding-top: ${(p) => p.theme.space[3]};
    border-top: 1px solid ${(p) => p.theme.color.borderStrong};
    flex-direction: column;
    align-items: flex-start;

    & > [aria-hidden='true'] {
      display: none;
    }
  }
`;

const DetailLede = styled.p`
  margin: 0;
  max-width: 62ch;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: 1.45;
  color: ${(p) => p.theme.color.text};

  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    font-size: ${(p) => p.theme.font.sizes.lg};
  }
`;

/** How-it-works: a real ordered list — the sequence is the content. */
const StepsList = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  max-width: 68ch;
`;

const StepItem = styled.li`
  display: grid;
  grid-template-columns: ${(p) => p.theme.space[6]} minmax(0, 1fr);
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.lg};
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.normal};
  counter-increment: step;
  word-break: break-word;

  &::before {
    content: counter(step) '.';
    ${(p) => dataText(p.theme)}
    font-size: ${(p) => p.theme.font.sizes.sm};
    color: ${(p) => p.theme.color.textSubtle};
    /* Share the first line's baseline with the step text. */
    line-height: calc(${(p) => p.theme.font.sizes.lg} * ${(p) => p.theme.font.leading.normal});
  }
`;

/** Proof: one ruled entry per claim, two columns from md. */
const ProofGrid = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]} ${(p) => p.theme.space[6]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const ProofItem = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  padding-top: ${(p) => p.theme.space[3]};
  border-top: 1px solid ${(p) => p.theme.color.borderStrong};
  word-break: break-word;
`;

const ProofClaim = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.text};
`;

const ProofPath = styled.code`
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
  overflow-wrap: anywhere;
`;

/** A proof's public repository link (GitHub), set like data. */
const ProofLink = styled.a`
  align-self: flex-start;
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.accent};
  ${(p) => markerUnderline(p.theme)}
  overflow-wrap: anywhere;

  &:hover {
    background: ${(p) => p.theme.color.mark};
    color: ${(p) => p.theme.color.markInk};
    text-decoration-color: transparent;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;

const ProofNote = styled.p`
  margin: ${(p) => p.theme.space[5]} 0 0;
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};
`;

const LimitsList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  max-width: 68ch;
`;

/* A limit is marked with a plain grey rule: stated, not decorated. */
const LimitItem = styled.li`
  position: relative;
  padding-left: ${(p) => p.theme.space[5]};
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.lg};
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.normal};
  word-break: break-word;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.8em;
    width: ${(p) => p.theme.space[3]};
    height: 2px;
    background: ${(p) => p.theme.color.borderStrong};
  }
`;

/* Comparisons: a disclosure per table, the table ruled like the ones in posts. */
const Comparison = styled.details`
  margin: 0;
  border-bottom: 1px solid ${(p) => p.theme.color.border};

  &:first-of-type {
    border-top: 1px solid ${(p) => p.theme.color.borderStrong};
  }
`;

const ComparisonSummary = styled.summary`
  display: flex;
  align-items: center;
  min-height: 44px;
  padding-block: ${(p) => p.theme.space[2]};
  cursor: pointer;
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};

  &:hover {
    background: ${(p) => p.theme.color.accentSoft};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;

const ComparisonScroll = styled.div`
  overflow-x: auto;
  margin: ${(p) => p.theme.space[2]} 0 ${(p) => p.theme.space[5]};
`;

const ComparisonTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.snug};
  font-variant-numeric: tabular-nums;
  border-top: 2px solid ${(p) => p.theme.color.rule};
  border-bottom: 2px solid ${(p) => p.theme.color.rule};

  th,
  td {
    padding: ${(p) => p.theme.space[2]} ${(p) => p.theme.space[4]} ${(p) => p.theme.space[2]} 0;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }

  th {
    font-weight: ${(p) => p.theme.font.weights.semibold};
    border-bottom: 1px solid ${(p) => p.theme.color.rule};
    vertical-align: bottom;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
`;

/* Related-writing entry (mirrors ProjectDetail's). */
const RelatedPostCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
  max-width: 46rem;
  padding-top: ${(p) => p.theme.space[3]};
  border-top: 1px solid ${(p) => p.theme.color.borderStrong};

  &:first-of-type {
    padding-top: 0;
    border-top: none;
  }
`;

const RelatedPostTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: ${(p) => p.theme.font.leading.snug};
`;

const RelatedPostMeta = styled.span`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

const CrumbNav = styled.nav`
  margin-bottom: ${(p) => p.theme.space[3]};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    margin-bottom: 0;
  }
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[2]};
  padding-top: ${(p) => p.theme.space[6]};
  border-top: 2px solid ${(p) => p.theme.color.rule};
`;

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                               */
/* -------------------------------------------------------------------------- */

/** The subsections, in hub order, straight from content — a capability page
 * that exists in content can never be missing from the nav (tech-stack and
 * data-analytics were prerendered but unreachable when this was a fixed list). */
export function aiSections(): { slug: string; label: string }[] {
  return aiCapabilityList().map((c) => ({ slug: c.slug, label: c.capability }));
}

export function aiSectionPath(slug: string): string {
  return `/ai-engineering/${slug}`;
}

/** aria-current="page" on the subsection matching the current path. The
 * capabilities come from content; "Local recipes" is a fixed last entry (its
 * index and every recipe page count as current: the recipe is inside it). */
export function SubsectionNav({ currentPath }: { currentPath?: string }): ReactNode {
  const theme = useTheme() as Tokens;
  const location = useLocation();
  const path = currentPath ?? location.pathname;
  const inRecipes = path === LOCAL_RECIPES_PATH || path.startsWith(`${LOCAL_RECIPES_PATH}/`);
  return (
    <SubNav aria-label="AI engineering sections" data-testid="ai-subnav">
      {aiSections().map((section) => {
        const to = aiSectionPath(section.slug);
        const current = path === to;
        return (
          <Link
            key={section.slug}
            to={to}
            className={subnavClass(theme, current)}
            aria-current={current ? 'page' : undefined}
            data-testid={`ai-subnav-${section.slug}`}
          >
            {section.label}
          </Link>
        );
      })}
      <Link
        to={LOCAL_RECIPES_PATH}
        className={subnavClass(theme, inRecipes)}
        aria-current={path === LOCAL_RECIPES_PATH ? 'page' : inRecipes ? 'location' : undefined}
        data-testid="ai-subnav-local-recipes"
      >
        Local recipes
      </Link>
    </SubNav>
  );
}

/** The stack: one line of text on a hub card (`compact`), flat tags in the
 * detail head. Same content either way; same test id. */
function CapabilityMeta({ capability, compact = false }: { capability: AiCapability; compact?: boolean }): ReactNode {
  if (compact) {
    return <StackLine data-testid="ai-stack">{capability.stack.join(' · ')}</StackLine>;
  }
  return (
    <Stack direction="row" wrap gap="2" data-testid="ai-stack">
      {capability.stack.map((tech) => (
        <Tag key={tech} size="sm">
          {tech}
        </Tag>
      ))}
    </Stack>
  );
}

/** Related writing: slugs resolved via getPost; unknown slugs are skipped
 * (never rendered as dead links), an empty result renders nothing. */
function RelatedWriting({ slugs }: { slugs: readonly string[] }): ReactNode {
  const theme = useTheme() as Tokens;
  const posts = slugs.map((slug) => getPost(slug)).filter((p): p is Post => p !== undefined);
  if (posts.length === 0) return null;
  return (
    <Section id="related-writing" title="Related writing" description="The thinking behind this capability.">
      <Stack direction="column" gap="4">
        {posts.map((post) => (
          <RelatedPostCard key={post.slug} data-testid="ai-related-post">
            <Link to={`/writing/${post.slug}`} className={relatedPostCls(theme)} data-testid="ai-related-post-link">
              <RelatedPostTitle className="related-post-title">{post.title}</RelatedPostTitle>
              <RelatedPostMeta>
                <time dateTime={post.date}>{formatIsoDate(post.date)}</time>
                <span aria-hidden="true">·</span>
                {formatReadingTime(post.readingMinutes)}
              </RelatedPostMeta>
            </Link>
          </RelatedPostCard>
        ))}
      </Stack>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Hub page                                                                    */
/* -------------------------------------------------------------------------- */

/** One hub card. Exported for direct testing (work.test.tsx pattern). */
export function AiCapabilityCard({ capability }: { capability: AiCapability }): ReactNode {
  const theme = useTheme() as Tokens;
  const href = aiSectionPath(capability.slug);
  return (
    <Card interactive data-testid="ai-capability-card">
      <CardMeta>
        <Tag size="sm" tone={capabilityStatusTone(capability.status)} data-testid="ai-capability-status">
          {capability.status}
        </Tag>
        <span aria-hidden="true">·</span>
        <span>{capability.capability}</span>
      </CardMeta>
      <CardTitle>
        <Link to={href} className={cardLinkClass(theme)} data-testid={`ai-capability-link-${capability.slug}`}>
          {capability.title}
        </Link>
      </CardTitle>
      <CardSummary>{capability.oneLiner}</CardSummary>
      <CapabilityMeta capability={capability} compact />
      <CardFooter>
        <Link to={href} className={moreLinkClass(theme)} data-testid={`ai-capability-cta-${capability.slug}`}>
          How it works <span aria-hidden="true">→</span>
        </Link>
      </CardFooter>
    </Card>
  );
}

/** Hub block listing the Local recipes subsection (newest first). */
const RecipeTeaserList = styled.ul`
  margin: 0 0 ${(p) => p.theme.space[4]};
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
`;

const RecipeTeaserItem = styled.li`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[1]};
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
`;

const RecipeTeaserSummary = styled.span`
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.md};
  font-weight: ${(p) => p.theme.font.weights.normal};
  letter-spacing: ${(p) => p.theme.font.tracking.normal};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
  max-width: 70ch;
`;

function HubRecipes(): ReactNode {
  const theme = useTheme() as Tokens;
  const recipes = aiRecipeList();
  if (recipes.length === 0) return null;
  return (
    <Section
      id="ai-hub-recipes"
      title="Local recipes"
      description="Exact, measured setups for running one model on my own hardware."
      data-testid="ai-hub-recipes"
    >
      <RecipeTeaserList>
        {recipes.map((recipe) => (
          <RecipeTeaserItem key={recipe.slug}>
            <Link
              to={`${LOCAL_RECIPES_PATH}/${recipe.slug}`}
              className={cardLinkClass(theme)}
              data-testid={`ai-hub-recipe-${recipe.slug}`}
            >
              {recipe.title}
            </Link>
            <RecipeTeaserSummary>{recipe.summary}</RecipeTeaserSummary>
          </RecipeTeaserItem>
        ))}
      </RecipeTeaserList>
      <Link to={LOCAL_RECIPES_PATH} className={moreLinkClass(theme)} data-testid="ai-hub-recipes-all">
        All local recipes <span aria-hidden="true">→</span>
      </Link>
    </Section>
  );
}

export function AiEngineeringHub({ currentPath }: { currentPath?: string }): ReactNode {
  const capabilities = aiCapabilityList();

  return (
    <Container data-testid="ai-hub">
      <PageHeader>
        <Heading level={1} data-testid="ai-hub-title">
          AI engineering
        </Heading>
        <Lede>
          What I build and operate end to end in my own lab: what each piece is, how it works, the proof, and its
          limits. Linked proof points are public repositories.
        </Lede>
        <SubsectionNav currentPath={currentPath} />
      </PageHeader>

      {capabilities.length > 0 ? (
        <CardGrid data-testid="ai-capability-grid">
          {capabilities.map((capability) => (
            <AiCapabilityCard key={capability.slug} capability={capability} />
          ))}
        </CardGrid>
      ) : (
        <EmptyState
          icon="search"
          title="Capabilities page still being written"
          description="The three subsections — local inference, video generation, smart routing — are being documented right now. The writing and project pages already cover parts of this work."
          action={
            <Button as={ROUTER_LINK} to="/projects" variant="secondary" size="sm" data-testid="ai-hub-cta-projects">
              Browse projects
            </Button>
          }
        />
      )}

      <HubRecipes />
    </Container>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail template                                                             */
/* -------------------------------------------------------------------------- */

export function AiCapabilityDetail({ slug }: { slug: string }): ReactNode {
  const theme = useTheme() as Tokens;
  const capability = aiCapabilityBySlug(slug);

  if (!capability) return <NotFound />;

  const buttonLink = css({ textDecoration: 'none' });

  return (
    <Container data-testid="ai-capability-detail">
      <Hero>
        <div>
          <CrumbNav aria-label="Breadcrumb">
            <Link to="/ai-engineering" className={crumbClass(theme)} data-testid="ai-detail-crumb">
              ← All capabilities
            </Link>
          </CrumbNav>
          <DetailMeta>
            <Tag size="sm" tone={capabilityStatusTone(capability.status)} data-testid="ai-capability-status">
              {capability.status}
            </Tag>
            <span aria-hidden="true">·</span>
            <span>{capability.capability}</span>
          </DetailMeta>
        </div>
        <HeroMain>
          <Heading level={1} size="4xl" data-testid="ai-detail-title">
            {capability.title}
          </Heading>
          <DetailLede>{capability.oneLiner}</DetailLede>
          <CapabilityMeta capability={capability} />
        </HeroMain>
      </Hero>

      <Section id="how-it-works" title="How it works">
        {capability.howItWorks.length > 0 ? (
          <StepsList data-testid="ai-how-it-works">
            {capability.howItWorks.map((step) => (
              <StepItem key={step}>
                <span>{step}</span>
              </StepItem>
            ))}
          </StepsList>
        ) : (
          <EmptyState
            icon="clock"
            title="Write-up in progress"
            description="The step-by-step for this capability is being written. Ask me directly for now."
            action={
              <Button as={ROUTER_LINK} to="/contact" variant="secondary" size="sm">
                Contact me
              </Button>
            }
          />
        )}
      </Section>

      {capability.html !== undefined && capability.html !== '' && (
        <Section id="in-depth" title="In depth">
          <Prose data-testid="ai-in-depth">
            {/* Build-time rendered + sanitized markdown (same pipeline as posts). */}
            <div dangerouslySetInnerHTML={{ __html: rebaseHtml(capability.html) }} />
          </Prose>
        </Section>
      )}

      <Section id="proof" title="Proof">
        {capability.proof.length > 0 ? (
          <ProofGrid data-testid="ai-proof-grid">
            {capability.proof.map((entry) => {
              /* Proof arrives as {claim, url?} objects (the build expands
               * `claim = https://…` strings; only public URLs are allowed, never
               * a workstation path); the em-dash split is the fallback for
               * plain-string bullets. */
              const { claim, repoPath } =
                typeof entry === 'string' ? splitProof(entry) : { claim: entry.claim, repoPath: undefined };
              const url = typeof entry === 'string' ? undefined : entry.url;
              return (
                <ProofItem key={claim} data-testid="ai-proof-item">
                  <ProofClaim>{claim}</ProofClaim>
                  {url !== undefined && (
                    <ProofLink href={url} target="_blank" rel="noreferrer noopener" data-testid="ai-proof-link">
                      {url.replace(/^https?:\/\//, '')}
                    </ProofLink>
                  )}
                  {repoPath !== undefined && <ProofPath data-testid="ai-proof-path">{repoPath}</ProofPath>}
                </ProofItem>
              );
            })}
          </ProofGrid>
        ) : (
          <EmptyState
            icon="search"
            title="Proof points still being collected"
            description="Verified results land here as they are validated against real repos. Nothing is claimed that cannot be traced."
          />
        )}
        <ProofNote>
          Linked items are public repositories. The rest runs in my private lab, and I am happy to walk you through it.
        </ProofNote>
      </Section>

      {/* R10: head-to-head comparisons — expandable tables, collapsed by
       * default (same pattern as the Talks page details). First row is the
       * header row. */}
      {capability.comparisons !== undefined && capability.comparisons.length > 0 && (
        <Section id="comparisons" title="Comparisons">
          {capability.comparisons.map((comparison) => (
            <Comparison key={comparison.title} data-testid="ai-comparison">
              <ComparisonSummary>{comparison.title}</ComparisonSummary>
              <ComparisonScroll>
                <ComparisonTable>
                  <thead>
                    <tr>
                      {(comparison.rows[0] ?? []).map((header, hi) => (
                        <th key={hi} scope="col">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.slice(1).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </ComparisonTable>
              </ComparisonScroll>
            </Comparison>
          ))}
        </Section>
      )}

      <Section id="limits" title="Limits">
        {capability.limits.length > 0 ? (
          <LimitsList data-testid="ai-limits">
            {capability.limits.map((limit) => (
              <LimitItem key={limit}>{limit}</LimitItem>
            ))}
          </LimitsList>
        ) : (
          <EmptyState
            icon="clock"
            title="Limits under review"
            description="Honest limits are being documented for this capability."
          />
        )}
      </Section>

      {capability.relatedPosts !== undefined && capability.relatedPosts.length > 0 && (
        <RelatedWriting slugs={capability.relatedPosts} />
      )}

      <CtaRow data-testid="ai-detail-cta">
        <Button as={ROUTER_LINK} to="/contact" variant="primary" data-testid="ai-contact-cta" className={buttonLink}>
          Discuss this capability <span aria-hidden="true">→</span>
        </Button>
      </CtaRow>
    </Container>
  );
}

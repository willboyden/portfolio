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
import { getPost, type Post, type AiProof } from 'app/content';
import { formatDate, formatReadingTime } from 'app/lib/format';
import type { Tokens } from 'app/theme/tokens';
import { NotFound } from './NotFound';
import {
  Button,
  Card,
  Container,
  EmptyState,
  Heading,
  Icon,
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
  /** Each bullet states a claim and traces to a repo path (rendered mono). */
  proof: string[];
  limits: string[];
  relatedPosts?: string[];
  status: 'offered' | 'in-progress' | 'shipped';
  /** R10: head-to-head comparison tables (expandable). */
  comparisons?: AiComparisonEntry[];
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
}
const ai = contentModule as typeof contentModule & AiContentApi;

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
export function aiCapabilityBySlug(
  slug: string,
  fetcher: unknown = ai.getAiCapability,
): AiCapability | undefined {
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

/** Hub card title link — the card's real affordance. */
function cardLinkClass(theme: Tokens): string {
  return css({
    color: theme.color.text,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    display: 'inline-block',
    minHeight: '28px',
    ['@media (max-width: ' + theme.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover': {
      color: theme.color.accent,
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '3px' },
  });
}

/** Detail crumb — standalone block-level nav link, 44px at phone widths. */
function crumbClass(theme: Tokens): string {
  return css({
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: theme.font.mono,
    fontSize: theme.font.sizes.sm,
    color: theme.color.textSubtle,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    minHeight: '28px',
    ['@media (max-width: ' + theme.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover': {
      color: theme.color.accent,
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
  });
}

/** Subsection nav link (hub + detail). aria-current renders upstream. */
function subnavClass(theme: Tokens): string {
  return css({
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '44px',
    padding: `${theme.space[1]} ${theme.space[3]}`,
    fontFamily: theme.font.sans,
    fontSize: theme.font.sizes.sm,
    fontWeight: theme.font.weights.medium,
    lineHeight: theme.font.leading.none,
    borderRadius: theme.radius.full,
    border: `1px solid ${theme.color.border}`,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    color: theme.color.textMuted,
    transition:
      `color ${theme.motion.fast} ${theme.motion.ease}, ` +
      `background ${theme.motion.fast} ${theme.motion.ease}, ` +
      `border-color ${theme.motion.fast} ${theme.motion.ease}`,
    '&:hover': {
      color: theme.color.text,
      borderColor: theme.color.borderStrong,
    },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  });
}

/** Whole-declaration active state (never a value-level ternary — the vendored
 * Emotion rejects empty declarations). */
function subnavActiveClass(theme: Tokens): string {
  return css({
    background: theme.color.accentSoft,
    borderColor: theme.color.accentBorder,
    color: theme.color.accent,
    fontWeight: theme.font.weights.semibold,
  });
}

/** Related-post card link (whole card is one <Link>), PostDetail pattern. */
function relatedPostCls(theme: Tokens): string {
  return css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space[1],
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    color: 'inherit',
    minHeight: '28px',
    ['@media (max-width: ' + theme.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover .related-post-title': { color: theme.color.accent },
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
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

const SubNav = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
`;

/** Section block — mirrors ProjectDetail's Block. */
const Block = styled.section`
  padding-block: ${(p) => p.theme.space[6]};

  &:not(:last-of-type) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;

const BlockTitle = styled.h2`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-size: ${(p) => p.theme.font.sizes['2xl']};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.tight};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

/** Hub grid: 1 col → 3 cols like the Projects grid. */
const CardGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const CardMeta = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

/* h2 not h3: hub goes h1 → card titles directly (Projects.tsx rationale:
 * jumping to h3 skips a level and the a11y e2e treats that as a violation). */
const CardTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
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

const CardFooter = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[3]};
`;

/** Detail hero — same recipe as ProjectDetail's. */
const Hero = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding-block-end: ${(p) => p.theme.space[6]};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
`;

const DetailMeta = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
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
  display: flex;
  gap: ${(p) => p.theme.space[3]};
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.normal};
  counter-increment: step;
  word-break: break-word;

  &::before {
    content: counter(step);
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: ${(p) => p.theme.radius.full};
    border: 1px solid ${(p) => p.theme.color.accentBorder};
    color: ${(p) => p.theme.color.accent};
    font-family: ${(p) => p.theme.font.mono};
    font-size: ${(p) => p.theme.font.sizes.xs};
    margin-top: 0.05em;
  }
`;

/** Proof grid: 1 col → 2 cols at md. Each card = claim + mono repo path. */
const ProofGrid = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[4]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const ProofItem = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  padding: ${(p) => p.theme.space[4]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: ${(p) => p.theme.color.bgSunken};
  word-break: break-word;
`;

const ProofClaim = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.text};
  display: flex;
  gap: ${(p) => p.theme.space[2]};

  & > svg {
    flex: none;
    margin-top: ${(p) => p.theme.space[1]};
    color: ${(p) => p.theme.color.accent};
  }
`;

const ProofPath = styled.code`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
  overflow-wrap: anywhere;
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

const LimitItem = styled.li`
  display: flex;
  gap: ${(p) => p.theme.space[3]};
  color: ${(p) => p.theme.color.textMuted};
  line-height: ${(p) => p.theme.font.leading.normal};
  word-break: break-word;

  & > svg {
    flex: none;
    margin-top: ${(p) => p.theme.space[1]};
    color: ${(p) => p.theme.color.textSubtle};
  }
`;

/* Related-writing card (mirrors ProjectDetail's). */
const RelatedPostCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  padding: ${(p) => p.theme.space[4]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: ${(p) => p.theme.color.bgSunken};
`;

const RelatedPostHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const RelatedPostTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  transition: color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const RelatedPostMeta = styled.span`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;

const CrumbNav = styled.nav`
  margin-bottom: ${(p) => p.theme.space[5]};
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[2]};
`;

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                               */
/* -------------------------------------------------------------------------- */

/** The three subsection slugs, in nav/content order. */
export const AI_SECTIONS = [
  { slug: 'local-inference', label: 'Local inference' },
  { slug: 'video-generation', label: 'Video generation' },
  { slug: 'smart-routing', label: 'Smart routing' },
] as const;

export function aiSectionPath(slug: string): string {
  return `/ai-engineering/${slug}`;
}

/** aria-current="page" on the subsection matching the current path. */
function SubsectionNav({ currentPath }: { currentPath?: string }): ReactNode {
  const theme = useTheme() as Tokens;
  const location = useLocation();
  const path = currentPath ?? location.pathname;
  return (
    <SubNav aria-label="AI engineering capabilities" data-testid="ai-subnav">
      {AI_SECTIONS.map((section) => {
        const to = aiSectionPath(section.slug);
        const current = path === to;
        return (
          <Link
            key={section.slug}
            to={to}
            className={current ? subnavActiveClass(theme) : subnavClass(theme)}
            aria-current={current ? 'page' : undefined}
            data-testid={`ai-subnav-${section.slug}`}
          >
            {section.label}
          </Link>
        );
      })}
    </SubNav>
  );
}

/** Stack chips + status Tag, shared by hub cards and the detail hero. */
function CapabilityMeta({ capability }: { capability: AiCapability }): ReactNode {
  return (
    <>
      <Stack direction="row" wrap gap="2" data-testid="ai-stack">
        {capability.stack.map((tech) => (
          <Tag key={tech} size="sm" tone="outline">
            {tech}
          </Tag>
        ))}
      </Stack>
    </>
  );
}

/** Related writing: slugs resolved via getPost; unknown slugs are skipped
 * (never rendered as dead links), an empty result renders nothing. */
function RelatedWriting({ slugs }: { slugs: readonly string[] }): ReactNode {
  const theme = useTheme() as Tokens;
  const posts = slugs
    .map((slug) => getPost(slug))
    .filter((p): p is Post => p !== undefined);
  if (posts.length === 0) return null;
  return (
    <Block aria-labelledby="related-writing-title">
      <BlockTitle id="related-writing-title">Related writing</BlockTitle>
      <Stack direction="column" gap="3">
        {posts.map((post) => (
          <RelatedPostCard key={post.slug} data-testid="ai-related-post">
            <RelatedPostHint>
              <Icon name="arrow-right" size={12} />
              The thinking behind this capability
            </RelatedPostHint>
            <Link
              to={`/writing/${post.slug}`}
              className={relatedPostCls(theme)}
              data-testid="ai-related-post-link"
            >
              <RelatedPostTitle className="related-post-title">{post.title}</RelatedPostTitle>
              <RelatedPostMeta>
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span aria-hidden="true">·</span>
                {formatReadingTime(post.readingMinutes)}
              </RelatedPostMeta>
            </Link>
          </RelatedPostCard>
        ))}
      </Stack>
    </Block>
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
      <CapabilityMeta capability={capability} />
      <CardFooter>
        <Link to={href} className={cardLinkClass(theme)} data-testid={`ai-capability-cta-${capability.slug}`}>
          How it works <span aria-hidden="true">→</span>
        </Link>
      </CardFooter>
    </Card>
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
          Three capabilities I build and operate end to end — what each one is,
          how it works, where it has shipped, and what it costs you. The
          subsections below are the working tour.
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
    </Container>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail template                                                             */
/* -------------------------------------------------------------------------- */

export function AiCapabilityDetail({
  slug,
}: {
  slug: string;
}): ReactNode {
  const theme = useTheme() as Tokens;
  const capability = aiCapabilityBySlug(slug);

  if (!capability) return <NotFound />;

  const buttonLink = css({ textDecoration: 'none' });

  return (
    <Container data-testid="ai-capability-detail">
      <CrumbNav aria-label="Breadcrumb">
        <Link to="/ai-engineering" className={crumbClass(theme)} data-testid="ai-detail-crumb">
          ← All capabilities
        </Link>
      </CrumbNav>

      <Hero>
        <DetailMeta>
          <Tag tone={capabilityStatusTone(capability.status)} data-testid="ai-capability-status">
            {capability.status}
          </Tag>
          <span aria-hidden="true">·</span>
          <span>{capability.capability}</span>
        </DetailMeta>
        <Heading level={1} size="4xl" data-testid="ai-detail-title">
          {capability.title}
        </Heading>
        <Lede>{capability.oneLiner}</Lede>
        <CapabilityMeta capability={capability} />
      </Hero>

      <Block aria-labelledby="how-it-works-title">
        <BlockTitle id="how-it-works-title">How it works</BlockTitle>
        {capability.howItWorks.length > 0 ? (
          <StepsList data-testid="ai-how-it-works">
            {capability.howItWorks.map((step) => (
              <StepItem key={step}>{step}</StepItem>
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
      </Block>

      <Block aria-labelledby="proof-title">
        <BlockTitle id="proof-title">Proof</BlockTitle>
        {capability.proof.length > 0 ? (
          <ProofGrid data-testid="ai-proof-grid">
            {capability.proof.map((entry) => {
              /* R9: proof arrives as {claim, path} objects (the build expands
               * `claim = path` strings); the em-dash split is the fallback for
               * plain-string bullets. */
              const { claim, repoPath } =
                typeof entry === 'string'
                  ? splitProof(entry)
                  : { claim: (entry as AiProof).claim, repoPath: (entry as AiProof).path };
              return (
                <ProofItem key={claim} data-testid="ai-proof-item">
                  <ProofClaim>
                    <Icon name="check" size={16} />
                    <span>{claim}</span>
                  </ProofClaim>
                  {repoPath !== undefined && (
                    <ProofPath data-testid="ai-proof-path">{repoPath}</ProofPath>
                  )}
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
        <p style={{ margin: `${theme.space[3]} 0 0` }}>
          <small style={{ color: theme.color.textSubtle }}>
            Every claim above traces to a path in a repository I can walk you
            through.
          </small>
        </p>
      </Block>

      {/* R10: head-to-head comparisons — expandable tables, collapsed by
       * default (same pattern as the Talks page details). First row is the
       * header row. */}
      {capability.comparisons !== undefined && capability.comparisons.length > 0 && (
        <Block aria-labelledby="comparisons-title">
          <BlockTitle id="comparisons-title">Comparisons</BlockTitle>
          {capability.comparisons.map((comparison) => (
            <details
              key={comparison.title}
              data-testid="ai-comparison"
              style={{
                border: `1px solid ${theme.color.border}`,
                borderRadius: theme.radius.md,
                margin: `0 0 ${theme.space[3]}`,
                padding: `${theme.space[2]} ${theme.space[3]}`,
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: theme.color.text,
                }}
              >
                {comparison.title}
              </summary>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  margin: `${theme.space[2]} 0 0`,
                  fontSize: theme.font.sizes.sm,
                }}
              >
                <thead>
                  <tr>
                    {(comparison.rows[0] ?? []).map((header, hi) => (
                      <th
                        key={hi}
                        scope="col"
                        style={{
                          textAlign: 'left',
                          borderBottom: `1px solid ${theme.color.border}`,
                          padding: theme.space[1],
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.slice(1).map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{
                            borderBottom: `1px solid ${theme.color.border}`,
                            padding: theme.space[1],
                            verticalAlign: 'top',
                          }}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </Block>
      )}

      <Block aria-labelledby="limits-title">
        <BlockTitle id="limits-title">Limits</BlockTitle>
        {capability.limits.length > 0 ? (
          <LimitsList data-testid="ai-limits">
            {capability.limits.map((limit) => (
              <LimitItem key={limit}>
                <Icon name="clock" size={16} />
                <span>{limit}</span>
              </LimitItem>
            ))}
          </LimitsList>
        ) : (
          <EmptyState
            icon="clock"
            title="Limits under review"
            description="Honest limits are being documented for this capability."
          />
        )}
      </Block>

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

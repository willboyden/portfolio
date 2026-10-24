/**
 * PostDetail — a single essay.
 *
 * Renders the build-time validated markdown (`post.html` is produced by
 * scripts/build-content.mjs through the vetted vendor/markdown engine — the
 * one place dangerouslySetInnerHTML is honest, CONTRACT §5) inside <Prose>,
 * which owns the article typography.
 *
 * Semantics:
 *  - back link to /writing (real router Link, keeps section nav active);
 *  - <article> around the post; h1 → meta row (<time>, reading time, series
 *    Tag) → prose; heading order never skips;
 *  - prev/next navigation by date order in a labelled <nav> (newer post is
 *    "Previous", older is "Next" on a newest-first timeline — labelled
 *    explicitly so direction is never ambiguous);
 *  - copy-link button announces via role="status" and never throws (the hook
 *    falls back to execCommand; SSR renders the idle state).
 */

import { useMemo, useState, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { Link, useParams } from '@portfolio/router';
import {
  Button,
  Container,
  Heading,
  Icon,
  Prose,
} from 'app/components/ui';
import { content, getPost, postsByDate } from 'app/content';
import { formatDate, formatReadingTime } from 'app/lib/format';
import { rebaseHtml } from 'app/lib/seo';
import { useCopyToClipboard } from 'app/lib/hooks';
import type { Tokens } from 'app/theme/tokens';
import { NotFound } from './NotFound';

/* -------------------------------------------------------------------------- */
/* Pure helpers (exported for direct unit tests — CONTRACT §0: no jsdom)       */
/* -------------------------------------------------------------------------- */

export interface PostNeighbours<T> {
  /** Newer post (appears before this one on a newest-first timeline). */
  previous: T | undefined;
  /** Older post. */
  next: T | undefined;
}

/**
 * Neighbours of `slug` in a list ALREADY sorted newest-first. Undefined for
 * unknown slugs and at the ends — callers must never crash on the edges.
 */
export function neighboursByDate<T extends { slug: string }>(
  postsNewestFirst: readonly T[],
  slug: string,
): PostNeighbours<T> {
  const index = postsNewestFirst.findIndex((post) => post.slug === slug);
  if (index === -1) return { previous: undefined, next: undefined };
  return {
    previous: index > 0 ? postsNewestFirst[index - 1] : undefined,
    next: index < postsNewestFirst.length - 1 ? postsNewestFirst[index + 1] : undefined,
  };
}

/** The absolute URL to copy, computed browser-side only (SSR-safe pure form). */
export function shareUrl(origin: string, slug: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/writing/${slug}`;
}

/**
 * R6-C C2: series position for the "N of M" affordance. Zero-based index in a
 * newest-first list; -1 when the post is not in the series (or series unset).
 */
export function seriesPosition(
  postsNewestFirst: readonly { slug: string; series?: string }[],
  slug: string,
): { index: number; total: number } {
  const post = postsNewestFirst.find((p) => p.slug === slug);
  if (!post?.series) return { index: -1, total: 0 };
  const inSeries = postsNewestFirst.filter((p) => p.series === post.series);
  return { index: inSeries.findIndex((p) => p.slug === slug) + 1, total: inSeries.length };
}

/**
 * R6-C C1: the project this post is about, if the content curates one.
 * Resolves by slug at render time; undefined when unset or stale.
 */
export function relatedProjectOf(
  projects: readonly { slug: string; title: string; summary: string }[],
  slug: string | undefined,
): { slug: string; title: string; summary: string } | undefined {
  return slug !== undefined ? projects.find((p) => p.slug === slug) : undefined;
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */

const Article = styled.article`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[5]};
  margin-block: ${(p) => p.theme.space[6]};
`;

const BackRow = styled.p`
  margin: 0;
`;

const HeaderRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[3]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: ${(p) => p.theme.space[4]};
  }
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  min-width: 0;
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;

const Standfirst = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
  max-width: 60ch;
`;

const Sep = styled.span`
  color: ${(p) => p.theme.color.textSubtle};
`;

const ShareWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[1]};
`;

const ShareStatus = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.success};
  min-height: 1lh;
`;

const Body = styled.div`
  border-top: 1px solid ${(p) => p.theme.color.border};
  padding-top: ${(p) => p.theme.space[6]};
`;

const Pager = styled.nav`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${(p) => p.theme.space[4]};
  margin-block: ${(p) => p.theme.space[7]} ${(p) => p.theme.space[4]};
  padding-top: ${(p) => p.theme.space[6]};
  border-top: 1px solid ${(p) => p.theme.color.border};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const PagerItem = styled.div<{ $align: 'start' | 'end' }>`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
  ${(p) => p.$align === 'end' && 'align-items: flex-end; text-align: end;'}
`;

const PagerHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const PagerSpacer = styled.div``;

/** R6-C C2: series badge as a link — pill styling that survives being an <a>.
 * 44px phone hit area (R3D-03 recipe): it's a primary navigation affordance,
 * and the e2e touch-target sweep caught the first cut at 24px. */
function seriesCls(theme: Tokens): string {
  const t = theme;
  return css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: t.space[1],
    padding: `0 ${t.space[2]}`,
    minHeight: '28px',
    ['@media (max-width: ' + t.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    borderRadius: t.radius.full,
    background: t.color.accentSoft,
    color: t.color.accent,
    fontFamily: t.font.sans,
    fontSize: t.font.sizes.xs,
    fontWeight: t.font.weights.medium,
    lineHeight: t.font.leading.none,
    letterSpacing: t.font.tracking.normal,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: `color ${t.motion.fast} ${t.motion.ease}`,
    '&:hover': { color: t.color.accent, textDecoration: 'underline', textUnderlineOffset: '2px' },
    '&:focus-visible': { outline: `2px solid ${t.color.focus}`, outlineOffset: '2px' },
    /* R3D-01: series names are content — break rather than overflow. */
    /* R7B-8: overflow-wrap break-word fallback before anywhere -- modern engines
     * preferentially lay out content with `anywhere`; on Firefox \n\n     * ≤120 / Safari ≤15.3 the value is invalid and dropped, reintroducing unconstrained overflow for
     * long tokens in headings and prose. */
     'overflow-wrap': 'break-word',
     overflowWrap: 'anywhere',
  });
}

const SeriesPos = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textMuted};
`;

/** R6-C C1: "read the case study" cross-link block at the end of a post. */
const RelatedProjectBlock = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  margin-block: ${(p) => p.theme.space[5]} 0;
  padding: ${(p) => p.theme.space[4]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: ${(p) => p.theme.color.bgSunken};
`;

const RelatedProjectHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const RelatedProjectTitle = styled.span`
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.snug};
`;

const RelatedProjectSummary = styled.span`
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
  line-height: ${(p) => p.theme.font.leading.normal};
`;

/** R6-C C1: the cross-link card — whole block is one link (css() class on a
 * plain <Link>; styled(Link) would strip the `to` prop). */
function relatedProjectCls(theme: Tokens): string {
  const t = theme;
  return css({
    display: 'flex',
    flexDirection: 'column',
    gap: t.space[1],
    textDecoration: 'none',
    borderRadius: t.radius.sm,
    color: 'inherit',
    /* R3D-03: this is a primary affordance — 44px floor at phone widths. */
    minHeight: '28px',
    ['@media (max-width: ' + t.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover .related-title': { color: t.color.accent },
    '&:focus-visible': { outline: `2px solid ${t.color.focus}`, outlineOffset: '3px' },
  });
}

/**
 * Link skinning: styled(Link) would strip the router `to` prop (the vendored
 * prop filter drops non-DOM props from component targets — see Button.tsx),
 * so links get a css() class instead. Identical rule text, no middleman.
 */
function linkSkin(theme: Tokens, opts: { size: 'back' | 'pager' }) {
  const t = theme;
  return css({
    textDecoration: 'none',
    color: opts.size === 'back' ? t.color.textMuted : t.color.text,
    fontFamily: opts.size === 'back' ? t.font.mono : t.font.sans,
    fontSize: opts.size === 'back' ? t.font.sizes.sm : t.font.sizes.lg,
    fontWeight: opts.size === 'back' ? t.font.weights.normal : t.font.weights.semibold,
    lineHeight: t.font.leading.snug,
    display: opts.size === 'back' ? 'inline-flex' : 'block',
    alignItems: 'center',
    gap: t.space[1],
    /* R3D-03: standalone back/pager nav links measured 18px tall — below the
     * WCAG 2.5.8 floor. 44px phone hit area, same recipe as the chips. */
    minHeight: '28px',
    ['@media (max-width: ' + t.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover': { color: t.color.accent },
    '&:focus-visible': {
      outline: `2px solid ${t.color.focus}`,
      outlineOffset: '2px',
      borderRadius: t.radius.sm,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function PostDetail(): ReactNode {
  const theme = useTheme() as Tokens;
  const { slug } = useParams<{ slug: string }>();
  const post = slug !== undefined ? getPost(slug) : undefined;
  const [shareError, setShareError] = useState(false);
  const { copy, copied } = useCopyToClipboard();

  /* Newest-first order defines the timeline; memoised so prev/next are stable. */
  const neighbours = useMemo(
    () => (post ? neighboursByDate(postsByDate(), post.slug) : { previous: undefined, next: undefined }),
    [post],
  );

  /* R6-C C2: position within the series (for the badge's "N of M"). */
  const seriesPos = useMemo(
    () => (post ? seriesPosition(postsByDate(), post.slug) : { index: -1, total: 0 }),
    [post],
  );

  /* R6-C C1: the curated project link, when the content declares one. */
  const relatedProject = useMemo(
    () => relatedProjectOf(content.projects, post?.relatedProject),
    [post],
  );

  if (!post) {
    /* Never crash on an unknown slug (CONTRACT §4b). */
    return <NotFound />;
  }

  const backCls = linkSkin(theme, { size: 'back' });
  const pagerCls = linkSkin(theme, { size: 'pager' });

  const copyLink = async (): Promise<void> => {
    setShareError(false);
    /* SSR has no window; prerender renders the idle button, so the click
       handler can only run in a browser — window.location.href is real there. */
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : shareUrl('http://localhost:4173', post.slug);
    const ok = await copy(url);
    if (!ok) setShareError(true);
  };

  const shareMessage = shareError
    ? 'Copy failed — select the address bar to copy the link.'
    : copied
      ? 'Link copied to clipboard.'
      : '';

  return (
    <Container size="prose" data-testid="post-page">
      <Article data-testid="post-article">
        <BackRow>
          <Link to="/writing" className={backCls} data-testid="back-to-writing">
            <Icon name="chevron-left" size={14} />
            All writing
          </Link>
        </BackRow>

        <HeaderRow>
          <TitleBlock>
            <Heading level={1} data-testid="post-title">
              {post.title}
            </Heading>
            <MetaRow data-testid="post-meta">
              <time dateTime={post.date}>{formatDate(post.date, { style: 'long' })}</time>
              <Sep aria-hidden="true">·</Sep>
              <span>{formatReadingTime(post.readingMinutes)}</span>
              {post.series !== undefined && (
                <>
                  <Sep aria-hidden="true">·</Sep>
                  {/* R6-C C2: the badge is a real link to the writing index —
                      the one narrative spine gets navigation — and announces
                      the position in the series. */}
                  <Link
                    to="/writing"
                    className={seriesCls(theme)}
                    data-testid="series-badge"
                    aria-label={`${post.series} — post ${seriesPos.index} of ${seriesPos.total}`}
                  >
                    {post.series}
                    {seriesPos.total > 0 && (
                      <SeriesPos aria-hidden="true">
                        {seriesPos.index}/{seriesPos.total}
                      </SeriesPos>
                    )}
                  </Link>
                </>
              )}
            </MetaRow>
            <Standfirst data-testid="post-standfirst">
              {post.summary}
            </Standfirst>
          </TitleBlock>

          <ShareWrap>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={copied ? 'check' : 'external-link'}
              onClick={() => void copyLink()}
              aria-label="Copy link to this post"
              data-testid="copy-link"
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            {/* Announced politely so screen readers hear success/failure. */}
            <ShareStatus role="status" aria-live="polite" data-testid="share-status">
              {shareMessage}
            </ShareStatus>
          </ShareWrap>
        </HeaderRow>

        <Body>
          {/* post.html is markdown rendered + sanitized at BUILD time by the
              pipeline (CONTRACT §5) — trusted by construction, not by network. */}
          <Prose data-testid="post-prose">
            <div dangerouslySetInnerHTML={{ __html: rebaseHtml(post.html) }} />
          </Prose>
        </Body>

        {(neighbours.previous !== undefined || neighbours.next !== undefined) && (
          <Pager aria-label="Post navigation" data-testid="post-nav">
            {neighbours.previous !== undefined ? (
              <PagerItem $align="start">
                <PagerHint>
                  <Icon name="chevron-left" size={12} />
                  Previous (newer)
                </PagerHint>
                <Link to={`/writing/${neighbours.previous.slug}`} className={pagerCls} data-testid="prev-post">
                  {neighbours.previous.title}
                </Link>
              </PagerItem>
            ) : (
              <PagerSpacer aria-hidden="true" />
            )}
            {neighbours.next !== undefined ? (
              <PagerItem $align="end">
                <PagerHint>
                  Next (older)
                  <Icon name="chevron-right" size={12} />
                </PagerHint>
                <Link to={`/writing/${neighbours.next.slug}`} className={pagerCls} data-testid="next-post">
                  {neighbours.next.title}
                </Link>
              </PagerItem>
            ) : (
              <PagerSpacer aria-hidden="true" />
            )}
          </Pager>
        )}

        {/* R6-C C1: posts are about work — close the loop to the case study. */}
        {relatedProject !== undefined && (
          <RelatedProjectBlock data-testid="related-project">
            <RelatedProjectHint>
              <Icon name="arrow-right" size={12} />
              The project behind this post
            </RelatedProjectHint>
            <Link
              to={`/projects/${relatedProject.slug}`}
              className={relatedProjectCls(theme)}
              data-testid="related-project-link"
            >
              <RelatedProjectTitle className="related-title">{relatedProject.title}</RelatedProjectTitle>
              <RelatedProjectSummary>{relatedProject.summary}</RelatedProjectSummary>
            </Link>
          </RelatedProjectBlock>
        )}
      </Article>
    </Container>
  );
}

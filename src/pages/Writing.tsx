/**
 * Writing — the post index: client-side search, tag filter chips, reverse
 * chronological list, and pagination past 8 posts.
 *
 * Search is `src/lib/search.search()` (deterministic ranking, diacritic
 * insensitive, empty query = full listing newest-first) — the list and the
 * search results share one code path, so prerender and client agree.
 *
 * Accessibility contract:
 *  - search lives in a `role="search"` form with a visible-to-AT <label>
 *    (never placeholder-only); Enter cannot submit/reload the page.
 *  - tag chips are real <button type="button"> with aria-pressed in a
 *    labelled group — screen readers announce on/off state.
 *  - result count is a `role="status"` live region, so filtering is
 *    announced without stealing focus.
 *  - Pagination keeps real hrefs (middle-click / no-JS) while a delegated
 *    click handler keeps paging inside the SPA; boundary pages are
 *    aria-disabled by the primitive itself.
 */

import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { Link } from '@portfolio/router';
import {
  Button,
  Container,
  EmptyState,
  Heading,
  Icon,
  Pagination,
  Tag,
  VisuallyHidden,
} from 'app/components/ui';
import { postsByDate, type Post } from 'app/content';
import { formatDate, formatReadingTime, pluralize } from 'app/lib/format';
import { search } from 'app/lib/search';
import { useDebouncedValue, useReducedMotion } from 'app/lib/hooks';
import type { Tokens } from 'app/theme/tokens';

export const POSTS_PER_PAGE = 8;

/* -------------------------------------------------------------------------- */
/* Pure helpers (exported; unit-tested directly — no jsdom here, CONTRACT §0)  */
/* -------------------------------------------------------------------------- */

export interface PostPage<T> {
  items: T[];
  /** Clamped 1-based page actually shown. */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based index of the first/last item shown (0 when empty). */
  firstIndex: number;
  lastIndex: number;
}

/** Slice a list into 1-based pages; out-of-range pages clamp, never crash. */
export function paginate<T>(posts: readonly T[], page: number, perPage = POSTS_PER_PAGE): PostPage<T> {
  const per = Math.max(1, Math.floor(perPage));
  const pageCount = Math.max(1, Math.ceil(posts.length / per));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (current - 1) * per;
  const items = posts.slice(start, start + per);
  return {
    items,
    page: current,
    pageCount,
    total: posts.length,
    firstIndex: items.length === 0 ? 0 : start + 1,
    lastIndex: start + items.length,
  };
}

/** Tag list for the filter chips: count desc, then alphabetical (content API order). */
export function tagsFromPosts(posts: readonly Post[]): string[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.keys()].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
  );
}

/**
 * Filter posts by free-text query (title/summary/tags/excerpt) and/or one
 * tag. Empty query → every post, newest first — the same code path, so the
 * default listing and search results are ranked identically.
 */
export function filterPosts(posts: readonly Post[], query: string, tag?: string): Post[] {
  return search(query, posts, {
    limit: posts.length,
    ...(tag !== undefined && tag !== '' ? { filters: { tags: [tag] } } : {}),
    extraFields: (post) => ({ excerpt: post.excerpt }),
  }).map((hit) => hit.record);
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  margin-bottom: ${(p) => p.theme.space[6]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${(p) => p.theme.space[6]};
  }
`;

const PageHeader = styled.header`
  margin: ${(p) => p.theme.space[6]} 0;
`;

const Lead = styled.p`
  margin: ${(p) => p.theme.space[3]} 0 0;
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

const PostTitle = styled.h2`
  margin: 0;
`;

const SearchForm = styled.form`
  position: relative;
  display: flex;
  flex: 1 1 auto;
  max-width: 28rem;
  width: 100%;
`;

const SearchGlyph = styled.span`
  position: absolute;
  left: ${(p) => p.theme.space[3]};
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  color: ${(p) => p.theme.color.textSubtle};
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  min-height: calc(${(p) => p.theme.space[6]} + ${(p) => p.theme.space[4]});
  padding-block: ${(p) => p.theme.space[2]};
  padding-inline-start: calc(${(p) => p.theme.space[2]} + ${(p) => p.theme.space[6]});
  padding-inline-end: ${(p) => p.theme.space[4]};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.md};
  color: ${(p) => p.theme.color.text};
  background: ${(p) => p.theme.color.surface};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  transition: border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  &::placeholder {
    color: ${(p) => p.theme.color.textSubtle};
  }
  &:hover {
    border-color: ${(p) => p.theme.color.borderStrong};
  }
  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;

const ChipGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
`;

const ChipLabel = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
  margin-inline-end: ${(p) => p.theme.space[1]};
`;

const Chip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: calc(${(p) => p.theme.space[6]} + ${(p) => p.theme.space[1]});
  /* R3-D: 44px touch targets at phone widths (tag filtering is the main
   * mobile affordance on this page). */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-height: 44px;
  }
  padding: ${(p) => p.theme.space['0']} ${(p) => p.theme.space[3]};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.none};
  border-radius: ${(p) => p.theme.radius.full};
  border: 1px solid ${(p) => p.theme.color.border};
  cursor: pointer;
  transition:
    background ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  ${(p) =>
    p.$active &&
    `background: ${p.theme.color.accent}; color: ${p.theme.color.bg}; border-color: ${p.theme.color.accent};`}
  ${(p) =>
    !p.$active &&
    `background: ${p.theme.color.surface}; color: ${p.theme.color.text}; &:hover { background: ${p.theme.color.accentSoft}; color: ${p.theme.color.accent}; border-color: ${p.theme.color.accentBorder}; }`}

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StatusLine = styled.p`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};
`;

const PostList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[5]};
`;

const PostItem = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  padding: ${(p) => p.theme.space[4]};
  background: ${(p) => p.theme.color.surface};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
  transition: border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  &:hover {
    border-color: ${(p) => p.theme.color.borderStrong};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const MetaLine = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;

const Sep = styled.span`
  color: ${(p) => p.theme.color.textSubtle};
`;

const Summary = styled.p`
  margin: 0;
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

const TagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
`;

function titleLinkCss(theme: Tokens): string {
  return css({
    margin: 0,
    fontFamily: theme.font.sans,
    fontSize: theme.font.sizes.xl,
    fontWeight: theme.font.weights.bold,
    lineHeight: theme.font.leading.snug,
    letterSpacing: theme.font.tracking.tight,
    color: theme.color.text,
    textDecoration: 'none',
    '&:hover': { color: theme.color.accent },
    '&:focus-visible': {
      outline: `2px solid ${theme.color.focus}`,
      outlineOffset: '2px',
      borderRadius: theme.radius.sm,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function Writing(): ReactNode {
  const theme = useTheme() as Tokens;
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const debouncedQuery = useDebouncedValue(query, 200);
  const allPosts = useMemo(() => postsByDate(), []);
  const availableTags = useMemo(() => tagsFromPosts(allPosts), [allPosts]);
  const filtered = useMemo(
    () => filterPosts(allPosts, debouncedQuery, activeTag),
    [allPosts, debouncedQuery, activeTag],
  );
  const pageData = paginate(filtered, page);

  const clearFilters = (): void => {
    setQuery('');
    setActiveTag(undefined);
    setPage(1);
  };

  /**
   * Pagination links keep real hrefs (`/writing?page=N`) for middle-click and
   * no-JS; here we intercept the click so paging stays in the SPA and updates
   * state. Keyboard Enter on a link dispatches a click, so the keyboard path
   * takes exactly the same route.
   */
  const onPaginate = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a');
    if (!anchor || anchor.getAttribute('aria-disabled') === 'true') return;
    const href = anchor.getAttribute('href') ?? '';
    const match = /[?&]page=(\d+)/.exec(href);
    if (!match) return;
    event.preventDefault();
    const next = Number(match[1]);
    if (next === pageData.page) return;
    setPage(next);
    if (typeof document !== 'undefined') {
      document.getElementById('post-list')?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };

  const linkCls = titleLinkCss(theme);
  const filtering = debouncedQuery.trim() !== '' || activeTag !== undefined;

  return (
    <Container data-testid="writing-page">
      <PageHeader>
        <Heading level={1} data-testid="writing-title">
          Writing
        </Heading>
        <Lead>
          Notes on building software — architecture, data, and the occasional
          post-mortem.
        </Lead>
      </PageHeader>

      <Toolbar>
        <SearchForm role="search" onSubmit={(e) => e.preventDefault()} data-testid="post-search-form">
          <VisuallyHidden>
            <label htmlFor="post-search">Search posts by title, tag, or summary</label>
          </VisuallyHidden>
          <SearchGlyph>
            <Icon name="search" size={16} />
          </SearchGlyph>
          <SearchInput
            id="post-search"
            type="search"
            autoComplete="off"
            placeholder="Search posts…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            data-testid="post-search"
          />
        </SearchForm>

        {availableTags.length > 0 && (
          <ChipGroup role="group" aria-label="Filter posts by tag" data-testid="tag-filters">
            <ChipLabel id="tag-filter-label" aria-hidden="true">
              Filter
            </ChipLabel>
            <Chip
              type="button"
              $active={activeTag === undefined}
              aria-pressed={activeTag === undefined}
              onClick={() => {
                setActiveTag(undefined);
                setPage(1);
              }}
              data-testid="tag-chip-all"
            >
              All
            </Chip>
            {availableTags.map((tag) => (
              <Chip
                key={tag}
                type="button"
                $active={activeTag === tag}
                aria-pressed={activeTag === tag}
                onClick={() => {
                  setActiveTag(activeTag === tag ? undefined : tag);
                  setPage(1);
                }}
                data-testid={`tag-chip-${tag}`}
              >
                {tag}
              </Chip>
            ))}
          </ChipGroup>
        )}
      </Toolbar>

      {filtered.length === 0 ? (
        allPosts.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No posts yet"
            description="Essays land here as they are published. Check back soon, or subscribe via RSS."
          />
        ) : (
          <EmptyState
            icon="search"
            title="No posts match"
            description={
              filtering
                ? 'Try a different phrase, or clear the tag filter to see everything.'
                : 'Nothing to show here yet.'
            }
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={clearFilters}
                data-testid="clear-filters"
              >
                Clear search and filters
              </Button>
            }
          />
        )
      ) : (
        <>
          <StatusLine role="status" data-testid="post-count">
            {pageData.total > POSTS_PER_PAGE
              ? `Showing ${pageData.firstIndex}–${pageData.lastIndex} of ${pluralize(pageData.total, 'post')}`
              : `Showing all ${pluralize(pageData.total, 'post')}`}
          </StatusLine>
          <PostList id="post-list" data-testid="post-list">
            {pageData.items.map((post) => (
              <PostItem key={post.slug}>
                <MetaLine>
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  <Sep aria-hidden="true">·</Sep>
                  <span>{formatReadingTime(post.readingMinutes)}</span>
                  {post.series !== undefined && (
                    <>
                      <Sep aria-hidden="true">·</Sep>
                      <Tag tone="accent" size="sm">
                        {post.series}
                      </Tag>
                    </>
                  )}
                </MetaLine>
                <PostTitle>
                  <Link to={`/writing/${post.slug}`} className={linkCls} data-testid={`post-link-${post.slug}`}>
                    {post.title}
                  </Link>
                </PostTitle>
                <Summary>{post.summary}</Summary>
                {post.tags.length > 0 && (
                  <TagRow>
                    {post.tags.map((tag) => (
                      <Tag key={tag} size="sm">
                        {tag}
                      </Tag>
                    ))}
                  </TagRow>
                )}
              </PostItem>
            ))}
          </PostList>
          {pageData.pageCount > 1 && (
            <div onClick={onPaginate} data-testid="pagination-host">
              <Pagination
                page={pageData.page}
                total={pageData.pageCount}
                hrefFor={(n) => (n === 1 ? '/writing' : `/writing?page=${n}`)}
                label="Writing pages"
              />
            </div>
          )}
        </>
      )}
    </Container>
  );
}

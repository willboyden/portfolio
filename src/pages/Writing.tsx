/**
 * Writing — the post index: client-side search, a topic cloud filter, reverse
 * chronological list, and pagination past 8 posts.
 *
 * Topic cloud: word size = how many posts carry the tag (log scale, five
 * steps), so the subjects written about most stand out. Picking topics is
 * multi-select AND (a post must carry every picked topic); the cloud is
 * faceted, so it only offers topics that still match something and each count
 * is the number of posts you would get. Collapsed, it shows topics used by two
 * or more posts; "Show all" reveals the single-post tail. Filters live in the
 * URL (?tag=a&tag=b&q=text&page=n) so a filtered view can be shared.
 *
 * Search is `src/lib/search.search()` (deterministic ranking, diacritic
 * insensitive, empty query = full listing newest-first) — the list and the
 * search results share one code path, so prerender and client agree.
 *
 * Accessibility contract:
 *  - search lives in a `role="search"` form with a visible-to-AT <label>
 *    (never placeholder-only); Enter cannot submit/reload the page.
 *  - cloud words are real <button type="button"> with aria-pressed and an
 *    aria-label carrying the count, in a labelled group; active filters are
 *    a second labelled group of "remove" buttons plus "Clear all".
 *  - result count is a `role="status"` live region, so filtering is
 *    announced without stealing focus.
 *  - Pagination keeps real hrefs (middle-click / no-JS) while a delegated
 *    click handler keeps paging inside the SPA; boundary pages are
 *    aria-disabled by the primitive itself.
 */

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { Link, useLocation } from '@portfolio/router';
import { withBase } from 'app/lib/seo';
import { Button, Container, EmptyState, Heading, Icon, Pagination, Tag, VisuallyHidden } from 'app/components/ui';
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

/** Tag list by usage: count desc, then alphabetical (content API order). */
export function tagsFromPosts(posts: readonly Post[]): string[] {
  const counts = tagCounts(posts);
  return [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
}

function tagCounts(posts: readonly Post[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

/**
 * Filter posts by free-text query (title/summary/tags/excerpt) and/or tags.
 * Several tags = AND (a post must carry every one). Empty query → every post,
 * newest first — the same code path, so the default listing and search
 * results are ranked identically.
 */
export function filterPosts(posts: readonly Post[], query: string, tags?: string | readonly string[]): Post[] {
  const wanted = (typeof tags === 'string' ? [tags] : (tags ?? [])).filter((t) => t !== '');
  return search(query, posts, {
    limit: posts.length,
    ...(wanted.length > 0 ? { filters: { tags: wanted } } : {}),
    extraFields: (post) => ({ excerpt: post.excerpt }),
  }).map((hit) => hit.record);
}

/** Add the tag when absent, remove it when present (order of picking kept). */
export function toggleTag(selected: readonly string[], tag: string): string[] {
  return selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag];
}

export interface CloudEntry {
  tag: string;
  /** Posts that carry this tag AND match the current search + picked tags. */
  count: number;
  /** Posts that carry this tag at all (drives the word size). */
  total: number;
  /** 1..5 size step, log-scaled against the most used tag. */
  weight: 1 | 2 | 3 | 4 | 5;
  selected: boolean;
}

export interface TagCloud {
  /** Alphabetical, ready to render. */
  entries: CloudEntry[];
  /** Topics left out by the collapsed view (0 = nothing to expand). */
  hidden: number;
}

/** Tags used by fewer posts than this fold into "Show all" while collapsed. */
export const CLOUD_MIN_POSTS = 2;

/** Map a usage count to a 1..5 size step on a log scale (1 post → 1, max → 5). */
export function cloudWeight(count: number, max: number): CloudEntry['weight'] {
  if (max <= 1 || count <= 1) return 1;
  const step = 1 + Math.round((4 * Math.log(count)) / Math.log(max));
  return Math.min(5, Math.max(1, step)) as CloudEntry['weight'];
}

/**
 * Build the faceted cloud. `matching` is the list the page currently shows
 * (search + picked tags applied). A topic is offered when it is picked or
 * still matches at least one post, so a click never leads to an empty list.
 * `collapse` hides topics used by fewer than CLOUD_MIN_POSTS posts overall
 * (never a picked one).
 */
export function tagCloud(
  all: readonly Post[],
  matching: readonly Post[],
  selected: readonly string[],
  collapse: boolean,
): TagCloud {
  const totals = tagCounts(all);
  const facet = tagCounts(matching);
  const max = Math.max(0, ...totals.values());
  const offered = [...totals.keys()].filter((tag) => selected.includes(tag) || (facet.get(tag) ?? 0) > 0);
  const kept = collapse
    ? offered.filter((tag) => selected.includes(tag) || (totals.get(tag) ?? 0) >= CLOUD_MIN_POSTS)
    : offered;
  const entries = kept
    .map((tag) => {
      const total = totals.get(tag) ?? 0;
      return {
        tag,
        count: facet.get(tag) ?? 0,
        total,
        weight: cloudWeight(total, max),
        selected: selected.includes(tag),
      };
    })
    .sort((a, b) => a.tag.localeCompare(b.tag));
  return { entries, hidden: offered.length - kept.length };
}

export interface WritingQuery {
  tags: string[];
  q: string;
  page: number;
}

/** Read ?tag=a&tag=b&q=text&page=n (unknown keys ignored, junk pages → 1). */
export function parseWritingSearch(searchString: string): WritingQuery {
  const params = new URLSearchParams(searchString);
  const tags: string[] = [];
  for (const raw of params.getAll('tag')) {
    const tag = raw.trim();
    if (tag !== '' && !tags.includes(tag)) tags.push(tag);
  }
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return { tags, q: params.get('q') ?? '', page: Number.isFinite(page) && page > 1 ? page : 1 };
}

/** The inverse of parseWritingSearch: '' when nothing is set. */
export function writingSearch({ tags, q, page }: WritingQuery): string {
  const params = new URLSearchParams();
  for (const tag of tags) params.append('tag', tag);
  if (q.trim() !== '') params.set('q', q.trim());
  if (page > 1) params.set('page', String(page));
  const out = params.toString();
  return out === '' ? '' : `?${out}`;
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
    /* R2-D V6: center keeps the 48px input visually balanced against the
     * 36px chip row instead of hanging from the same top line. */
    align-items: center;
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

/* Topic cloud panel: a quiet surface under the search box. */
const TopicPanel = styled.section`
  margin-bottom: ${(p) => p.theme.space[4]};
  padding: ${(p) => p.theme.space[3]} ${(p) => p.theme.space[4]};
  background: ${(p) => p.theme.color.surface};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
`;

const TopicHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[2]} ${(p) => p.theme.space[4]};
`;

/* Desktop: always open. Phones: folded until "Show topics" (a 29-word cloud
 * with 44px targets is ~900px tall at 375px wide). */
const TopicBody = styled.div<{ $phoneOpen: boolean }>`
  margin-top: ${(p) => p.theme.space[3]};
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    display: ${(p) => (p.$phoneOpen ? 'block' : 'none')};
  }
`;

const HeadActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
`;

const TopicTitle = styled.h2`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const TopicLabel = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${(p) => p.theme.space[1]} ${(p) => p.theme.space[3]};
`;

const TopicHint = styled.span`
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;

const Cloud = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: ${(p) => p.theme.space[1]} ${(p) => p.theme.space[1]};
`;

const CLOUD_SIZES = { 1: 'sm', 2: 'md', 3: 'lg', 4: 'xl', 5: '2xl' } as const;

const CloudWord = styled.button<{ $weight: CloudEntry['weight']; $active: boolean }>`
  display: inline-flex;
  align-items: baseline;
  gap: 0.2em;
  /* 44px touch targets at phone widths, as on every other filter control. */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-height: 44px;
    align-items: center;
  }
  padding: ${(p) => p.theme.space[1]} ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes[CLOUD_SIZES[p.$weight]]};
  font-weight: ${(p) =>
    p.$weight >= 4
      ? p.theme.font.weights.bold
      : p.$weight === 3
        ? p.theme.font.weights.semibold
        : p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.none};
  letter-spacing: ${(p) => (p.$weight >= 4 ? p.theme.font.tracking.tight : p.theme.font.tracking.normal)};
  color: ${(p) => (p.$weight >= 3 ? p.theme.color.text : p.theme.color.textMuted)};
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${(p) => p.theme.radius.md};
  cursor: pointer;
  transition:
    background ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  &:hover {
    color: ${(p) => p.theme.color.accent};
    background: ${(p) => p.theme.color.accentSoft};
  }

  ${(p) =>
    p.$active &&
    `color: ${p.theme.color.bg}; background: ${p.theme.color.accent}; border-color: ${p.theme.color.accent};
     &:hover { color: ${p.theme.color.bg}; background: ${p.theme.color.accent}; }`}

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const CloudCount = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.normal};
  letter-spacing: normal;
  opacity: 0.75;
`;

/* Small text-style action ("Show all 62 topics", "Clear all"). One rule
 * string shared by three separate styled buttons: extending a styled
 * component (styled(TextButton)) emits two classes whose order on the client
 * is not guaranteed, so a `display` override could lose to the base. */
function textButtonRules(t: Tokens): string {
  return `
  display: inline-flex;
  align-items: center;
  gap: ${t.space[1]};
  min-height: calc(${t.space[6]} + ${t.space[1]});
  padding: 0 ${t.space[2]};
  font-family: ${t.font.sans};
  font-size: ${t.font.sizes.sm};
  font-weight: ${t.font.weights.medium};
  color: ${t.color.accent};
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${t.radius.md};
  cursor: pointer;
  &:hover { background: ${t.color.accentSoft}; }
  &:focus-visible { outline: 2px solid ${t.color.focus}; outline-offset: 2px; }
  @media (max-width: ${t.breakpoint.md}) { min-height: 44px; }
  `;
}

const TextButton = styled.button`
  ${(p) => textButtonRules(p.theme as Tokens)}
`;

/* On phones "Show all" only makes sense once the cloud is open. */
const ExpandToggle = styled.button<{ $phoneOpen: boolean }>`
  ${(p) => textButtonRules(p.theme as Tokens)}
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    display: ${(p) => (p.$phoneOpen ? 'inline-flex' : 'none')};
  }
`;

/* Phones only: folds the cloud away so the posts stay near the top. */
const PhoneToggle = styled.button`
  ${(p) => textButtonRules(p.theme as Tokens)}
  display: none;
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    display: inline-flex;
    border-color: ${(p) => p.theme.color.accentBorder};
  }
`;

const ActiveBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  margin-bottom: ${(p) => p.theme.space[3]};
`;

const ActiveLabel = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const ActiveChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  min-height: calc(${(p) => p.theme.space[6]} + ${(p) => p.theme.space[1]});
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-height: 44px;
  }
  padding: 0 ${(p) => p.theme.space[2]} 0 ${(p) => p.theme.space[3]};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  color: ${(p) => p.theme.color.accent};
  background: ${(p) => p.theme.color.accentSoft};
  border: 1px solid ${(p) => p.theme.color.accentBorder};
  border-radius: ${(p) => p.theme.radius.full};
  cursor: pointer;

  &:hover {
    border-color: ${(p) => p.theme.color.accent};
  }
  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
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
  const location = useLocation();
  const allPosts = useMemo(() => postsByDate(), []);
  const knownTags = useMemo(() => new Set(tagsFromPosts(allPosts)), [allPosts]);

  /* Initial state from the URL (a shared /writing?tag=rust link); tags the
   * site no longer has are dropped rather than producing an empty list. */
  const initial = useMemo(() => parseWritingSearch(location.search), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [query, setQuery] = useState(initial.q);
  const [selected, setSelected] = useState<string[]>(() => initial.tags.filter((t) => knownTags.has(t)));
  const [page, setPage] = useState(initial.page);
  const [expanded, setExpanded] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 200);
  const filtered = useMemo(() => filterPosts(allPosts, debouncedQuery, selected), [allPosts, debouncedQuery, selected]);
  const filtering = debouncedQuery.trim() !== '' || selected.length > 0;
  /* While filtering, the faceted cloud is already short: show every topic
   * that still matches. Collapse only the unfiltered, full cloud. */
  const cloud = useMemo(
    () => tagCloud(allPosts, filtered, selected, !expanded && !filtering),
    [allPosts, filtered, selected, expanded, filtering],
  );
  const pageData = paginate(filtered, page);

  /* Keep the address bar in step (replaceState: filtering is not navigation,
   * so Back still leaves the page). Pagination writes its own page number. */
  const searchString = writingSearch({ tags: selected, q: debouncedQuery, page: pageData.page });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.search === searchString) return;
    const url = window.location.pathname + searchString + window.location.hash;
    window.history.replaceState(window.history.state, '', url);
  }, [searchString]);

  const pickTag = (tag: string): void => {
    setSelected((current) => toggleTag(current, tag));
    setPage(1);
  };

  const clearFilters = (): void => {
    setQuery('');
    setSelected([]);
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
  const totalTopics = knownTags.size;

  return (
    <Container data-testid="writing-page">
      <PageHeader>
        <Heading level={1} data-testid="writing-title">
          Writing
        </Heading>
        <Lead>Notes on building software — architecture, data, and the occasional post-mortem.</Lead>
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
      </Toolbar>

      {totalTopics > 0 && (
        <TopicPanel aria-labelledby="topic-cloud-title" data-testid="tag-filters">
          <TopicHead>
            <TopicLabel>
              <TopicTitle id="topic-cloud-title">Topics</TopicTitle>
              <TopicHint data-testid="tag-cloud-hint">
                {selected.length > 0 ? 'Posts must match every topic picked' : 'Bigger words have more posts'}
              </TopicHint>
            </TopicLabel>
            <HeadActions>
              {cloud.hidden > 0 || expanded ? (
                <ExpandToggle
                  type="button"
                  aria-expanded={expanded}
                  aria-controls="topic-cloud"
                  onClick={() => setExpanded((open) => !open)}
                  data-testid="tag-cloud-toggle"
                  $phoneOpen={phoneOpen}
                >
                  {expanded ? 'Main topics only' : `Show all ${totalTopics} topics`}
                </ExpandToggle>
              ) : null}
              {/* Phones only: the cloud folds away so the posts stay near the top. */}
              <PhoneToggle
                type="button"
                aria-expanded={phoneOpen}
                aria-controls="topic-body"
                onClick={() => setPhoneOpen((open) => !open)}
                data-testid="tag-cloud-phone-toggle"
              >
                {phoneOpen ? 'Hide topics' : 'Show topics'}
              </PhoneToggle>
            </HeadActions>
          </TopicHead>
          <TopicBody id="topic-body" $phoneOpen={phoneOpen} data-testid="tag-cloud-body">
            <Cloud id="topic-cloud" role="group" aria-label="Filter posts by topic" data-testid="tag-cloud">
              {cloud.entries.map((entry) => (
                <li key={entry.tag}>
                  <CloudWord
                    type="button"
                    $weight={entry.weight}
                    $active={entry.selected}
                    aria-pressed={entry.selected}
                    aria-label={`${entry.tag}, ${pluralize(entry.count, 'post')}`}
                    onClick={() => pickTag(entry.tag)}
                    data-testid={`tag-cloud-${entry.tag}`}
                    data-weight={entry.weight}
                  >
                    {entry.tag}
                    <CloudCount aria-hidden="true">{entry.count}</CloudCount>
                  </CloudWord>
                </li>
              ))}
            </Cloud>
          </TopicBody>
        </TopicPanel>
      )}

      {filtering && (
        <ActiveBar role="group" aria-label="Active filters" data-testid="active-filters">
          <ActiveLabel aria-hidden="true">Filtered by</ActiveLabel>
          {selected.map((tag) => (
            <ActiveChip
              key={tag}
              type="button"
              aria-label={`Remove topic ${tag}`}
              onClick={() => pickTag(tag)}
              data-testid={`active-tag-${tag}`}
            >
              {tag}
              <Icon name="close" size={14} />
            </ActiveChip>
          ))}
          {debouncedQuery.trim() !== '' && (
            <ActiveChip
              type="button"
              aria-label={`Remove search “${debouncedQuery.trim()}”`}
              onClick={() => {
                setQuery('');
                setPage(1);
              }}
              data-testid="active-query"
            >
              “{debouncedQuery.trim()}”
              <Icon name="close" size={14} />
            </ActiveChip>
          )}
          <TextButton type="button" onClick={clearFilters} data-testid="clear-all-filters">
            Clear all
          </TextButton>
        </ActiveBar>
      )}

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
              filtering ? 'Try a different phrase, or remove a topic to see more.' : 'Nothing to show here yet.'
            }
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters} data-testid="clear-filters">
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
              : filtering
                ? `Showing ${pluralize(pageData.total, 'post')} of ${allPosts.length}`
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
                      <Tag key={tag} size="sm" tone={selected.includes(tag) ? 'accent' : 'default'}>
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
                hrefFor={(n) => withBase(`/writing${writingSearch({ tags: selected, q: debouncedQuery, page: n })}`)}
                label="Writing pages"
              />
            </div>
          )}
        </>
      )}
    </Container>
  );
}

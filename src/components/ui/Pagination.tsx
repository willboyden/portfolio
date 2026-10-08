import styled from '@emotion/styled';

/**
 * Pagination — accessible paging for the project/post indexes.
 *
 * Semantics: <nav aria-label="Pagination"> > <ul> of links. The active page is
 * NOT a link (aria-disabled, no href) and carries aria-current="page". Previous
 * / next become aria-disabled with their href removed on the boundary pages so
 * they are not tabbable — the CDP suite can assert both states.
 *
 * Pages are windowed (first, last, +/-1 around current) with "…" gaps.
 */
const Nav = styled.nav`
  display: flex;
  justify-content: center;
`;

const List = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Item = styled.li`
  display: flex;
`;

const Page = styled.a<{ $current: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]};
  box-sizing: border-box;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.none};
  border-radius: ${(p) => p.theme.radius.md};
  border: 1px solid ${(p) => p.theme.color.border};
  text-decoration: none;
  transition:
    background ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  /* current page: solid accent with bg-colored text (>= 5.16:1 both themes) */
  ${(p) =>
    p.$current &&
    `background: ${p.theme.color.accent}; color: ${p.theme.color.bg}; border-color: ${p.theme.color.accent};`}
  ${(p) =>
    !p.$current &&
    `background: ${p.theme.color.surface}; color: ${p.theme.color.text}; &:hover { background: ${p.theme.color.accentSoft}; color: ${p.theme.color.accent}; border-color: ${p.theme.color.accentBorder}; }`}

  &[aria-disabled='true'] {
    background: ${(p) => p.theme.color.bgSunken};
    color: ${(p) => p.theme.color.textSubtle};
    border-color: ${(p) => p.theme.color.border};
    cursor: default;
    text-decoration: none;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Edge = styled(Page)`
  gap: ${(p) => p.theme.space[1]};
  padding-inline: ${(p) => p.theme.space[3]};
`;

const Gap = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 44px;
  color: ${(p) => p.theme.color.textSubtle};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
`;

export interface PaginationProps {
  page: number;
  total: number;
  /** href for a given 1-based page; default is a ?page= query. */
  hrefFor?: (page: number) => string;
  label?: string;
  className?: string;
  'data-testid'?: string;
}

/** 1 … 4 5 [6] 7 8 … 20 */
export function pageWindow(page: number, total: number, around = 1): number[] {
  const keep = new Set<number>([1, total]);
  for (let i = page - around; i <= page + around; i += 1) {
    if (i >= 1 && i <= total) keep.add(i);
  }
  const sorted = [...keep].sort((a, b) => a - b);
  const out: number[] = [];
  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (prev !== undefined && n - prev > 1) out.push(-1); /* -1 = ellipsis */
    out.push(n);
  }
  return out;
}

export function Pagination({
  page,
  total,
  hrefFor = (n) => (n === 1 ? '?' : `?page=${n}`),
  label = 'Pagination',
  className,
  ...rest
}: PaginationProps): React.ReactNode {
  const clamped = Math.max(1, Math.min(page, total));
  const items = pageWindow(clamped, total);
  const linkProps = (target: number, current: boolean) =>
    current || target < 1 || target > total
      ? { href: undefined, 'aria-disabled': true as const, 'aria-label': current ? `Page ${target}, current page` : `Page ${target}` }
      : { href: hrefFor(target), 'aria-disabled': undefined, 'aria-label': `Go to page ${target}` };

  /* R1-B L2: an <a> without href is NOT focusable, so on page 1 the disabled
   * "‹ Prev" dropped out of the tab order and keyboard users could not reach
   * "Next ›" past it. Disabled edges get tabIndex=0 to stay in the tab
   * sequence; aria-disabled conveys the state and they navigate nowhere. */
  const edgeTabIndex = (enabled: boolean) => (enabled ? undefined : 0);

  return (
    <Nav aria-label={label} className={className} data-testid={rest['data-testid'] ?? 'pagination'}>
      <List>
        <Item>
          <Edge
            {...linkProps(clamped - 1, false)}
            href={clamped > 1 ? hrefFor(clamped - 1) : undefined}
            aria-disabled={clamped > 1 ? undefined : true}
            tabIndex={edgeTabIndex(clamped > 1)}
            aria-label="Previous page"
            $current={false}
            data-edge="prev"
          >
            ‹ Prev
          </Edge>
        </Item>
        {items.map((n, index) =>
          n === -1 ? (
            <Item key={`gap-${index}`}>
              <Gap aria-hidden="true">…</Gap>
            </Item>
          ) : (
            <Item key={n}>
              <Page
                {...linkProps(n, n === clamped)}
                aria-current={n === clamped ? 'page' : undefined}
                $current={n === clamped}
                data-page={n}
              >
                {n}
              </Page>
            </Item>
          ),
        )}
        <Item>
          <Edge
            {...linkProps(clamped + 1, false)}
            href={clamped < total ? hrefFor(clamped + 1) : undefined}
            aria-disabled={clamped < total ? undefined : true}
            tabIndex={edgeTabIndex(clamped < total)}
            aria-label="Next page"
            $current={false}
            data-edge="next"
          >
            Next ›
          </Edge>
        </Item>
      </List>
    </Nav>
  );
}

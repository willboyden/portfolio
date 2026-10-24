/**
 * Primary navigation.
 *
 * TWO LOCAL QUIRKS WORTH KNOWING
 * 1. `currentPath` is an explicit prop with a router-derived default. The router
 *    reads `window.location`, so under `renderToStaticMarkup` (the only renderer
 *    available offline — CONTRACT §0) every route renders as `/` and active
 *    state would be untestable. Taking the path as input makes the logic a pure
 *    function; the runtime call-site omits the prop.
 * 2. Links are `css()` class names applied to the router's `<Link>` rather than
 *    `styled(Link)`. The vendored styled() filters props through an allow-list
 *    for non-intrinsic targets, which silently drops `to` — `css()` + `Link`
 *    keeps client-side routing intact. Same tokens, same hashing.
 */

import type { ReactNode } from 'react';
import { Link, useLocation } from '@portfolio/router';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { content } from 'app/content';
import { useThemeTokens } from './ThemePreference';

export interface NavItem {
  label: string;
  to: string;
  /** Match only the exact path (`/` must not swallow every route). */
  exact?: boolean;
  /** Optional accessible title/aria-label override (e.g. for "Now"). */
  title?: string;
  'aria-label'?: string;
}

/** ROUTES from CONTRACT §3. Detail templates (`/projects/:slug`,
 * `/writing/:slug`) and the 404 are deliberately absent: a template is not a
 * destination a visitor can choose. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', to: '/', exact: true },
  { label: 'Projects', to: '/projects' },
  { label: 'AI Engineering', to: '/ai-engineering' },
  { label: 'Writing', to: '/writing' },
  { label: 'Videos', to: '/videos' },
  { label: 'Talks', to: '/talks' },
  { label: 'Now', to: '/now', title: 'What I\'m working on now', 'aria-label': 'What I\'m working on now' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

/**
 * R2-A A7/A11: nav is content-driven. Sections with zero entries (Videos,
 * Talks) stay OUT of chrome until seeded — empty-but-advertised tabs read as
 * inexperience. The routes still prerender (deep links never 404). `Now` is
 * always present: recruiters check it, and it renders honest static copy
 * regardless of content counts. R9: AI Engineering is gated the same way —
 * it can never ship as an empty advertised tab.
 */
export function availableNavItems(): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.to === '/videos') return content.videos.length > 0;
    if (item.to === '/talks') return content.talks.length > 0;
    if (item.to === '/ai-engineering') return content.aiCapabilities.length > 0;
    return true;
  });
}

/** Same normalisation the router applies (`vendor/router` `normalize`). */
export function normalizePath(path: string): string {
  if (!path) return '/';
  const withoutQuery = path.split(/[?#]/)[0] ?? '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) return withoutQuery.slice(0, -1);
  return withoutQuery || '/';
}

/**
 * Active iff the target is the current route or a parent of it — mirrors
 * `useIsActive` in `vendor/router` so prop-driven and router-driven rendering
 * agree. `exact` exists because `/` would otherwise prefix-match everything.
 */
export function isNavActive(item: NavItem, currentPath: string): boolean {
  const current = normalizePath(currentPath);
  const target = normalizePath(item.to);
  if (item.exact || target === '/') return current === target;
  return current === target || current.startsWith(`${target}/`);
}

/** Items with their active flag resolved — shared by desktop nav and MobileMenu. */
export function decorateNavItems(
  items: readonly NavItem[],
  currentPath: string,
): Array<NavItem & { active: boolean }> {
  return items.map((item) => ({ ...item, active: isNavActive(item, currentPath) }));
}

const List = styled.ul`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  margin: 0;
  padding: 0;
  list-style: none;

  /* Inside the mobile dialog the same list stacks and grows its hit targets. */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${(p) => p.theme.space[1]};
  }
`;

const Item = styled.li`
  margin: 0;
`;

/**
 * One nav link. Active state is conveyed three ways — colour, a dot marker
 * (survives greyscale / colour vision deficiency) and `aria-current="page"` —
 * so it never depends on colour alone.
 */
function navLinkClass(active: boolean, tokens: ReturnType<typeof useThemeTokens>): string {
  return css`
    display: flex;
    align-items: center;
    gap: ${tokens.space[2]};
    min-height: 44px;
    padding: ${tokens.space[2]} ${tokens.space[3]};
    border-radius: ${tokens.radius.md};
    font-family: ${tokens.font.sans};
    font-size: ${tokens.font.sizes.sm};
    font-weight: ${tokens.font.weights.medium};
    line-height: ${tokens.font.leading.snug};
    letter-spacing: ${tokens.font.tracking.normal};
    text-decoration: none;
    white-space: nowrap;
    color: ${active ? tokens.color.text : tokens.color.textMuted};
    background: ${active ? tokens.color.accentSoft : 'transparent'};
    transition:
      color ${tokens.motion.fast} ${tokens.motion.ease},
      background-color ${tokens.motion.fast} ${tokens.motion.ease};

    &::after {
      content: '';
      flex: none;
      width: ${active ? '6px' : '0'};
      height: 6px;
      border-radius: ${tokens.radius.full};
      background: ${active ? tokens.color.accent : 'transparent'};
    }

    &:hover {
      color: ${tokens.color.text};
      background: ${tokens.color.surfaceHover};
    }

    &:focus-visible {
      outline: 2px solid ${tokens.color.focus};
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `;
}

export interface NavProps {
  /** Explicit route. Defaults to the router's current pathname. */
  currentPath?: string;
  items?: readonly NavItem[];
  /** Called after a link activates — MobileMenu closes itself with it. */
  onNavigate?: () => void;
  /** Accessible name for the list; two navs on one page need distinct names. */
  label?: string;
  id?: string;
  className?: string;
}

export function Nav({
  currentPath,
  items = availableNavItems(),
  onNavigate,
  label = 'Primary',
  id,
  className,
}: NavProps): ReactNode {
  const tokens = useThemeTokens();
  const routerPath = useLocation().pathname;
  const path = currentPath ?? routerPath;
  const decorated = decorateNavItems(items, path);

  return (
    <List
      id={id}
      className={className}
      role="list"
      aria-label={label}
      data-testid="nav-list"
      data-current-path={path}
    >
      {decorated.map((item) => (
        <Item key={item.to}>
          <Link
            to={item.to}
            className={navLinkClass(item.active, tokens)}
            aria-current={item.active ? 'page' : undefined}
            data-testid={`nav-link-${item.label.toLowerCase()}`}
            data-active={item.active ? 'true' : 'false'}
            onNavigate={onNavigate}
            title={item.title}
            aria-label={item['aria-label']}
          >
            {item.label}
          </Link>
        </Item>
      ))}
    </List>
  );
}

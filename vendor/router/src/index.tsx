/**
 * A tiny history-based router.
 *
 * WHY: `react-router-dom` is not installable in this offline container. This
 * covers exactly what a portfolio needs: declarative path matching with
 * `:params`, `<Link>` with modifier-key handling, programmatic navigation, hash
 * fallback for `file://` previews, and scroll restoration. It is deliberately
 * NOT a general-purpose router — if you need nested layouts, data loaders or
 * search-param objects, install react-router-dom and swap the import in
 * src/app/routes.tsx (the API mirrors its subset closely on purpose).
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from 'react';

export interface Location {
  pathname: string;
  search: string;
  hash: string;
}

export interface RouteMatch<P extends Record<string, string> = Record<string, string>> {
  path: string;
  params: P;
}

export interface RouterValue {
  location: Location;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  match: RouteMatch | null;
  routes: RouteDefinition[];
}

export interface RouteDefinition {
  path: string;
  component: ComponentType<{ params: Record<string, string> }>;
}

const RouterContext = createContext<RouterValue | null>(null);

export function parseLocation(href: string): Location {
  /* Strip origin if an absolute URL slipped in. */
  const withoutOrigin = href.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
  const hashIndex = withoutOrigin.indexOf('#');
  const hash = hashIndex === -1 ? '' : withoutOrigin.slice(hashIndex);
  const beforeHash = hashIndex === -1 ? withoutOrigin : withoutOrigin.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  const pathname = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const search = queryIndex === -1 ? '' : beforeHash.slice(queryIndex);
  return { pathname: pathname || '/', search, hash };
}

function normalize(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

/** Compile `/blog/:slug` into a matcher. Only `:param` segments supported. */
function compilePath(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = normalize(pattern)
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${source}/?$`), keys };
}

export function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const { regex, keys } = compilePath(pattern);
  const found = regex.exec(normalize(pathname));
  if (!found) return null;
  const params: Record<string, string> = {};
  keys.forEach((key, index) => {
    const raw = found[index + 1];
    if (raw !== undefined) params[key] = decodeURIComponent(raw);
  });
  return params;
}

/** Choose the most specific route (exact matches beat `:param` segments). */
export function resolveRoute(routes: RouteDefinition[], pathname: string): RouteMatch | null {
  let best: { match: RouteMatch; specificity: number } | null = null;
  for (const route of routes) {
    /* '*' is a catch-all with the lowest possible specificity. */
    if (route.path === '*') continue;
    const params = matchRoute(route.path, pathname);
    if (params === null) continue;
    /* Static segments score higher than params — mirrors react-router ranking. */
    const specificity = route.path.split('/').filter((s) => s && !s.startsWith(':')).length * 100;
    if (!best || specificity > best.specificity) best = { match: { path: route.path, params }, specificity };
  }
  if (best) return best.match;
  const catchAll = routes.find((route) => route.path === '*');
  return catchAll ? { path: '*', params: {} } : null;
}

function readBrowserLocation(): Location {
  if (typeof window === 'undefined') return { pathname: '/', search: '', hash: '' };
  return parseLocation(window.location.pathname + window.location.search + window.location.hash);
}

export interface RouterProviderProps {
  routes: RouteDefinition[];
  children?: ReactNode;
  /**
   * Render at this path instead of the live browser URL. Used by the static
   * prerender pass (no `window` exists) and by tests. Ignored client-side
   * after hydration-time first render unless the provider is remounted.
   */
  initialPath?: string;
}

export function RouterProvider({ routes, children, initialPath }: RouterProviderProps): ReactNode {
  const [location, setLocation] = useState<Location>(() =>
    initialPath !== undefined ? parseLocation(initialPath) : readBrowserLocation(),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    /* R1A-09(a): hash-URL back/forward fires BOTH popstate and hashchange —
     * without dedupe each trip re-creates the Location object and re-renders
     * every consumer for an identical route. Bail out when the URL string is
     * unchanged (same semantics as react-router's key-less compare). */
    let lastHref: string | null = null;
    const sync = () => {
      const next = readBrowserLocation();
      const key = `${next.pathname}|${next.search}|${next.hash}`;
      if (key === lastHref) return;
      lastHref = key;
      setLocation(next);
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;
    const next = to;
    if (options?.replace) {
      window.history.replaceState(null, '', next);
    } else {
      window.history.pushState(null, '', next);
    }
    setLocation(parseLocation(next));
    /* Scroll to top on navigation, honour #anchors and reduced-motion.
     * R1A-09(b): everything after the FIRST # is the id (split('#')[1]
     * truncated '/x#a#b' to 'a', missing the element entirely). */
    const anchor = next.includes('#') ? next.slice(next.indexOf('#') + 1) : null;
    if (anchor) {
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const match = useMemo(() => resolveRoute(routes, location.pathname), [routes, location.pathname]);

  const value = useMemo<RouterValue>(
    () => ({ location, navigate, match, routes }),
    [location, navigate, match, routes],
  );

  return createElement(RouterContext.Provider, { value }, children);
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error('[router] useRouter must be used inside <RouterProvider>');
  return value;
}

export function useLocation(): Location {
  return useRouter().location;
}

export function useNavigate(): RouterValue['navigate'] {
  return useRouter().navigate;
}

export function useParams<P extends Record<string, string>>(): P {
  return (useRouter().match?.params ?? {}) as P;
}

/** True while the given path is the active route (or a parent of it). */
export function useIsActive(path: string, exact = false): boolean {
  const { location } = useRouter();
  const current = normalize(location.pathname);
  const target = normalize(path);
  if (exact || target === '/') return current === target;
  return current === target || current.startsWith(`${target}/`);
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children?: ReactNode;
  onNavigate?: () => void;
}

/**
 * Anchor that routes client-side while staying a real link: middle-click,
 * cmd-click, and download targets fall through to the browser.
 */
export function Link({ to, children, onClick, onNavigate, ...rest }: LinkProps): ReactNode {
  const navigate = useRouter().navigate;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    const external = /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(to);
    if (external) return;
    event.preventDefault();
    navigate(to);
    onNavigate?.();
  };

  return createElement('a', { href: to, onClick: handleClick, ...rest }, children);
}

/** Render the matched route (routes come from RouterProvider), or NotFound. */
export function Outlet({ NotFound }: { NotFound: ComponentType }): ReactNode {
  const { match, routes } = useRouter();
  if (!match) return createElement(NotFound);
  const route = routes.find((candidate) => candidate.path === match.path);
  if (!route) return createElement(NotFound);
  const Component = route.component;
  return createElement(Component, { params: match.params });
}

/**
 * App shell: the single tree both the client (src/main.tsx) and the prerender
 * pass (prerender/entry.mjs) mount. Keeping it one factory is what guarantees
 * prerendered HTML and hydrated client markup agree.
 */
import { StrictMode, createElement, useEffect, type ComponentType, type ReactNode } from 'react';
import { RouterProvider, Outlet, useLocation, useParams, type RouteDefinition } from '@portfolio/router';
import { retirePrerenderedTag } from '@emotion/react';
import { applyDocumentMeta } from 'app/lib/seo';
import { metaFor } from 'app/lib/route-meta';
import { AppThemeProvider } from 'app/theme/ThemeProvider';
import { Layout, ThemePreferenceProvider } from 'app/components/layout';
import { Home } from 'app/pages/Home';
import { About } from 'app/pages/About';
import { Now } from 'app/pages/Now';
import { Projects } from 'app/pages/Projects';
import { ProjectDetail } from 'app/pages/ProjectDetail';
import { Writing } from 'app/pages/Writing';
import { PostDetail } from 'app/pages/PostDetail';
import { Videos } from 'app/pages/Videos';
import { Talks } from 'app/pages/Talks';
import { AiEngineeringHub, AiCapabilityDetail } from 'app/pages/AiEngineering';
import { Contact } from 'app/pages/Contact';
import { NotFound } from 'app/pages/NotFound';

/** One route for every capability page: the slug comes from the URL, so a
 * capability in content can never be prerendered without a route (tech-stack
 * and data-analytics 404'd when the three slugs were hard-coded here). */
function AiDetailRoute(): ReactNode {
  const { slug } = useParams<{ slug: string }>();
  return <AiCapabilityDetail slug={slug ?? ''} />;
}

export const routes: RouteDefinition[] = [
  { path: '/', component: Home },
  { path: '/about', component: About },
  { path: '/now', component: Now },
  { path: '/projects', component: Projects },
  { path: '/projects/:slug', component: ProjectDetail },
  { path: '/writing', component: Writing },
  { path: '/writing/:slug', component: PostDetail },
  { path: '/videos', component: Videos },
  { path: '/talks', component: Talks },
  { path: '/ai-engineering', component: AiEngineeringHub as never },
  { path: '/ai-engineering/:slug', component: AiDetailRoute },
  { path: '/contact', component: Contact },
];

function Shell(): ReactNode {
  /* R1A-10: after the first client commit (styles live in the client sheet),
   * retire the prerendered critical-CSS copy. No unstyled window: it happens
   * after commit, and on prerender/server this effect never runs. */
  useEffect(() => {
    retirePrerenderedTag();
  }, []);
  /* R2C-3: SPA navigations must update <title>/description/canonical — the
   * values come from the SAME metaFor() the prerender used, so DOM and static
   * HTML can never drift. applyDocumentMeta is a no-op on the server. */
  const location = useLocation();
  useEffect(() => {
    applyDocumentMeta(metaFor(location.pathname));
  }, [location.pathname]);
  return createElement(Layout, {
    /* Outlet inside Layout resolves the matched route. */
    children: createElement(Outlet, { NotFound }),
  });
}

/**
 * Build the full app element, optionally pinned to a path (prerender/tests).
 * `standalone` skips StrictMode's double-render noise in the static pass.
 */
export function createApp(path?: string): ReactNode {
  return createElement(
    StrictMode,
    null,
    createElement(
      ThemePreferenceProvider,
      null,
      createElement(
        AppThemeProvider,
        null,
        createElement(
          RouterProvider,
          { routes, ...(path !== undefined ? { initialPath: path } : {}) },
          createElement(Shell, { children: null }),
        ),
      ),
    ),
  );
}

export type { ComponentType };

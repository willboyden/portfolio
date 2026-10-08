/**
 * Empty-content resilience for Home.
 *
 * content.json now ships REAL content, so this file mocks 'app/content' back
 * to empty arrays (vi.mock is hoisted per-module, hence the separate file) to
 * pin the behavior the site needs the day it deploys before content exists —
 * or after a contributor deletes everything.
 */
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('app/content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('app/content')>();
  return {
    ...actual, // keep types/runtime helpers
    content: { projects: [], posts: [], videos: [], talks: [] },
    featuredProjects: () => [],
    postsByDate: () => [],
  };
});

const { renderToStaticMarkup } = await import('react-dom/server');
const { createElement } = await import('react');
const { RouterProvider } = await import('@portfolio/router');
const { AppThemeProvider } = await import('app/theme/ThemeProvider');
const { Home } = await import('./Home');

function render(ui: React.ReactNode): string {
  return renderToStaticMarkup(
    createElement(
      AppThemeProvider,
      null,
      createElement(
        RouterProvider,
        { routes: [{ path: '*', component: () => null }], initialPath: '/' },
        ui,
      ),
    ),
  );
}

describe('Home with zero content', () => {
  const html = render(createElement(Home));

  it('hero renders regardless', () => {
    expect(html).toContain('data-testid="home-hero"');
    expect(html).toContain('data-testid="home-cta-projects"');
  });

  it('no cards or lists leak, designed empty-states do', () => {
    expect(html).not.toContain('data-testid="featured-grid"');
    expect(html).not.toContain('data-testid="latest-writing"');
    const emptyStates = [...html.matchAll(/<div\b[^>]*data-testid="empty-state"[^>]*>/g)].map((m) => m[0]);
    expect(emptyStates.length).toBeGreaterThanOrEqual(2);
    expect(emptyStates.every((t) => t.includes('role="status"'))).toBe(true);
  });
});

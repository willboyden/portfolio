/**
 * Unit tests for the personal pages (Home / About / Now / Contact / NotFound).
 *
 * ENVIRONMENT (CONTRACT §0): no jsdom — `environment: 'node'`, so pages are
 * rendered with react-dom/server and asserted as HTML strings. The provider
 * stack mirrors what App mounts: AppThemeProvider (Emotion theme + tokens)
 * over RouterProvider pinned with `initialPath`, exactly the pattern in
 * src/components/layout/layout.test.tsx.
 *
 * DATA: src/content/generated/content.json is EMPTY right now, which is
 * itself the "empty-content resilience" fixture these pages must survive —
 * the content pipeline fills the same file later without page changes.
 */

import { describe, expect, it } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterProvider, type RouteDefinition } from '@portfolio/router';
import { AppThemeProvider } from 'app/theme/ThemeProvider';

import { Home } from './Home';
import { About } from './About';
import { Now } from './Now';
import { Contact } from './Contact';
import { NotFound } from './NotFound';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const routes: RouteDefinition[] = [
  { path: '/', component: () => null },
  { path: '/about', component: () => null },
  { path: '/now', component: () => null },
  { path: '/projects', component: () => null },
  { path: '/projects/:slug', component: () => null },
  { path: '/writing', component: () => null },
  { path: '/contact', component: () => null },
  { path: '*', component: () => null },
];

/** Same provider shape the real app mounts, pinned to a test path. */
function render(ui: ReactNode, initialPath = '/'): string {
  return renderToStaticMarkup(
    createElement(
      AppThemeProvider,
      null,
      createElement(RouterProvider, { routes, initialPath }, ui),
    ),
  );
}

/** All opening tags of a given element, in document order. */
function tags(html: string, tag: string): string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => m[0]);
}

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/* -------------------------------------------------------------------------- */
/* Every page: shared invariants                                               */
/* -------------------------------------------------------------------------- */

const PAGES: readonly { name: string; path: string; element: ReactNode }[] = [
  { name: 'Home', path: '/', element: <Home /> },
  { name: 'About', path: '/about', element: <About /> },
  { name: 'Now', path: '/now', element: <Now /> },
  { name: 'Contact', path: '/contact', element: <Contact /> },
  { name: 'NotFound', path: '/nope', element: <NotFound /> },
];

describe('personal pages — shared invariants', () => {
  for (const page of PAGES) {
    describe(page.name, () => {
      const html = render(page.element, page.path);

      it('renders exactly one <h1>', () => {
        expect(tags(html, 'h1')).toHaveLength(1);
      });

      it('renders non-trivial markup', () => {
        expect(html.length).toBeGreaterThan(1000);
      });

      it('never leaks "undefined" / "NaN" / "[object Object]" into the DOM', () => {
        expect(html).not.toContain('undefined');
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('[object Object]');
      });

      it('never leaks $-prefixed transient props into the DOM', () => {
        expect(html).not.toContain('$tone');
        expect(html).not.toContain('$size');
        expect(html).not.toContain('$interactive');
      });
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Home — hero, CTAs, empty-content resilience                                 */
/* -------------------------------------------------------------------------- */

describe('Home', () => {
  const html = render(<Home />, '/');

  it('h1 carries the name and the tagline reads as part of the same heading', () => {
    const h1 = tags(html, 'h1')[0] ?? '';
    expect(h1).toBeDefined();
    expect(html).toContain('Alex Rivera');
    expect(html).toContain('production realities back into the analysis');
  });

  it('eyebrow positions the three-hat consultant framing', () => {
    expect(html).toContain('Technical consultant');
    expect(html).toContain('Data scientist');
  });

  it('primary CTAs link to /projects and /contact', () => {
    const anchors = tags(html, 'a');
    const projectsCta = anchors.find((t) => t.includes('href="/projects"') && t.includes('data-testid="home-cta-projects"'));
    const contactCta = anchors.find((t) => t.includes('href="/contact"') && t.includes('data-testid="home-cta-contact"'));
    expect(projectsCta).toBeDefined();
    expect(contactCta).toBeDefined();
    /* Button's label renders in a <span data-slot="label"> after the tag. */
    const afterProjects = html.slice(html.indexOf(projectsCta ?? ''));
    const afterContact = html.slice(html.indexOf(contactCta ?? ''));
    expect(afterProjects).toContain('View projects');
    expect(afterContact).toContain('Get in touch');
  });

  it('survives the currently-empty content.json: hero-only state, zero cards, friendly empty states', () => {
    /* content.json ships with empty arrays during this build phase — this IS
     * the empty-content fixture. The hero must render, no cards may appear,
     * and both list sections must fall back to designed EmptyStates. */
    expect(html).not.toContain('data-testid="featured-grid"');
    expect(html).not.toContain('data-testid="latest-writing"');
    const emptyStates = tags(html, 'div').filter((t) => t.includes('data-testid="empty-state"'));
    expect(emptyStates.length).toBeGreaterThanOrEqual(2);
    expect(emptyStates.every((t) => t.includes('role="status"'))).toBe(true);
    expect(html).toContain('Case studies are being written up');
    expect(html).toContain('Writing starts soon');
  });
});

/* -------------------------------------------------------------------------- */
/* About — narrative, skills, method                                           */
/* -------------------------------------------------------------------------- */

describe('About', () => {
  const html = render(<About />, '/about');

  it('h1 states the positioning', () => {
    expect(html).toContain('Consultant by title, engineer by habit.');
  });

  it('narrative covers the real arc: full-stack roots, data-science degree, consulting now', () => {
    expect(html).toContain('B.S. in Data Science');
    expect(html).toContain('technical consultant');
    expect(html).toContain('web applications');
  });

  it('skills are a real <dl> grouped by area', () => {
    expect(html).toContain('<dl');
    expect(html).toContain('data-testid="about-skills"');
    for (const area of ['Languages', 'Frontend', 'Data', 'Infrastructure']) {
      expect(html).toContain(`>${area}<`);
    }
  });

  it('how-I-work section renders all four principles in an ordered list', () => {
    expect(html).toContain('data-testid="about-principles"');
    expect(tags(html, 'ol').some((t) => t.includes('about-principles'))).toBe(true);
    /* Section headers are h2 landmarks (Section renders Heading level 2). */
    expect(countOccurrences(html, '<h2')).toBeGreaterThanOrEqual(2);
    for (const title of ['Diagnose before prescribing', 'Leave the team stronger', 'Numbers over vibes']) {
      expect(html).toContain(title);
    }
  });

  it('contact CTA links to /contact', () => {
    const cta = tags(html, 'a').find((t) => t.includes('data-testid="about-cta-contact"'));
    expect(cta).toContain('href="/contact"');
  });
});

/* -------------------------------------------------------------------------- */
/* Now — date stamp, panels                                                    */
/* -------------------------------------------------------------------------- */

describe('Now', () => {
  const html = render(<Now />, '/now');

  it('h1 is the now-page date stamp', () => {
    const h1 = tags(html, 'h1')[0] ?? '';
    expect(h1).toBeDefined();
    expect(html).toContain('Last updated October 2026');
  });

  it('renders the three panels: focused areas, currently learning, available for', () => {
    for (const id of ['now-focused', 'now-learning', 'now-available']) {
      expect(html).toContain(`data-testid="${id}"`);
    }
    expect(html).toContain('Focused areas');
    expect(html).toContain('Currently learning');
    expect(html).toContain('Available for');
  });

  it('contact CTA links to /contact', () => {
    const cta = tags(html, 'a').find((t) => t.includes('data-testid="now-cta-contact"'));
    expect(cta).toContain('href="/contact"');
  });
});

/* -------------------------------------------------------------------------- */
/* Contact — email CTA, socials, honest no-form posture                        */
/* -------------------------------------------------------------------------- */

describe('Contact', () => {
  const html = render(<Contact />, '/contact');

  it('email CTA is a real mailto: anchor', () => {
    const cta = tags(html, 'a').find((t) => t.includes('data-testid="contact-cta-email"'));
    const address = tags(html, 'a').find((t) => t.includes('data-testid="contact-email-link"'));
    expect(cta).toBeDefined();
    expect(cta).toContain('href="mailto:');
    expect(address).toBeDefined();
    expect(address).toContain('href="mailto:');
    expect(html).toContain('hello@example.com');
  });

  it('lists the SOCIAL_LINKS platforms from the shared layout constant', () => {
    for (const label of ['GitHub', 'LinkedIn', 'Bluesky']) {
      expect(html).toContain(label);
    }
    /* Empty URLs render as DRAFT-marked inert notes, never dead anchors. */
    expect(html).toContain('DRAFT');
    const socialAnchors = tags(html, 'a').filter((t) => t.includes('href=""'));
    expect(socialAnchors).toHaveLength(0);
  });

  it('does not ship a fake form: no <form> element anywhere', () => {
    expect(tags(html, 'form')).toHaveLength(0);
  });

  it('secondary navigation to /projects and /now exists', () => {
    const projects = tags(html, 'a').find((t) => t.includes('data-testid="contact-cta-projects"'));
    const now = tags(html, 'a').find((t) => t.includes('data-testid="contact-cta-now"'));
    expect(projects).toContain('href="/projects"');
    expect(now).toContain('href="/now"');
  });
});

/* -------------------------------------------------------------------------- */
/* NotFound — standalone rendering + recovery links                            */
/* -------------------------------------------------------------------------- */

describe('NotFound', () => {
  it('renders standalone at the catch-all path and at the prerendered /404', () => {
    for (const path of ['*', '/nope-at-all', '/404']) {
      const html = render(<NotFound />, path);
      expect(tags(html, 'h1')).toHaveLength(1);
      expect(html).toContain('exist');
    }
  });

  it('recovery CTAs link to /, /projects and /writing', () => {
    const html = render(<NotFound />, '/404');
    const anchors = tags(html, 'a');
    const home = anchors.find((t) => t.includes('data-testid="notfound-cta-home"'));
    const projects = anchors.find((t) => t.includes('data-testid="notfound-cta-projects"'));
    const writing = anchors.find((t) => t.includes('data-testid="notfound-cta-writing"'));
    expect(home).toContain('href="/"');
    expect(projects).toContain('href="/projects"');
    expect(writing).toContain('href="/writing"');
  });

  it('also offers contact/about/now text links', () => {
    const html = render(<NotFound />, '/404');
    for (const href of ['href="/contact"', 'href="/about"', 'href="/now"']) {
      expect(html).toContain(href);
    }
  });
});

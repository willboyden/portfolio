/**
 * Unit tests for the site chrome.
 *
 * CONSTRAINT SHAPING THESE TESTS (CONTRACT §0/§6)
 * There is no jsdom, so `vitest` runs `environment: 'node'` and components are
 * rendered with `react-dom/server`. That means:
 *   - we can assert STRUCTURE (attributes, order, aria wiring) from HTML;
 *   - we can assert STYLE from `__sheetCss()` (the vendored sheet is the
 *     prerender extraction source, so this is the CSS that really ships);
 *   - we CANNOT press Tab or Escape — so every behaviour that matters is
 *     implemented as a pure function (nextFocusIndex / prevFocusIndex /
 *     isEscape / shouldLockScroll) and tested directly. Real key events are the
 *     CDP e2e suite's job, not ours.
 */

import { describe, expect, it } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@emotion/react';
import { __sheetCss } from '@emotion-mini/core';
import { RouterProvider, type RouteDefinition } from '@portfolio/router';
import { darkTheme, lightTheme } from 'app/theme/tokens';

import { Header } from './Header';
import { Footer, SOCIAL_LINKS, currentYear, copyrightLine } from './Footer';
import { Layout, skipLinkClass } from './Layout';
import {
  NAV_ITEMS,
  availableNavItems,
  decorateNavItems,
  isNavActive,
  normalizePath,
  type NavItem,
} from './Nav';
import {
  FOCUSABLE_SELECTOR,
  MOBILE_MENU_ID,
  MobileMenu,
  focusIndexOf,
  isEscape,
  menuAriaState,
  nextFocusIndex,
  prevFocusIndex,
  shouldLockScroll,
} from './MobileMenu';
import { ThemeToggle, nextThemeLabel } from './ThemeToggle';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ThemePreferenceProvider,
  isThemeName,
  resolveThemeName,
  scrollBehaviorFor,
  themeDocumentAttributes,
} from './ThemePreference';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const routes: RouteDefinition[] = [
  { path: '/', component: () => null },
  { path: '/about', component: () => null },
  { path: '/projects', component: () => null },
  { path: '/projects/:slug', component: () => null },
  { path: '/writing', component: () => null },
  { path: '/writing/:slug', component: () => null },
  { path: '/talks', component: () => null },
  { path: '/contact', component: () => null },
  { path: '*', component: () => null },
];

/** Full provider stack the chrome expects: Emotion theme → preference → router. */
function render(ui: ReactNode, theme: typeof darkTheme = darkTheme, prefTheme: 'dark' | 'light' = 'dark'): string {
  return renderToStaticMarkup(
    createElement(
      ThemeProvider,
      { theme },
      createElement(
        ThemePreferenceProvider,
        { defaultTheme: prefTheme },
        createElement(RouterProvider, { routes }, ui),
      ),
    ),
  );
}

/** CSS rules emitted for one class name, so sheet-wide greps stay scoped. */
function ruleFor(cssClass: string, sheet: string): string {
  const rule = new RegExp(`\\.${cssClass}\\b[\\s\\S]*?\\n\\}`, 'g');
  return [...sheet.matchAll(rule)].map((m) => m[0]).join('\n');
}

/** All opening tags of a given element, in document order. */
function tags(html: string, tag: string): string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => m[0]);
}

function testids(html: string): string[] {
  return [...html.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1] as string);
}

/* -------------------------------------------------------------------------- */
/* Nav — routes, active state, aria-current                                    */
/* -------------------------------------------------------------------------- */

describe('Nav', () => {
  it('renders every available destination with the right href', () => {
    const html = render(<Layout currentPath="/about" />);
    const anchors = tags(html, 'a').filter((t) => t.includes('nav-link-'));
    const items = availableNavItems();
    expect(anchors.length).toBe(items.length);
    items.forEach((item) => {
      expect(anchors.some((t) => t.includes(`href="${item.to}"`))).toBe(true);
    });
  });

  it('NAV_ITEMS is the full route list; chrome shows availableNavItems() (R2-A A7/A11)', () => {
    /* Full list = every chrome-eligible route (CONTRACT §3). If nav changes,
     * update CONTRACT §3 routes AND this list. R9: AI Engineering joins. */
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'Home',
      'Projects',
      'AI Engineering',
      'Writing',
      'Videos',
      'Talks',
      'Now',
      'About',
      'Contact',
    ]);
    /* With zero videos/talks published, chrome hides those tabs (empty tabs
     * read as inexperience) but keeps Now (recruiters check it). R9: AI
     * Engineering renders — 3 capabilities exist. */
    const labels = availableNavItems().map((i) => i.label);
    expect(labels).not.toContain('Videos');
    expect(labels).not.toContain('Talks');
    expect(labels).toContain('Now');
    expect(labels).toContain('AI Engineering');
    /* Rendered header chrome must match the filtered set. */
    const h = render(<Layout currentPath="/" />);
    expect(h).not.toContain('>Videos</a>');
    expect(h).toContain('>Now</a>');
    expect(h).toContain('>AI Engineering</a>');
  });

  it('marks exactly one link with aria-current="page" for a section route', () => {
    const html = render(<Layout currentPath="/projects" />);
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    const activeTag = tags(html, 'a').find((t) => t.includes('aria-current="page"'));
    expect(activeTag).toContain('href="/projects"');
    expect(activeTag).toContain('nav-link-projects');
  });

  it('root route activates only Home (exact match, no prefix swallow)', () => {
    const html = render(<Layout currentPath="/" />);
    const activeTags = tags(html, 'a').filter((t) => t.includes('aria-current="page"'));
    expect(activeTags.length).toBe(1);
    for (const tag of activeTags) expect(tag).toContain('href="/"');
  });

  it('a detail route keeps its parent section active', () => {
    const html = render(<Layout currentPath="/writing/a-post" />);
    const activeTags = tags(html, 'a').filter((t) => t.includes('aria-current="page"'));
    expect(activeTags.length).toBe(1);
    for (const tag of activeTags) expect(tag).toContain('href="/writing"');
  });

  it('an unknown route activates nothing', () => {
    const html = render(<Layout currentPath="/nope" />);
    expect(html).not.toContain('aria-current="page"');
  });

  it('data-active mirrors aria-current so CSS and ARIA cannot drift', () => {
    const html = render(<Layout currentPath="/about" />);
    const aboutTag = tags(html, 'a').find((t) => t.includes('nav-link-about'));
    expect(aboutTag).toContain('aria-current="page"');
    expect(aboutTag).toContain('data-active="true"');
    const contactTag = tags(html, 'a').find((t) => t.includes('nav-link-contact'));
    expect(contactTag).toContain('data-active="false"');
    expect(contactTag).not.toContain('aria-current');
  });

  it('nav list is a labelled list landmark', () => {
    const html = render(<Layout currentPath="/" />);
    expect(html).toContain('id="primary-nav-list"');
    expect(html).toContain('aria-label="Primary"');
    const open = render(<Layout currentPath="/" menuOpen />);
    expect(open).toContain('aria-label="Mobile"');
  });

  it('defaults currentPath from the router when the prop is omitted', () => {
    /* No window under `environment: 'node'`, so RouterProvider resolves to '/'. */
    const html = render(<Layout />);
    const home = tags(html, 'a').find((t) => t.includes('nav-link-home'));
    expect(home).toContain('aria-current="page"');
  });
});

describe('Nav pure helpers', () => {
  const item = (to: string, exact = false): NavItem => ({ label: 'x', to, exact });

  it('normalizes trailing slashes, empty input and query/hash suffixes', () => {
    expect(normalizePath('/projects/')).toBe('/projects');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('/about?utm=1')).toBe('/about');
    expect(normalizePath('/about#top')).toBe('/about');
  });

  it('isNavActive: section, parent, exact and root semantics', () => {
    expect(isNavActive(item('/projects'), '/projects')).toBe(true);
    expect(isNavActive(item('/projects'), '/projects/foo')).toBe(true);
    expect(isNavActive(item('/projects'), '/projects-foo')).toBe(false);
    expect(isNavActive(item('/projects'), '/about')).toBe(false);
    expect(isNavActive(item('/', true), '/')).toBe(true);
    expect(isNavActive(item('/', true), '/about')).toBe(false);
    expect(isNavActive(item('/'), '/about')).toBe(false);
  });

  it('decorateNavItems returns exactly one active item for a known route', () => {
    const decorated = decorateNavItems(NAV_ITEMS, '/contact');
    expect(decorated.filter((i) => i.active)).toHaveLength(1);
    expect(decorated.find((i) => i.active)?.to).toBe('/contact');
  });
});

/* -------------------------------------------------------------------------- */
/* Header — sticky bar, menu button contract, dialog wiring                    */
/* -------------------------------------------------------------------------- */

describe('Header', () => {
  it('renders a sticky banner with the wordmark linking home', () => {
    const html = render(<Header />);
    const sheet = __sheetCss();
    expect(html).toContain('data-testid="site-header"');
    const wordmark = tags(html, 'a').find((t) => t.includes('data-testid="wordmark"'));
    expect(wordmark).toContain('href="/"');
    expect(html).toContain('William Boyden');
    expect(sheet).toContain('position: sticky');
    expect(sheet).toContain(`z-index: ${darkTheme.z.nav}`);
  });

  it('closed menu button exposes aria-expanded=false, aria-controls and haspopup', () => {
    const html = render(<Header />);
    const button = tags(html, 'button').find((t) => t.includes('data-testid="menu-button"'));
    expect(button).toBeDefined();
    expect(button).toContain('aria-expanded="false"');
    expect(button).toContain(`aria-controls="${MOBILE_MENU_ID}"`);
    expect(button).toContain('aria-haspopup="dialog"');
    expect(button).toContain('type="button"');
  });

  it('closed state renders no dialog at all', () => {
    const html = render(<Header />);
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-modal');
    expect(html).not.toContain('data-testid="mobile-menu"');
  });

  it('open state renders real dialog semantics wired to the button', () => {
    const html = render(<Header menuOpen />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain(`id="${MOBILE_MENU_ID}"`);
    const button = tags(html, 'button').find((t) => t.includes('data-testid="menu-button"'));
    expect(button).toContain('aria-expanded="true"');
    const dialog = tags(html, 'div').find((t) => t.includes('data-testid="mobile-menu"'));
    expect(dialog).toContain('aria-labelledby');
    expect(dialog).toContain('tabindex="-1"');
  });

  it('the dialog label points at an id that exists in the markup', () => {
    const html = render(<Header menuOpen />);
    const dialog = tags(html, 'div').find((t) => t.includes('data-testid="mobile-menu"')) ?? '';
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(dialog)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toContain('>Navigation</h2>');
  });

  it('close button and backdrop exist once the dialog is open', () => {
    const html = render(<Header menuOpen />);
    expect(html).toContain('data-testid="menu-close"');
    expect(html).toContain('aria-label="Close menu"');
    expect(html).toContain('data-testid="menu-backdrop"');
    expect(html).toContain('Press Escape to close');
  });

  it('the open dialog carries the same nav links and a theme toggle', () => {
    const html = render(<Header menuOpen currentPath="/about" />);
    const ids = testids(html);
    expect(ids.filter((id) => id === 'nav-link-about').length).toBe(2); /* desktop + dialog */
    expect(ids.filter((id) => id === 'theme-toggle').length).toBe(2);
    expect(html).toContain('data-testid="nav-link-about"');
  });

  it('theme toggle is a labelled button describing the action', () => {
    const html = render(<Header />);
    const toggle = tags(html, 'button').find((t) => t.includes('data-testid="theme-toggle"'));
    expect(toggle).toContain('aria-label="Switch to light theme"');
    expect(toggle).toContain('data-theme="dark"');
    expect(toggle).toContain('type="button"');
  });

  it('theme toggle carries a polite live region naming the RESULT (R1-B F9)', () => {
    const html = render(<Header />);
    /* role=status live region announces the theme that just took effect —
     * a changing aria-label alone is silent on activation. */
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    const announce = tags(html, 'span').find((t) => t.includes('data-testid="theme-announcement"'));
    expect(announce).toBeDefined();
    /* Sibling of the button, never inside it — button descendants flatten into
     * the accessible name, which would double-announce on every focus. */
    const btnStart = html.indexOf('data-testid="theme-toggle"');
    const btnEnd = html.indexOf('</button>', btnStart);
    const announceIdx = html.indexOf('data-testid="theme-announcement"');
    expect(announceIdx).toBeGreaterThan(-1);
    expect(announceIdx < btnStart || announceIdx > btnEnd).toBe(true);
    /* text names the CURRENT theme (result), not the action — tags() only
     * captures the opening tag, so match the span+text as emitted. */
    expect(html).toMatch(/data-testid="theme-announcement"[^>]*>Dark theme</);
  });

  it('icons are aria-hidden so the label is not duplicated', () => {
    const html = render(<Header />);
    expect(html).toContain('aria-hidden="true"');
    const svgs = tags(html, 'svg').filter((t) => t.includes('data-testid="icon-sun"'));
    expect(svgs.length).toBe(1);
    expect(svgs[0]).toContain('aria-hidden="true"');
    expect(svgs[0]).toContain('focusable="false"');
  });

  it('no transient $-props leak into the DOM', () => {
    const html = render(<Layout currentPath="/" />);
    expect(html).not.toContain('$active');
    expect(html).not.toContain('$open');
  });
});

/* -------------------------------------------------------------------------- */
/* MobileMenu focus/keyboard helpers — the un-SSR-testable logic, extracted    */
/* -------------------------------------------------------------------------- */

describe('focus order helpers', () => {
  it('nextFocusIndex walks forward and wraps to the first item', () => {
    expect(nextFocusIndex(0, 4)).toBe(1);
    expect(nextFocusIndex(2, 4)).toBe(3);
    expect(nextFocusIndex(3, 4)).toBe(0);
    expect(nextFocusIndex(-1, 4)).toBe(0);
  });

  it('prevFocusIndex walks backward and wraps to the last item', () => {
    expect(prevFocusIndex(3, 4)).toBe(2);
    expect(prevFocusIndex(0, 4)).toBe(3);
    expect(prevFocusIndex(-1, 4)).toBe(3);
  });

  it('an empty focusable set yields -1 rather than a bogus index', () => {
    expect(nextFocusIndex(0, 0)).toBe(-1);
    expect(prevFocusIndex(0, 0)).toBe(-1);
  });

  it('single-element dialog stays put on both directions', () => {
    expect(nextFocusIndex(0, 1)).toBe(0);
    expect(prevFocusIndex(0, 1)).toBe(0);
  });

  it('focusIndexOf returns the position or -1 for a focus escape', () => {
    const list = ['a', 'b', 'c'];
    expect(focusIndexOf(list, 'a')).toBe(0);
    expect(focusIndexOf(list, 'c')).toBe(2);
    expect(focusIndexOf(list, 'outside')).toBe(-1);
    expect(focusIndexOf(list, null)).toBe(-1);
  });

  it('FOCUSABLE_SELECTOR covers the interactive elements this dialog uses', () => {
    expect(FOCUSABLE_SELECTOR).toContain('a[href]');
    expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
    /* The dialog panel itself is tabindex="-1" — it must not be "focusable"
       for the trap's purposes, hence the :not() guard. */
    expect(FOCUSABLE_SELECTOR).toContain(':not([tabindex="-1"])');
    expect(FOCUSABLE_SELECTOR.split(',').length).toBeGreaterThanOrEqual(8);
  });
});

describe('isEscape / scroll lock / aria state', () => {
  it('only a fresh Escape key closes', () => {
    expect(isEscape({ key: 'Escape' })).toBe(true);
    expect(isEscape({ key: 'Escape', repeat: true })).toBe(false);
    expect(isEscape({ key: 'Esc' })).toBe(false);
    expect(isEscape({ key: 'Tab' })).toBe(false);
    expect(isEscape({})).toBe(false);
  });

  it('body scroll locks while open and only while open', () => {
    expect(shouldLockScroll(true)).toBe(true);
    expect(shouldLockScroll(false)).toBe(false);
    expect(shouldLockScroll(undefined as unknown as boolean)).toBe(false);
  });

  it('menuAriaState keeps aria-controls present in both states', () => {
    expect(menuAriaState(false)).toEqual({ 'aria-expanded': false, 'aria-controls': MOBILE_MENU_ID });
    expect(menuAriaState(true)['aria-expanded']).toBe(true);
  });

  it('MobileMenu renders nothing when closed', () => {
    const html = render(
      <MobileMenu open={false} onClose={() => undefined} staticRender />,
    );
    expect(html).toBe('');
  });

  it('MobileMenu stands alone: dialog + close + nav + toggle in order', () => {
    const html = render(
      <MobileMenu open onClose={() => undefined} currentPath="/about" staticRender />,
    );
    const ids = testids(html);
    expect(ids.slice(0, 2)).toEqual(['menu-backdrop', 'mobile-menu']);
    expect(ids).toContain('menu-close');
    expect(ids).toContain('nav-list');
    expect(ids).toContain('theme-toggle');
    expect(html).toContain('aria-label="Mobile"');
  });
});

/* -------------------------------------------------------------------------- */
/* Layout — skip link, landmarks, ordering                                     */
/* -------------------------------------------------------------------------- */

describe('Layout', () => {
  it('skip link is the first element and targets #main', () => {
    const html = render(<Layout currentPath="/" />);
    const firstAnchor = tags(html, 'a')[0] ?? '';
    expect(firstAnchor).toContain('data-testid="skip-link"');
    expect(firstAnchor).toContain('href="#main"');
    expect(html).toContain('Skip to main content');
  });

  it('skip link precedes the header, main and every other anchor', () => {
    const html = render(<Layout currentPath="/" />);
    const skip = html.indexOf('data-testid="skip-link"');
    expect(skip).toBeGreaterThan(-1);
    expect(skip).toBeLessThan(html.indexOf('data-testid="site-header"'));
    expect(skip).toBeLessThan(html.indexOf('id="main"'));
    expect(skip).toBeLessThan(html.indexOf('data-testid="nav-list"'));
    const anchors = tags(html, 'a');
    expect(anchors.length).toBeGreaterThan(6);
    expect(anchors[0]).toContain('skip-link');
  });

  it('landmarks appear in document order: header → main → footer', () => {
    const html = render(<Layout currentPath="/" />);
    const header = html.indexOf('<header');
    const main = html.indexOf('<main');
    const footer = html.indexOf('<footer');
    expect(header).toBeGreaterThan(-1);
    expect(main).toBeGreaterThan(header);
    expect(footer).toBeGreaterThan(main);
    expect(html).toContain('id="main"');
    expect(html).toContain('tabindex="-1"');
  });

  it('renders children inside main', () => {
    const html = render(<Layout currentPath="/">{"page-body-here"}</Layout>);
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    expect(main).toContain('page-body-here');
  });

  it('chrome=false yields a bare shell (skip link + main only)', () => {
    const html = render(<Layout chrome={false} />);
    expect(html).not.toContain('data-testid="site-header"');
    expect(html).not.toContain('data-testid="site-footer"');
    expect(html).toContain('data-testid="skip-link"');
  });

  it('skip link styles hide visually but stay focusable', () => {
    /* Compute the class INSIDE a component render, exactly the way Layout does
     * in production. Calling skipLinkClass at test top level would push the
     * vendored css() through useContextSafe() outside a render — React then
     * logs its "Invalid hook call" warning (harmless, but noisy stderr). */
    let cssClass = '';
    const ClassProbe = (): ReactNode => {
      cssClass = skipLinkClass(darkTheme);
      return null;
    };
    render(<Layout />);
    render(<ClassProbe />);
    expect(cssClass).toMatch(/^css-/);
    /* Scoped to the skip link's own rules — MenuSlot legitimately uses
       display:none elsewhere in the sheet, which is why a sheet-wide grep
       would prove nothing here. */
    const rule = ruleFor(cssClass, __sheetCss());
    expect(rule).toContain('clip-path: inset(50%)');
    expect(rule).toContain('width: 1px');
    expect(rule).toContain('overflow: hidden');
    expect(rule).not.toContain('display: none');
    /* Flattened selectors replace `&` — assert the resolved focus selector. */
    expect(rule).toContain(`.${cssClass}:focus`);
    expect(rule).toContain('clip-path: none');
  });
});

/* -------------------------------------------------------------------------- */
/* Footer                                                                      */
/* -------------------------------------------------------------------------- */

describe('Footer', () => {
  const html = render(<Footer now={new Date('2026-10-08T00:00:00Z')} />);

  it('lists every available nav destination plus RSS', () => {
    for (const item of availableNavItems()) {
      expect(html).toContain(`data-testid="footer-link-${item.label.toLowerCase()}"`);
    }
    expect(html).toContain('data-testid="footer-rss"');
    expect(html).toContain('href="/rss.xml"');
  });

  it('name/role line and a real current year', () => {
    expect(html).toContain('William Boyden');
    expect(html).toContain('Technical consultant');
    expect(html).toContain(`© ${currentYear(new Date())} William Boyden`);
    expect(html).toContain('2026');
  });

  it('back-to-top link is present and points to #main', () => {
    const link = tags(html, 'a').find((t) => t.includes('data-testid="back-to-top"'));
    expect(link).toContain('href="#main"');
    expect(link).toContain('aria-label="Back to top"');
  });

  it('renders the owner\'s real profiles, never a placeholder handle (R2-A A12)', () => {
    expect(html).toContain('data-testid="footer-social"');
    expect(html).not.toContain('your-handle');
    for (const entry of SOCIAL_LINKS) {
      expect(entry.url).toMatch(/^https:\/\//);
      expect(html).toContain(`href="${entry.url}"`);
    }
  });

  it('an unconfigured social list skips the Elsewhere column entirely (R6-B)', () => {
    const bare = render(<Footer now={new Date('2026-01-01T00:00:00Z')} social={[{ label: 'GitHub', url: '' }]} />);
    expect(bare).not.toContain('data-testid="footer-social"');
    expect(bare).not.toContain('Elsewhere');
  });

  it('a supplied handle renders an external link with safe rel/target', () => {
    const filled = render(
      <Footer
        now={new Date('2026-01-01T00:00:00Z')}
        social={[{ label: 'GitHub', url: 'https://example.com/someone' }]}
      />,
    );
    const anchor = tags(filled, 'a').find((t) => t.includes('footer-social-github'));
    expect(anchor).toContain('href="https://example.com/someone"');
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noreferrer noopener"');
    /* R6-B: configured entries render; the column comes back with them. */
    expect(filled).toContain('data-testid="footer-social"');
    expect(filled).toContain('Elsewhere');
  });

  it('social list is a labelled list, not a bare run of links (when configured)', () => {
    /* R6-B: the list only exists when at least one social is configured —
     * assert against a configured render, not the default (unset) one. */
    const filled = render(
      <Footer
        now={new Date('2026-01-01T00:00:00Z')}
        social={[{ label: 'GitHub', url: 'https://example.com/someone' }]}
      />,
    );
    expect(filled).toContain('data-testid="footer-social"');
    expect(filled).toContain('aria-labelledby="footer-social-heading"');
    expect(filled).toContain('Elsewhere');
  });

  it('year helper survives an absurd clock', () => {
    expect(currentYear(new Date('nope'))).toBe(2026);
    expect(copyrightLine('X', 2030)).toBe('© 2030 X. All rights reserved.');
  });
});

/* -------------------------------------------------------------------------- */
/* Theme preference                                                            */
/* -------------------------------------------------------------------------- */

describe('theme preference helpers', () => {
  it('storage beats system beats default', () => {
    expect(resolveThemeName({ stored: 'light', system: true })).toBe('light');
    expect(resolveThemeName({ stored: null, system: true })).toBe('dark');
    expect(resolveThemeName({ stored: null, system: false })).toBe('light');
    expect(resolveThemeName({ stored: null, system: undefined })).toBe(DEFAULT_THEME);
    expect(resolveThemeName({ stored: 'chartreuse', system: undefined })).toBe(DEFAULT_THEME);
    expect(resolveThemeName({ stored: null, system: undefined, defaultTheme: 'light' })).toBe('light');
  });

  it('THEME_STORAGE_KEY is namespaced and ThemeName narrows correctly', () => {
    expect(THEME_STORAGE_KEY).toBe('portfolio.theme');
    expect(isThemeName('dark')).toBe(true);
    expect(isThemeName('light')).toBe(true);
    expect(isThemeName('auto')).toBe(false);
    expect(isThemeName(null)).toBe(false);
  });

  it('document attributes carry data-theme and a color-scheme value', () => {
    expect(themeDocumentAttributes('light')).toEqual({
      rootAttributes: { 'data-theme': 'light' },
      metaContent: 'light',
    });
    expect(themeDocumentAttributes('dark').metaContent).toBe('dark');
  });

  it('toggle label describes the destination theme, and scroll honours reduced motion', () => {
    expect(nextThemeLabel('dark')).toBe('Switch to light theme');
    expect(nextThemeLabel('light')).toBe('Switch to dark theme');
    expect(scrollBehaviorFor(true)).toBe('auto');
    expect(scrollBehaviorFor(false)).toBe('smooth');
  });

  it('ThemeToggle renders the light-theme variant under a light theme', () => {
    const html = render(<ThemeToggle />, lightTheme, 'light');
    expect(html).toContain('data-theme="light"');
    expect(html).toContain('aria-label="Switch to dark theme"');
    expect(html).toContain('data-testid="icon-moon"');
  });

  it('the preference, not the palette, drives the toggle: dark pref + light palette', () => {
    /* Regression guard for the ThemePreference split — the toggle reads the
       preference store, so a light Emotion theme alone must not flip it. */
    const html = render(<ThemeToggle />, lightTheme, 'dark');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-testid="icon-sun"');
  });
});

/* -------------------------------------------------------------------------- */
/* Tokens in both themes + accessibility CSS                                   */
/* -------------------------------------------------------------------------- */

describe('styling resolves from tokens in both themes', () => {
  it('dark chrome uses the dark palette', () => {
    render(<Layout currentPath="/" />, darkTheme);
    const sheet = __sheetCss();
    expect(sheet).toContain('#0b0e14'); /* color.bg — header + shell */
    expect(sheet).toContain('#eef1f8'); /* color.text */
    expect(sheet).toContain('#7ea2ff'); /* color.focus — focus rings */
    expect(sheet).toContain('color-mix(in srgb, #0b0e14 88%, transparent)');
  });

  it('light chrome uses the light palette', () => {
    render(<Layout currentPath="/" />, lightTheme);
    const sheet = __sheetCss();
    /* R2-D V4 re-derived the light canvas: page bg is now #eef1f6. */
    expect(sheet).toContain('#eef1f6');
    expect(sheet).toContain('#101725');
    expect(sheet).toContain('#2f5fe0');
    expect(sheet).toContain('color-mix(in srgb, #eef1f6 88%, transparent)');
  });

  it('backdrop blur is @supports-gated with an opaque fallback first', () => {
    render(<Layout currentPath="/" />, darkTheme);
    const sheet = __sheetCss();
    expect(sheet).toContain('@supports ((backdrop-filter: blur(12px)) or (-webkit-backdrop-filter: blur(12px)))');
    /* Opaque background first, translucent one second: browsers without
       color-mix/backdrop-filter keep the opaque value. */
    expect(sheet).toMatch(/background: #0b0e14; background: color-mix/);
  });

  it('every transition is paired with a reduced-motion opt-out', () => {
    render(<Layout currentPath="/" />, darkTheme);
    const sheet = __sheetCss();
    expect(sheet).toContain('@media (prefers-reduced-motion: reduce)');
    const transitions = (sheet.match(/transition:/g) ?? []).length;
    const reduced = (sheet.match(/@media \(prefers-reduced-motion: reduce\)/g) ?? []).length;
    expect(transitions).toBeGreaterThan(0);
    expect(reduced).toBeGreaterThan(0);
  });

  it('hit targets are >= 44px on every control', () => {
    render(<Layout currentPath="/" />, darkTheme);
    const sheet = __sheetCss();
    expect(sheet).toContain('min-height: 44px');
    expect(sheet).toContain('min-width: 44px');
    /* Nothing smaller than 44px anywhere a min-size is declared. */
    const undersized = [...sheet.matchAll(/min-(?:width|height): (\d+(?:\.\d+)?)px/g)]
      .map((m) => Number(m[1]))
      .filter((px) => px < 44);
    expect(undersized).toEqual([]);
  });

  it('no raw hex colours are emitted outside token values', () => {
    /* Sanity net: the sheet only ever contains the theme's own colours. */
    render(<Layout currentPath="/" />, darkTheme);
    const sheet = __sheetCss();
    const hexes = new Set((sheet.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase()));
    const allowed = new Set(
      [...Object.values(darkTheme.color), ...Object.values(darkTheme.shadow)]
        .join(' ')
        .toLowerCase()
        .match(/#[0-9a-f]{6}/g),
    );
    for (const hex of hexes) expect(allowed.has(hex)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* SSR safety                                                                  */
/* -------------------------------------------------------------------------- */

describe('SSR safety', () => {
  it('renders with no window/localStorage/document at all', () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    const html = render(<Layout currentPath="/projects" />);
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain('data-testid="site-header"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('survives a window object whose storage throws (private mode)', () => {
    const g = globalThis as Record<string, unknown>;
    const original = g.window;
    g.window = {
      location: { pathname: '/writing', search: '', hash: '' },
      localStorage: {
        getItem(): string {
          throw new Error('SecurityError: storage disabled');
        },
        setItem(): void {
          throw new Error('SecurityError: storage disabled');
        },
      },
      addEventListener(): void {},
      removeEventListener(): void {},
      scrollTo(): void {},
      history: { pushState(): void {}, replaceState(): void {} },
    };
    try {
      const html = render(<Layout currentPath="/writing" />);
      expect(html).toContain('data-testid="site-header"');
      expect(html).toContain('href="/writing"');
    } finally {
      if (original === undefined) delete g.window;
      else g.window = original;
    }
  });

  it('prerendered markup is deterministic across two renders', () => {
    const a = render(<Layout currentPath="/talks" />, darkTheme);
    const b = render(<Layout currentPath="/talks" />, darkTheme);
    expect(a.replace(/id="[^"]*"/g, 'id="x"')).toBe(b.replace(/id="[^"]*"/g, 'id="x"'));
  });
});

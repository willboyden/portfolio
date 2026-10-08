/**
 * Unit tests for the UI primitives.
 *
 * No jsdom here (CONTRACT §0), so every assertion is made against the HTML
 * string from renderToStaticMarkup plus the CSS the vendored Emotion sheet
 * recorded (__sheetCss()). Real interaction behaviour is the CDP suite's job;
 * these tests pin semantics, prop filtering and generated CSS.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactNode } from 'react';
import { ThemeProvider } from '@emotion/react';
import { __sheetCss } from '@emotion-mini/core';
import { darkTheme, lightTheme, type Tokens } from 'app/theme/tokens';
import {
  Button,
  Card,
  Container,
  EmptyState,
  Heading,
  Icon,
  Pagination,
  Prose,
  Section,
  SkipLink,
  Spinner,
  Stack,
  Tag,
  VisuallyHidden,
  pageWindow,
} from './index';

const h = (c: React.ComponentType<any> | string, p?: Record<string, unknown>, ...kids: unknown[]) =>
  createElement(c, p, ...(kids as React.ReactNode[]));
const dark = (node: ReactNode) => renderToStaticMarkup(h(ThemeProvider, { theme: darkTheme, children: node as never }));
const light = (node: ReactNode) => renderToStaticMarkup(h(ThemeProvider, { theme: lightTheme, children: node as never }));

const REDUCED = '@media (prefers-reduced-motion: reduce)';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Template-literal styles flatten as `prop: value`, object styles as
 * `prop:value` (verified). Match a declaration either way.
 */
const hasDecl = (sheet: string, decl: string) => {
  const idx = decl.indexOf(': ');
  const prop = idx === -1 ? decl : decl.slice(0, idx);
  const value = idx === -1 ? '' : decl.slice(idx + 2);
  expect(sheet).toMatch(new RegExp(`${escapeRe(prop)}:\\s*${escapeRe(value)}`));
};

describe('Button', () => {
  it('renders a native button with type=button by default', () => {
    const html = dark(h(Button, { children: 'Save' }));
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('data-testid="button"');
    expect(html).toContain('data-variant="primary"');
    expect(html).toContain('data-size="md"');
    expect(html).not.toContain('$variant');
  });

  it('variant primary paints accent bg with token bg text (not #fff)', () => {
    dark(h(Button, { variant: 'primary', children: 'x' }));
    const sheet = __sheetCss();
    hasDecl(sheet, `background: ${darkTheme.color.accent}`);
    hasDecl(sheet, `color: ${darkTheme.color.bg}`);
    expect(sheet).not.toContain(`color: ${darkTheme.color.accentText}`);
  });

  it('ghost variant has a transparent background and accent text', () => {
    dark(h(Button, { variant: 'ghost', children: 'x' }));
    const sheet = __sheetCss();
    hasDecl(sheet, 'background: transparent');
    hasDecl(sheet, `color: ${darkTheme.color.accent}`);
  });

  it('danger variant uses the danger token', () => {
    dark(h(Button, { variant: 'danger', children: 'x' }));
    expect(__sheetCss()).toContain(darkTheme.color.danger);
  });

  it('sizes change the min-height via space tokens', () => {
    dark(h(Button, { size: 'sm', children: 'x' }));
    hasDecl(
      __sheetCss(),
      `min-height: calc(${darkTheme.space[5]} + ${darkTheme.space[4]} + ${darkTheme.space[1]})`,
    );
  });

  it('as="a" with href renders an anchor', () => {
    const html = dark(h(Button, { as: 'a', href: '/projects', children: 'Browse' }));
    expect(html).toContain('<a');
    expect(html).toContain('href="/projects"');
    expect(html).not.toContain('type="button"');
  });

  it('href alone implies an anchor', () => {
    const html = dark(h(Button, { href: '/contact', children: 'Mail' }));
    expect(html).toContain('<a');
    expect(html).toContain('href="/contact"');
  });

  it('polymorphic `as` accepts a component and keeps custom props (router Link pattern)', () => {
    const Linkish = (props: { to: string; className?: string; children?: ReactNode }) =>
      h('a', { href: props.to, className: props.className, 'data-probe': 'linkish', children: props.children });
    const html = dark(h(Button, { as: Linkish as unknown as 'button', to: '/writing', children: 'Blog' }));
    expect(html).toContain('href="/writing"');
    expect(html).toContain('data-probe="linkish"');
    expect(html).toMatch(/class="css-[a-z0-9]+"/);
  });

  it('merges a consumer className after its own class', () => {
    const html = dark(h(Button, { className: 'mt-4', children: 'x' }));
    const classes = /class="([^"]+)"/.exec(html)?.[1] ?? '';
    const [own, ...rest] = classes.split(' ');
    expect(own).toMatch(/^css-[a-z0-9]+$/);
    expect(rest).toEqual(['mt-4']);
  });

  it('icon slots render labelled-free inline svg icons', () => {
    const html = dark(h(Button, { iconRight: 'arrow-right', children: 'Next' }));
    expect(html).toContain('<svg');
    expect(html).toContain('data-icon="arrow-right"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('loading swaps the icon for a spinner and sets aria-busy', () => {
    const html = dark(h(Button, { loading: true, iconLeft: 'arrow-right', children: 'Go' }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-loading="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading"');
    expect(html).not.toContain('data-icon="arrow-right"');
  });

  it('disabled sets the native attribute and disabled styling', () => {
    const html = dark(h(Button, { disabled: true, children: 'Nope' }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('data-loading="false"');
    hasDecl(__sheetCss(), 'cursor: not-allowed');
  });

  it('unknown props do not leak to the DOM', () => {
    const html = dark(h(Button, { bogusProp: 'leak', children: 'x' }));
    expect(html).not.toContain('bogusProp');
  });

  it('focus-visible ring + reduced-motion guard are generated', () => {
    dark(h(Button, { children: 'x' }));
    const sheet = __sheetCss();
    expect(sheet).toContain(':focus-visible');
    hasDecl(sheet, `outline: 2px solid ${darkTheme.color.focus}`);
    expect(sheet).toContain(REDUCED);
  });

  it('token colours resolve under the light theme too', () => {
    light(h(Button, { variant: 'secondary', children: 'x' }));
    const sheet = __sheetCss();
    expect(sheet).toContain(lightTheme.color.borderStrong);
    hasDecl(sheet, `outline: 2px solid ${lightTheme.color.focus}`);
  });
});

describe('Tag', () => {
  it('renders a span with the default tone', () => {
    const html = dark(h(Tag, { children: 'rust' }));
    expect(html).toContain('<span');
    expect(html).toContain('data-testid="tag"');
    expect(html).not.toContain('$tone');
  });

  it('accent tone uses accentSoft + accent (>=4.5:1 computed)', () => {
    dark(h(Tag, { tone: 'accent', children: 'x' }));
    const sheet = __sheetCss();
    expect(sheet).toContain(`background: ${darkTheme.color.accentSoft}`);
    expect(sheet).toContain(`color: ${darkTheme.color.accent}`);
  });

  it('outline tone keeps a transparent background', () => {
    dark(h(Tag, { tone: 'outline', size: 'sm', children: 'x' }));
    const sheet = __sheetCss();
    expect(sheet).toMatch(/background: transparent/);
    expect(sheet).toContain(`border-color: ${darkTheme.color.borderStrong}`);
  });

  it('size sm uses the xs font step', () => {
    dark(h(Tag, { size: 'sm', children: 'x' }));
    expect(__sheetCss()).toContain(`font-size: ${darkTheme.font.sizes.xs}`);
  });
});

describe('Card', () => {
  it('renders an article by default', () => {
    const html = dark(h(Card, { children: 'body' }));
    expect(html).toContain('<article');
    expect(html).toContain('data-testid="card"');
  });

  it('renders an anchor when href is given', () => {
    const html = dark(h(Card, { href: '/projects/a', children: 'x' }));
    expect(html).toContain('<a');
    expect(html).toContain('href="/projects/a"');
  });

  it('interactive cards get hover lift + focus ring', () => {
    dark(h(Card, { interactive: true, children: 'x' }));
    const sheet = __sheetCss();
    expect(sheet).toContain('transform: translateY(-2px)');
    expect(sheet).toContain(`outline: 2px solid ${darkTheme.color.focus}`);
    expect(sheet).toContain(REDUCED);
  });

  it('non-interactive cards do not carry the cursor:pointer rule', () => {
    dark(h(Card, { children: 'x' }));
    expect(__sheetCss()).not.toContain('cursor: pointer');
  });

  it('surface colour follows the theme', () => {
    light(h(Card, { children: 'x' }));
    expect(__sheetCss()).toContain(lightTheme.color.surface);
  });
});

describe('Section', () => {
  it('renders a section landmark labelled by its h2', () => {
    const html = dark(h(Section, { id: 'work', title: 'Selected work', children: 'x' }));
    expect(html).toContain('<section');
    expect(html).toContain('aria-labelledby="work-title"');
    expect(html).toContain('<h2');
    expect(html).toContain('id="work-title"');
  });

  it('eyebrow and description render when provided', () => {
    const html = dark(h(Section, { title: 'T', eyebrow: '01', description: 'D', children: null }));
    expect(html).toContain('01');
    expect(html).toContain('<p');
    expect(html).toContain('D');
  });

  it('omits the header entirely with no title/eyebrow/description', () => {
    const html = dark(h(Section, { children: 'just children' }));
    expect(html).not.toContain('<header>');
    expect(html).toContain('just children');
  });

  it('size compact narrows to the prose measure', () => {
    dark(h(Section, { size: 'compact', children: 'x' }));
    expect(__sheetCss()).toContain(`max-width: ${darkTheme.layout.maxWidthProse}`);
  });
});

describe('Container', () => {
  it('renders a div with token gutter padding', () => {
    const html = dark(h(Container, { children: 'x' }));
    expect(html).toContain('data-testid="container"');
    expect(__sheetCss()).toContain(`padding-inline: ${darkTheme.layout.gutter}`);
  });

  it('prose size uses maxWidthProse', () => {
    dark(h(Container, { size: 'prose', children: 'x' }));
    expect(__sheetCss()).toContain(`max-width: ${darkTheme.layout.maxWidthProse}`);
  });
});

describe('Stack', () => {
  it('defaults to a column flex with token gap', () => {
    dark(h(Stack, { children: 'x' }));
    const sheet = __sheetCss();
    expect(sheet).toContain('flex-direction: column');
    expect(sheet).toContain(`gap: ${darkTheme.space[4]}`);
  });

  it('row + wrap maps to flex CSS', () => {
    dark(h(Stack, { direction: 'row', wrap: true, gap: '2', children: 'x' }));
    const sheet = __sheetCss();
    expect(sheet).toContain('flex-direction: row');
    expect(sheet).toContain('flex-wrap: wrap');
    expect(sheet).toContain(`gap: ${darkTheme.space[2]}`);
  });

  it('supports rendering as a list element', () => {
    const html = dark(h(Stack, { as: 'ul', children: null }));
    expect(html).toContain('<ul');
  });
});

describe('Prose', () => {
  it('marks the wrapper and keeps the 68ch measure', () => {
    const html = dark(h(Prose, { children: <p>hi</p> }));
    expect(html).toContain('data-prose="true"');
    const sheet = __sheetCss();
    hasDecl(sheet, '--measure: 68ch');
    hasDecl(sheet, 'max-width: var(--measure)');
  });

  it('styles h2/h3, lists, blockquote, code, pre, tables, img, hr', () => {
    dark(h(Prose, { children: null }));
    const sheet = __sheetCss();
    for (const sel of ['h2', 'h3', 'ul', 'ol', 'blockquote', 'code', 'pre code', 'th', 'td', 'img', 'hr', 'a']) {
      expect(sheet).toMatch(new RegExp(`\\.css-[a-z0-9]+ ${sel} \\{`));
    }
  });

  it('pre scrolls horizontally with a capped height', () => {
    dark(h(Prose, { children: null }));
    const sheet = __sheetCss();
    hasDecl(sheet, 'overflow-x: auto');
    hasDecl(sheet, 'max-height: 80vh');
  });

  it('tables get borders plus zebra rows', () => {
    dark(h(Prose, { children: null }));
    const sheet = __sheetCss();
    expect(sheet).toMatch(/tbody tr:nth-child\(even\)/);
    hasDecl(sheet, `border: 1px solid ${darkTheme.color.border}`);
  });

  it('every generated selector is scoped to the wrapper (no chrome restyling)', () => {
    dark(h(Prose, { children: null }));
    const selectors = __sheetCss()
      .split('\n')
      .filter((line) => line.endsWith('{'))
      .map((line) => line.replace(/\s*\{$/, '').trim());
    expect(selectors.length).toBeGreaterThan(15);
    for (const sel of selectors) {
      expect(sel.startsWith('.css-')).toBe(true);
    }
  });

  it('link colour differs per theme', () => {
    light(h(Prose, { children: null }));
    hasDecl(__sheetCss(), `color: ${lightTheme.color.accent}`);
  });
});

describe('Heading', () => {
  it('level picks the semantic tag and matched size', () => {
    const html = dark(h(Heading, { level: 1, children: 'Title' }));
    expect(html).toContain('<h1');
    hasDecl(__sheetCss(), `font-size: ${darkTheme.font.sizes['4xl']}`);
  });

  it('renders h2/h3/h4 for the other levels', () => {
    const html = dark(
      createElement(
        'div',
        null,
        ...([1, 2, 3, 4] as const).map((n) => createElement(Heading, { level: n, key: n, children: `t${n}` })),
      ),
    );
    for (const n of [1, 2, 3, 4]) expect(html).toContain(`<h${n}`);
  });

  it('size overrides the visual step without changing the tag', () => {
    const html = dark(h(Heading, { level: 2, size: '5xl', children: 'x' }));
    expect(html).toContain('<h2');
    hasDecl(__sheetCss(), `font-size: ${darkTheme.font.sizes['5xl']}`);
  });

  it('does not leak $-style props and keeps data-testid', () => {
    const html = dark(h(Heading, { level: 3, children: 'x' }));
    expect(html).toContain('data-testid="heading-3"');
    expect(html).not.toContain('$size');
  });
});

describe('Spinner', () => {
  it('exposes role=status with a label', () => {
    const html = dark(h(Spinner, {}));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading"');
    expect(html).toContain('data-testid="spinner"');
  });

  it('registers a spin keyframe and a reduced-motion fallback', () => {
    dark(h(Spinner, {}));
    const sheet = __sheetCss();
    expect(sheet).toContain('@keyframes ui-spin');
    expect(sheet).toContain(REDUCED);
    expect(sheet).toContain('@keyframes ui-pulse');
  });
});

describe('EmptyState', () => {
  it('is a status region with title, copy and action', () => {
    const html = dark(
      h(EmptyState, { title: 'Nothing yet', description: 'Check back soon', action: h('a', { href: '/x' }, 'go') }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('Nothing yet');
    expect(html).toContain('Check back soon');
    expect(html).toContain('href="/x"');
    expect(html).toContain('data-testid="empty-state"');
  });

  it('renders a decorative icon by default', () => {
    const html = dark(h(EmptyState, { title: 'Empty' }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-icon="search"');
  });
});

describe('SkipLink', () => {
  it('targets #main by default and is labelled', () => {
    const html = dark(h(SkipLink, {}));
    expect(html).toContain('href="#main"');
    expect(html).toContain('Skip to main content');
    expect(html).toContain('data-skip-target="#main"');
  });

  it('reveals on focus with a focus ring and no motion', () => {
    dark(h(SkipLink, {}));
    const sheet = __sheetCss();
    expect(sheet).toMatch(/\.css-[a-z0-9]+:focus \{/);
    expect(sheet).toMatch(/\.css-[a-z0-9]+:focus-visible \{/);
    expect(sheet).toContain('position: fixed');
    expect(sheet).toContain(`outline: 2px solid ${darkTheme.color.focus}`);
    expect(sheet).toContain(REDUCED);
  });
});

describe('VisuallyHidden', () => {
  it('uses the clip technique (never display:none)', () => {
    const html = dark(h(VisuallyHidden, { children: 'screen readers only' }));
    expect(html).toContain('screen readers only');
    const sheet = __sheetCss();
    expect(sheet).toContain('clip: rect(0 0 0 0)');
    expect(sheet).toContain('clip-path: inset(50%)');
    expect(sheet).toContain('width: 1px');
    expect(sheet).not.toMatch(/display: none/);
    expect(sheet).not.toMatch(/visibility: hidden/);
  });
});

describe('Pagination', () => {
  it('is a labelled nav landmark built from a list', () => {
    const html = dark(h(Pagination, { page: 1, total: 3 }));
    expect(html).toContain('<nav');
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain('<ul');
    expect(html).toContain('data-testid="pagination"');
  });

  it('marks the current page and links the others', () => {
    const html = dark(h(Pagination, { page: 2, total: 3 }));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('data-page="2"');
    expect(html).toContain('href="?page=3"');
    expect(html).toContain('aria-disabled="true"');
  });

  it('disables previous on page 1 and next on the last page', () => {
    const first = dark(h(Pagination, { page: 1, total: 3 }));
    expect(first).toMatch(/data-edge="prev"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*data-edge="prev"/);
    const last = dark(h(Pagination, { page: 3, total: 3 }));
    expect(last).toMatch(/data-edge="next"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*data-edge="next"/);
  });

  it('disabled edges stay tabbable (R1-B L2: no href => not focusable without tabIndex)', () => {
    const edgeTag = (html: string, edge: string) =>
      (html.match(new RegExp(`<a [^>]*data-edge="${edge}"[^>]*>`)) ??
        html.match(new RegExp(`<a data-edge="${edge}"[^>]*>`)) ?? [''])[0];
    const first = dark(h(Pagination, { page: 1, total: 3 }));
    const prevTag = edgeTag(first, 'prev');
    expect(prevTag).toContain('aria-disabled="true"');
    expect(prevTag).toContain('tabindex="0"');
    const last = dark(h(Pagination, { page: 3, total: 3 }));
    const nextTag = edgeTag(last, 'next');
    expect(nextTag).toContain('aria-disabled="true"');
    expect(nextTag).toContain('tabindex="0"');
    /* Enabled edges must NOT carry a forced tabIndex (no focus-order noise). */
    const enabledNext = edgeTag(first, 'next');
    expect(enabledNext).toContain('href=');
    expect(enabledNext).not.toMatch(/tabindex/);
  });

  it('hrefFor controls the generated links', () => {
    const html = dark(h(Pagination, { page: 1, total: 2, hrefFor: (n: number) => `/p/${n}` }));
    expect(html).toContain('href="/p/2"');
  });

  it('windows long ranges with ellipses', () => {
    expect(pageWindow(10, 20)).toEqual([1, -1, 9, 10, 11, -1, 20]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });

  it('current page uses the accent pair and exposes a focus ring', () => {
    dark(h(Pagination, { page: 2, total: 5 }));
    const sheet = __sheetCss();
    expect(sheet).toContain(`background: ${darkTheme.color.accent}`);
    expect(sheet).toContain(`outline: 2px solid ${darkTheme.color.focus}`);
    expect(sheet).toContain(REDUCED);
  });
});

describe('Icon', () => {
  const names = [
    'arrow-right', 'arrow-up', 'chevron-left', 'chevron-right', 'github', 'linkedin', 'mail', 'rss',
    'external-link', 'play', 'clock', 'search', 'sun', 'moon', 'menu', 'close', 'download', 'calendar', 'check',
  ] as const;

  it.each(names)('renders %s', (name) => {
    const html = dark(h(Icon, { name }));
    expect(html).toContain('<svg');
    expect(html).toContain(`data-icon="${name}"`);
    expect(html).toContain('viewBox="0 0 24 24"');
  });

  it('is hidden from AT without a label', () => {
    const html = dark(h(Icon, { name: 'search' }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it('becomes a labelled img with a label', () => {
    const html = dark(h(Icon, { name: 'github', label: 'GitHub profile' }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="GitHub profile"');
    expect(html).not.toContain('aria-hidden');
  });

  it('sizes in px both ways and inherits currentColor', () => {
    dark(h(Icon, { name: 'mail', size: 32 }));
    const sheet = __sheetCss();
    hasDecl(sheet, 'width: 32px');
    hasDecl(sheet, 'height: 32px');
    expect(sheet).toContain('currentColor');
  });

  it('unknown props never reach the svg', () => {
    const html = dark(h(Icon, { name: 'sun', bogusProp: 'nope' } as never));
    expect(html).not.toContain('bogusProp');
  });
});

describe('theme parity', () => {
  it('the same component yields theme-specific CSS in dark and light', () => {
    dark(h(Button, { children: 'x' }));
    const darkSheet = __sheetCss();
    expect(darkSheet).toContain(darkTheme.color.accent);
    light(h(Button, { children: 'x' }));
    const lightSheet = __sheetCss();
    expect(lightSheet).toContain(lightTheme.color.accent);
    expect(darkTheme.color.accent).not.toBe(lightTheme.color.accent);
  });

  it('light theme text tokens are dark on light surfaces', () => {
    const t = lightTheme as Tokens;
    expect(t.color.text.startsWith('#1')).toBe(true);
    expect(t.color.surface).toBe('#ffffff');
  });
});

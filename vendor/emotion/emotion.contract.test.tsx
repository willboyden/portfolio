/**
 * Contract tests for the vendored Emotion layer.
 *
 * These pin the parity behaviours application code relies on. If a future
 * swap to the real @emotion packages breaks one of these, the test tells us
 * exactly which assumption changed.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Global, ThemeProvider, css, keyframes, useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { __sheetCss } from '@emotion-mini/core';
import { darkTheme } from 'app/theme/tokens';

const h = <P,>(component: React.ComponentType<P>, props: P) => createElement(component, props);

describe('vendored @emotion/react', () => {
  it('useTheme reads the nearest ThemeProvider', () => {
    const Probe = (): React.ReactNode => {
      const theme = useTheme();
      return createElement('span', null, theme.color.accent);
    };
    const html = renderToStaticMarkup(h(ThemeProvider, { theme: darkTheme, children: h(Probe, {}) }));
    expect(html).toContain(darkTheme.color.accent);
  });

  it('ThemeProvider supports function themes receiving the outer theme', () => {
    const Probe = (): React.ReactNode => createElement('span', null, useTheme().color.bg);
    const html = renderToStaticMarkup(
      h(ThemeProvider, {
        theme: darkTheme,
        children: h(ThemeProvider, { theme: (outer) => ({ ...outer, color: { ...outer.color, bg: '#000001' } } as never), children: h(Probe, {}) }),
      }),
    );
    expect(html).toContain('#000001');
  });

  it('useTheme throws a helpful error outside a provider', () => {
    const Probe = (): React.ReactNode => createElement('span', null, useTheme().color.bg);
    expect(() => renderToStaticMarkup(h(Probe, {}))).toThrow(/ThemeProvider/);
  });

  it('css() registers deterministic rules and returns a class name', () => {
    const Probe = (): React.ReactNode => {
      const className = css`
        color: red;
      `;
      return createElement('div', { className });
    };
    const html = renderToStaticMarkup(h(ThemeProvider, { theme: darkTheme, children: h(Probe, {}) }));
    const first = /css-([a-z0-9]+)/.exec(html)?.[1];
    expect(first).toBeTruthy();
    expect(__sheetCss()).toContain('color: red');
  });

  it('keyframes() registers an @keyframes rule and returns its name', () => {
    const name = keyframes`
      from { opacity: 0 }
      to { opacity: 1 }
    `;
    expect(name).toMatch(/^animation-/);
    const sheet = __sheetCss();
    expect(sheet).toContain(`@keyframes ${name}`);
    expect(sheet).toContain('opacity: 0');
  });

  it('<Global> emits unscoped rules', () => {
    const Page = (): React.ReactNode =>
      h(Global, { styles: { body: { margin: 0 }, 'h1, h2': { lineHeight: 1.2 } } } as never);
    renderToStaticMarkup(h(ThemeProvider, { theme: darkTheme, children: h(Page, {}) }));
    const sheet = __sheetCss();
    expect(sheet).toMatch(/body\s*{[^}]*margin:\s*0/);
    expect(sheet).toMatch(/h1,\s*h2\s*{[^}]*line-height:\s*1.2/);
  });
});

describe('vendored @emotion/styled', () => {
  it('supports template literals with theme functions', () => {
    const Card = styled.div`
      padding: ${(p) => p.theme.space[4]};
      background: ${(p) => p.theme.color.surface};
    `;
    const html = renderToStaticMarkup(h(ThemeProvider, { theme: darkTheme, children: h(Card, { children: 'x' }) }));
    const sheet = __sheetCss();
    expect(sheet).toContain('padding: 1rem');
    expect(sheet).toContain('background: #151a26');
    expect(html).toMatch(/class="css-[a-z0-9]+"/);
  });

  it('resolves nested selectors with &', () => {
    const Nav = styled.nav`
      & .link { color: green; }
      &:hover { color: blue; }
      &.active { color: red; }
    `;
    renderToStaticMarkup(h(ThemeProvider, { theme: darkTheme, children: h(Nav, {}) }));
    const sheet = __sheetCss();
    expect(sheet).toMatch(/\.css-\w+ \.link\s*{\s*color: green;/);
    expect(sheet).toMatch(/\.css-\w+:hover\s*{/);
    expect(sheet).toMatch(/\.css-\w+\.active\s*{/);
  });

  it('emits media queries using theme breakpoints', () => {
    const Box = styled.div`
      display: grid;
      @media (max-width: ${(p) => p.theme.breakpoint.md}) {
        display: block;
      }
    `;
    renderToStaticMarkup(h(ThemeProvider, { theme: darkTheme, children: h(Box, {}) }));
    const sheet = __sheetCss();
    expect(sheet).toContain('@media (max-width: 768px)');
    expect(sheet).toMatch(/@media \(max-width: 768px\)\s*{\s*\.css-\w+\s*{\s*display: block;/);
  });

  it('keeps styling-only props off the DOM ($transient convention)', () => {
    const Pill = styled.span<{ $active: boolean }>`
      color: ${(p) => (p.$active ? 'red' : 'gray')};
    `;
    const html = renderToStaticMarkup(
      h(ThemeProvider, { theme: darkTheme, children: h(Pill, { $active: true, children: 'tag' }) }),
    );
    expect(html).not.toContain('$active');
    expect(html).not.toContain('active=');
    expect(__sheetCss()).toContain('color: red');
  });

  it('filters unknown props from intrinsic elements but keeps data/aria', () => {
    const Item = styled.li`
      color: teal;
    `;
    const html = renderToStaticMarkup(
      h(ThemeProvider, {
        theme: darkTheme,
        children: h(Item, { 'data-testid': 'thing', 'aria-label': 'labeled', bogusProp: 'nope', children: 'i' }),
      }),
    );
    expect(html).toContain('data-testid="thing"');
    expect(html).toContain('aria-label="labeled"');
    expect(html).not.toContain('bogusProp');
  });

  it('merges the consumer className after its own styles', () => {
    const Base = styled.div`
      color: red;
    `;
    const html = renderToStaticMarkup(
      h(ThemeProvider, { theme: darkTheme, children: h(Base, { className: 'override', children: 'x' }) }),
    );
    const classes = /class="([^"]+)"/.exec(html)?.[1] ?? '';
    const [own, ...rest] = classes.split(' ');
    expect(own).toMatch(/^css-[a-z0-9]+$/);
    expect(rest).toEqual(['override']);
  });

  it('styles composed components receive the merged className', () => {
    const Inner = styled.span`
      color: red;
    `;
    const Outer = styled(Inner)`
      color: blue;
    `;
    renderToStaticMarkup(h(ThemeProvider, { theme: darkTheme, children: h(Outer, {}) }));
    /* Both rules registered; the outer one exists too. */
    const sheet = __sheetCss();
    expect(sheet).toContain('color: red');
    expect(sheet).toContain('color: blue');
  });

  it('renders polymorphic `as` while keeping styles', () => {
    const Linkish = styled.a`
      color: red;
    `;
    const html = renderToStaticMarkup(
      h(ThemeProvider, {
        theme: darkTheme,
        children: h(Linkish, { as: 'button', type: 'submit', children: 'go' }),
      }),
    );
    expect(html).toContain('<button');
    expect(html).toContain('type="submit"');
  });

  it('dynamic props produce distinct deterministic class names', () => {
    const Flag = styled.span<{ $tone: 'a' | 'b' }>`
      color: ${(p) => (p.$tone === 'a' ? 'red' : 'green')};
    `;
    renderToStaticMarkup(
      h(ThemeProvider, {
        theme: darkTheme,
        children: createElement('div', null, h(Flag, { $tone: 'a' }), h(Flag, { $tone: 'b' })),
      }),
    );
    const sheet = __sheetCss();
    expect(sheet).toContain('color: red');
    expect(sheet).toContain('color: green');
  });
});

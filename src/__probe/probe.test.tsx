import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactNode } from 'react';
import { ThemeProvider } from '@emotion/react';
import styled from '@emotion/styled';
import { __sheetCss } from '@emotion-mini/core';
import { darkTheme, type Tokens } from 'app/theme/tokens';

const wrap = (n: ReactNode) => createElement(ThemeProvider, { theme: darkTheme, children: n });
type Variant = 'primary' | 'ghost';

/* A: template literal with $ transients — the house style */
const A = styled.button<{ $v: Variant; $big: boolean }>`
  padding: ${(p) => (p.$big ? p.theme.space[3] : p.theme.space[1])} ${(p) => p.theme.space[4]};
  background: ${(p) => (p.$v === 'primary' ? p.theme.color.accent : 'transparent')};
  ${(p) => p.$v === 'primary' && `color: ${p.theme.color.bg};`}
  ${(p) => p.$v === 'ghost' && `color: ${p.theme.color.accent};`}
  &:focus-visible { outline: 2px solid ${(p) => p.theme.color.focus}; }
  @media (prefers-reduced-motion: reduce) { transition: none; }
`;

/* B: object builder with inferred type, used via css() for component targets */
function boxObj(t: Tokens, v: Variant) {
  return {
    padding: t.space[3],
    background: v === 'primary' ? t.color.accent : 'transparent',
    color: v === 'primary' ? t.color.bg : t.color.accent,
    '&:focus-visible': { outline: `2px solid ${t.color.focus}` },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  };
}

describe('probe5', () => {
  it('A template with transients', () => {
    renderToStaticMarkup(wrap(createElement(A, { $v: 'primary', $big: true, children: 'x' })));
    const s = __sheetCss();
    console.log('A>>>', s);
    expect(s).toContain(`outline: 2px solid ${darkTheme.color.focus}`);
    expect(s).toContain(`color: ${darkTheme.color.bg}`);
  });
  it('B object builder via css() typechecks and emits', () => {
    const B = styled.div((p) => boxObj(p.theme as Tokens, 'ghost'));
    renderToStaticMarkup(wrap(createElement(B, { children: 'x' })));
    console.log('B>>>', __sheetCss());
    expect(__sheetCss()).toContain('outline:2px');
  });
});

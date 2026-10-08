import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ThemeProvider } from '@emotion/react';
import styled from '@emotion/styled';
import { darkTheme } from 'app/theme/tokens';

const wrap = (node) => createElement(ThemeProvider, { theme: darkTheme, children: node });

describe('false / undefined interpolation behaviour', () => {
  it('false as the whole value', () => {
    const C = styled.div<{ $on?: boolean }>`
      color: ${(p) => (p.$on ? 'red' : false)};
    `;
    try {
      renderToStaticMarkup(wrap(createElement(C, {})));
      console.log('FALSE-AS-VALUE: rendered OK');
    } catch (error) {
      console.log('FALSE-AS-VALUE THREW:', String(error).slice(0, 110));
    }
  });

  it('false inside a multi-value declaration', () => {
    const C = styled.div<{ $on?: boolean }>`
      margin: 0 ${(p) => (p.$on ? '2rem' : false)} auto;
    `;
    try {
      renderToStaticMarkup(wrap(createElement(C, {})));
      console.log('FALSE-MULTI: rendered OK');
    } catch (error) {
      console.log('FALSE-MULTI THREW:', String(error).slice(0, 110));
    }
  });

  it('whole-declaration conditional object form', () => {
    const C = styled.div<{ $on?: boolean }>`
      ${(p) => (p.$on ? { color: 'red' } : false)};
    `;
    try {
      renderToStaticMarkup(wrap(createElement(C, {})));
      console.log('OBJECT-COND: rendered OK');
    } catch (error) {
      console.log('OBJECT-COND THREW:', String(error).slice(0, 110));
    }
  });

  it('whole-declaration conditional template form (emotion idiom)', () => {
    const C = styled.div<{ $on?: boolean }>`
      ${(p) => p.$on && 'color: red;'}
    `;
    try {
      renderToStaticMarkup(wrap(createElement(C, {})));
      console.log('TEMPLATE-COND: rendered OK');
    } catch (error) {
      console.log('TEMPLATE-COND THREW:', String(error).slice(0, 110));
    }
  });
});

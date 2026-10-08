import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ThemeProvider } from '@emotion/react';
import { darkTheme } from 'app/theme/tokens';
import { Heading } from 'app/components/ui/Heading';

describe('dbg2', () => {
  it('variants', () => {
    const A = renderToStaticMarkup(createElement(ThemeProvider, { theme: darkTheme, children:
      createElement('div', null, [1,2,3,4].map((n) => createElement(Heading, { level: n as 1, key: n, children: `t${n}` }))) }));
    console.log('A>>>', A.slice(0,120));
    const B = renderToStaticMarkup(createElement(ThemeProvider, { theme: darkTheme, children:
      createElement('div', null, ...[1,2,3].map((n) => createElement(Heading, { level: n as 1, key: n, children: `t${n}` }))) }));
    console.log('B>>>', B.slice(0,120));
    const C = renderToStaticMarkup(createElement(ThemeProvider, { theme: darkTheme, children:
      createElement('div', null, [1,2,3].map((n) => createElement('p', { key: n }, `p${n}`))) }));
    console.log('C>>>', C.slice(0,120));
    expect(1).toBe(1);
  });
});

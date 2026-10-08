/* Scratch SSR renders for unaudited markup (pattern copied from layout.test.tsx). */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from '@emotion/react';
import { RouterProvider } from '@portfolio/router';
import { darkTheme } from 'app/theme/tokens';
import { Pagination } from 'app/components/ui/Pagination';
import { EmptyState } from 'app/components/ui/EmptyState';
import { Spinner } from 'app/components/ui/Spinner';
import { Icon } from 'app/components/ui/Icon';
import { Header } from 'app/components/layout/Header';
import { Layout } from 'app/components/layout/Layout';

const routes = [{ path: '*', component: () => null }];
const r = (ui) =>
  renderToStaticMarkup(
    createElement(
      ThemeProvider,
      { theme: darkTheme },
      createElement(RouterProvider, { routes }, ui),
    ),
  );

console.log('=== Pagination page 3/20 ===');
console.log(r(createElement(Pagination, { page: 3, total: 20 })));
console.log('\n=== Pagination page 1/5 ===');
console.log(r(createElement(Pagination, { page: 1, total: 5 })));
console.log('\n=== EmptyState ===');
console.log(r(createElement(EmptyState, { title: 'Nothing found', description: 'Try another filter.' })));
console.log('\n=== Spinner ===');
console.log(r(createElement(Spinner, {})));
console.log('\n=== Icon labelled ===');
console.log(r(createElement(Icon, { name: 'github', label: 'GitHub repository' })));
console.log('\n=== Header open — h2 in dialog ===');
const html = r(createElement(Header, { menuOpen: true }));
console.log((html.match(/<h2[^>]*>[^<]*<\/h2>/g) || []).join('\n'));
console.log('dialog nav present:', html.includes('aria-label="Mobile"'));
console.log(
  'menu button sr text:',
  /data-testid="menu-button"[\s\S]*?<span[^>]*>([^<]+)<\/span>/.exec(html)?.[1],
);
const layout = r(createElement(Layout, {}));
console.log('layout skip link tag:', /<a[^>]*data-testid="skip-link"[^>]*>/.exec(layout)?.[0]?.slice(0, 120));

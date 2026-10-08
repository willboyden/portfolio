import { createRoot } from 'react-dom/client';
import { createApp } from './app/App';

const container = document.getElementById('root');
if (!container) throw new Error('missing #root mount element');

/*
 * We intentionally render (not hydrate): the prerendered HTML exists for SEO,
 * social cards, and no-JS readers; the client owns the live theme from
 * localStorage, and hydrating server markup that assumed the default theme
 * would warn on every light-mode visitor. A replace-render keeps one code
 * path and costs one paint.
 */
createRoot(container).render(createApp());

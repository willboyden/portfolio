import { createRoot } from 'react-dom/client';
import { adoptPrerenderedStyleSheet } from '@emotion/react';
import { createApp } from './app/App';

const container = document.getElementById('root');
if (!container) throw new Error('missing #root mount element');

/* R1A-10: adopt the prerendered critical CSS <style> as the live sheet before
 * React renders — otherwise the client mints a second tag and the DOM carries
 * the full stylesheet twice. */
adoptPrerenderedStyleSheet();

/*
 * We intentionally render (not hydrate): the prerendered HTML exists for SEO,
 * social cards, and no-JS readers; the client owns the live theme from
 * localStorage, and hydrating server markup that assumed the default theme
 * would warn on every light-mode visitor. A replace-render keeps one code
 * path and costs one paint.
 */
createRoot(container).render(createApp());

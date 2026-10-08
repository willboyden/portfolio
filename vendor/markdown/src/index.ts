/**
 * vendor/markdown — dependency-free CommonMark-subset renderer + frontmatter
 * parser for the portfolio content pipeline (CONTRACT.md §4, owner:
 * markdown-engine).
 *
 * SECURITY SUMMARY (required reading for anyone embedding the output):
 * The renderer treats markdown source as UNTRUSTED. Every raw text character
 * is HTML-escaped (& < > ") before generated tags are inserted, raw HTML in
 * the source is escaped rather than passed through, and link/image
 * destinations are restricted by `sanitizeUrl` to http/https/mailto/relative
 * URLs. The output is safe to inject into the page with dangerouslySetInnerHTML
 * for pre-rendered content because it contains no markup that did not
 * originate from this module.
 */

import { renderBody, plainText } from './blocks.ts';
import { renderInline } from './inline.ts';
import { parseFrontmatter } from './frontmatter.ts';

export { parseFrontmatter } from './frontmatter.ts';
export { plainText };

/**
 * GitHub-style heading slug: lowercase, strip punctuation, whitespace runs →
 * single hyphens, trimmed. Used per-document with collision suffixes (-1,
 * -2, …) — see renderMarkdown.
 */
export function deriveHeadingId(text: string): string {
  return plainText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** ~200 words per minute, minimum 1; fenced code blocks are excluded. */
export function readingMinutes(text: string): number {
  const withoutCode = text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^(\1)[ \t]*$/gm, '');
  const words = withoutCode
    .split(/(?=\S)[^\s]*(?<=\S)/g)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Render a CommonMark-subset markdown document to an HTML string.
 * Heading ids are deduplicated within the document (test → test, test-1, …).
 */
export function renderMarkdown(src: string): string {
  const seen = new Map<string, number>();
  const headingId = (text: string): string => {
    const base = deriveHeadingId(text) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
  return renderBody(src, headingId);
}

/** Inline-only helper (exported for the content pipeline's excerpt logic). */
export function renderInlineOnly(src: string): string {
  return renderInline(src);
}

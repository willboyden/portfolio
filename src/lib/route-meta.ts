/**
 * Route metadata — the single source of truth for per-route <title> /
 * description / og:image, shared between prerender (build time) and the
 * client (SPA navigation, R2C-3).
 *
 * Keeping it here (rather than inside prerender/entry.ts) means an SPA
 * navigation updates the head with EXACTLY the values the prerendered page
 * shipped — DOM and prerender can never drift.
 */
import { content } from 'app/content';
import { SITE, pageMeta, type MetaResult } from './seo';

/* Site-wide fallback description (SITE is a static const). */
const SITE_FALLBACK_DESCRIPTION: string = SITE.description;

export function titleFor(path: string): string {
  /* R2C-2/R2-A A10: buildHead's capTitle owns the single " — William Boyden"
   * brand suffix. titleFor returns the BARE page part — any prior suffix here
   * double-branded and forced mid-word ellipsis. Home returns '' so capTitle
   * emits SITE.title as-is. */
  if (path === '/') return '';
  if (path === '/404') return 'Page not found';
  const seg = path.split('/')[1];
  const pageNames: Record<string, string> = {
    about: 'About',
    now: 'Now',
    projects: 'Projects',
    writing: 'Writing',
    videos: 'Videos',
    talks: 'Talks',
    contact: 'Contact',
  };
  if (seg === 'projects') {
    const slug = path.split('/')[2];
    /* R6-E: an unknown slug must keep the honest "Page not found" title the
     * prerendered 404 shipped — the old fallback retitled the tab to
     * "Project — Projects" after hydration while the page said 404. */
    if (slug) {
      const project = content.projects.find((p) => p.slug === slug);
      return project ? `${project.title} — Projects` : 'Page not found';
    }
    return 'Projects';
  }
  if (seg === 'writing') {
    const slug = path.split('/')[2];
    if (slug) {
      const post = content.posts.find((p) => p.slug === slug);
      return post ? `${post.title} — Writing` : 'Page not found';
    }
    return 'Writing';
  }
  return seg ? (pageNames[seg] ?? '') : '';
}

export function descriptionFor(path: string): string {
  if (path.startsWith('/projects/')) {
    const slug = path.split('/')[2];
    return content.projects.find((p) => p.slug === slug)?.summary ?? SITE_FALLBACK_DESCRIPTION;
  }
  if (path.startsWith('/writing/')) {
    const slug = path.split('/')[2];
    const post = content.posts.find((p) => p.slug === slug);
    return post?.excerpt || post?.summary || SITE_FALLBACK_DESCRIPTION;
  }
  return SITE_FALLBACK_DESCRIPTION;
}

/* R2C-8: section cards get their own generated OG art (files ship in
 * public/og/; only ones that exist are referenced). */
const SECTION_OG: Record<string, string> = {
  projects: '/og/projects.png',
  writing: '/og/writing.png',
};
export function ogImageFor(path: string): string | undefined {
  const seg = path.split('/')[1];
  return seg && SECTION_OG[seg] ? SECTION_OG[seg] : undefined;
}

export function publishedFor(path: string): { publishedTime?: string; type: 'article' } | Record<string, never> {
  const slug = path.split('/')[2];
  const post = content.posts.find((p) => p.slug === slug);
  return post ? { publishedTime: post.date, type: 'article' as const } : {};
}

/** Full MetaResult for a route — identical at build time and in the browser. */
export function metaFor(path: string): MetaResult {
  return pageMeta({
    title: titleFor(path),
    description: descriptionFor(path),
    path,
    ...(ogImageFor(path) ? { image: ogImageFor(path) } : {}),
    /* R2C-4: the 404 exists only as nginx's error page — keep it out of indexes. */
    ...(path === '/404' ? { robots: ['noindex', 'nofollow'] as const } : {}),
    ...(path.startsWith('/writing/') ? publishedFor(path) : {}),
  });
}

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
    'ai-engineering': 'AI Engineering',
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
  /* R9A-2: section pages shipped the site-wide boilerplate description — an
   * agent summarizing /writing or /ai-engineering got the same paragraph for
   * every section. Real, honest per-section descriptions. */
  const sectionDescriptions: Record<string, string> = {
    '/projects':
      'Case studies of shipped systems — monitoring fleets, data platforms, eval harnesses — with the reasoning, the stack, and the numbers that judged them.',
    '/writing':
      'Engineering notes on LLM systems, data platforms and evals — written for the teammate who inherits the system.',
    '/ai-engineering':
      'Capability briefs with proof and metrics: local inference, smart routing, data analytics, video generation.',
    '/about': 'Who William Boyden is, how he works, and the stack he ships with.',
    '/now': 'What William Boyden is working on this quarter — current focus, availability, and what changes when it changes.',
    '/contact': 'How to reach William Boyden, what working together looks like, and what to put in a first email.',
  };
  return sectionDescriptions[path] ?? SITE_FALLBACK_DESCRIPTION;
}

/* R2C-8: section cards get their own generated OG art (files ship in
 * public/og/; only ones that exist are referenced). R8D-4: ai-engineering
 * joined (its pages fell back to the generic card despite being the newest,
 * most-shared section). */
const SECTION_OG: Record<string, string> = {
  projects: '/og/projects.png',
  writing: '/og/writing.png',
  'ai-engineering': '/og/ai-engineering.png',
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
  const post = path.startsWith('/writing/')
    ? content.posts.find((p) => p.slug === path.split('/')[2])
    : undefined;
  /* R9A-1: the home Person node's knowsAbout comes from the site's own tag
   * corpus (top tags by real usage), not a hardcoded skills list. */
  const knowsAbout = path === '/' ? allTagsByUse().slice(0, 8).map((t) => t.tag) : undefined;
  /* R9A-3: /now's freshness is machine-readable — the newest shipped content
   * date (the same value the page's "Last updated" stamp renders). */
  const dateModified =
    path === '/now'
      ? [...content.projects, ...content.posts].map((i) => i.date).sort().at(-1)
      : undefined;
  return pageMeta({
    title: titleFor(path),
    description: descriptionFor(path),
    path,
    ...(ogImageFor(path) ? { image: ogImageFor(path) } : {}),
    /* R2C-4: the 404 exists only as nginx's error page — keep it out of indexes. */
    ...(path === '/404' ? { robots: ['noindex', 'nofollow'] as const } : {}),
    ...(post ? { publishedTime: post.date, type: 'article' as const, keywords: post.tags } : {}),
    ...(path === '/contact' ? { jsonLdKind: 'contact' as const } : {}),
    ...(knowsAbout ? { knowsAbout } : {}),
    ...(dateModified ? { dateModified } : {}),
  });
}

/* R9A-1: top tags across the whole corpus (projects + posts). Local copy of
 * content.allTags() ordering to keep this module's imports one-directional
 * (content is already imported above — this just reuses it). */
function allTagsByUse(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of [...content.projects, ...content.posts]) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * SEO / document-head primitives — one source of truth for the prerenderer AND
 * the runtime (document.title + meta sync).
 *
 * Pinned CONTRACT §4 API:
 *   pageMeta(opts) → MetaResult
 *   buildHead(meta) → string[]        // ordered tag markup
 *
 * Honesty rules baked in:
 * - Titles are capped at 60 chars (Google's visual cut); we shorten the page
 *   part before dropping words, and the <title> text is HTML-escaped.
 * - Descriptions are capped at 160 chars and only get `…` when characters
 *   were actually removed (truncateAtWordBoundary never mid-cuts a word
 *   unless a single word overflows).
 * - Every URL goes through joinUrl(), so a SITE.url with a trailing slash or
 *   a path without a leading one can never produce `//`.
 * - JSON-LD is returned as a plain object; JSON.stringify happens in
 *   buildHead with `<` escaped so the output is safe inside <script> and
 *   still valid JSON after unescaping. Tests JSON.parse it back.
 */

import { truncateAtWordBoundary } from './format';

/* -------------------------------------------------------------------------- */
/* Site constants                                                             */
/* -------------------------------------------------------------------------- */

export const SITE = {
  name: 'Alex Rivera',
  url: 'https://alexrivera.dev',
  title: 'Alex Rivera — AI Engineering & Technical Consulting',
  /** Short name for OG cards / manifest (R1-C #10: was referenced before it existed). */
  shortTitle: 'Alex Rivera',
  /** Tagline appended to the home <title> only. */
  tagline: 'Technical Consulting',
  description:
    'Portfolio of Alex Rivera, technical consultant and AI engineer: LLM systems, data platforms, full-stack builds, writing and talks.',
  author: 'Alex Rivera',
  /** DRAFT: replace with the real X handle before launch (no @ prefix here). */
  twitter: 'alexriveradev' /* <!-- DRAFT --> placeholder handle, unverified */,
  lang: 'en',
  rssPath: '/rss.xml',
  defaultImagePath: '/og-default.png',
} as const;

export type MetaType = 'website' | 'article';
export type RobotsDirective = 'index' | 'noindex' | 'follow' | 'nofollow';

export interface PageMetaOptions {
  title: string;
  description: string;
  /** Route path (`/`, `/writing/my-post`) or absolute URL. */
  path: string;
  image?: string;
  type?: MetaType;
  /** ISO date the page's content was first published (Article schema). */
  publishedTime?: string;
  /** OG type for indexes/collections (defaults to og:type). */
  ogType?: string;
  /** Structured-data shape; defaults: Person (home) / Article (article) / CollectionPage (indexes). */
  jsonLdKind?: 'person' | 'article' | 'collection';
  /** Default: index,follow. Use noindex for drafts/404. */
  robots?: readonly RobotsDirective[];
}

export interface JsonLdObject {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

export interface MetaResult {
  /** Escaped, suffix-joined, 60-char-capped <title> text. */
  title: string;
  /** Raw (unescaped) title — for React text nodes / document.title. */
  titlePlain: string;
  /** 160-char-capped plain description. */
  description: string;
  /** Absolute canonical URL, double-slash-free. */
  canonical: string;
  /** Path as passed (normalised to a leading slash, no trailing slash except root). */
  path: string;
  /** Absolute OG image URL. */
  image: string;
  type: MetaType;
  ogType: string;
  publishedTime?: string;
  robots: string;
  lang: string;
  twitterCard: 'summary_large_image' | 'summary';
  jsonLd: JsonLdObject;
  rssUrl: string;
}

/* -------------------------------------------------------------------------- */
/* Small helpers (exported for reuse + tests)                                 */
/* -------------------------------------------------------------------------- */

/** Escape a string for interpolation into HTML text or a double-quoted attribute. */
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Join a base URL and path segments without ever emitting `//` (scheme aside). */
export function joinUrl(base: string, ...segments: string[]): string {
  const baseTrim = base.replace(/\/+$/, '');
  const tail = segments
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter((s) => s.length > 0)
    .join('/');
  return tail.length === 0 ? `${baseTrim}/` : `${baseTrim}/${tail}`;
}

/** Absolute URL for a route path; paths that are already absolute pass through. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return joinUrl(SITE.url, path);
}

function normalizePath(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      /* keep as-is; joinUrl will sanitize */
    }
  }
  let p = path.replace(/\/{2,}/g, '/');
  if (!p.startsWith('/')) p = `/${p}`;
  /* canonical convention: no trailing slash, except the root itself. */
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/** Cap a page title so `page — SITE.name` fits 60 chars total. */
function capTitle(rawTitle: string, cap = 60): string {
  const suffix = ` — ${SITE.name}`;
  const title = rawTitle.trim();
  const full = title.length > 0 ? `${title}${suffix}` : SITE.title;
  if (full.length <= cap) return full;
  if (title.length === 0) return truncateAtWordBoundary(SITE.title, cap);
  /* Shorten the page part, never the brand; ellipsis signals the cut. */
  const budget = cap - suffix.length;
  if (budget < 10) return `${truncateAtWordBoundary(title, cap)}…`;
  return `${truncateAtWordBoundary(title, budget)}${suffix}`;
}

function buildJsonLd(opts: PageMetaOptions, kind: 'person' | 'article' | 'collection', canonical: string): JsonLdObject {
  if (kind === 'person') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: SITE.author,
      url: SITE.url,
      description: opts.description.trim() || SITE.description,
      jobTitle: 'AI Engineer & Technical Consultant',
      knowsAbout: ['LLM systems', 'data platforms', 'full-stack engineering'],
    };
  }
  if (kind === 'article') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: opts.title.trim(),
      description: opts.description.trim(),
      inLanguage: SITE.lang,
      author: { '@type': 'Person', name: SITE.author },
      publisher: { '@type': 'Person', name: SITE.author },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      ...(opts.publishedTime ? { datePublished: opts.publishedTime } : {}),
    };
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.title.trim(),
    description: opts.description.trim(),
    url: canonical,
    inLanguage: SITE.lang,
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
  };
}

/* -------------------------------------------------------------------------- */
/* pageMeta                                                                    */
/* -------------------------------------------------------------------------- */

/** Build the complete meta bundle for one route. Pure — no window access. */
export function pageMeta(opts: PageMetaOptions): MetaResult {
  const path = normalizePath(opts.path);
  const canonical = absoluteUrl(path);
  const isHome = path === '/';
  const type: MetaType = opts.type ?? (opts.publishedTime ? 'article' : 'website');
  const ogType =
    opts.ogType ?? (type === 'article' ? 'article' : isHome ? 'website' : 'website');

  const titlePlain = capTitle(opts.title);
  const descriptionRaw = opts.description.trim() || SITE.description;
  const description =
    descriptionRaw.length > 160
      ? truncateAtWordBoundary(descriptionRaw, 159) /* keeps room for the ellipsis */
      : descriptionRaw;

  const kind = opts.jsonLdKind ?? (isHome ? 'person' : type === 'article' ? 'article' : 'collection');

  return {
    title: escapeHtml(titlePlain),
    titlePlain,
    description,
    canonical,
    path,
    image: absoluteUrl(opts.image ?? SITE.defaultImagePath),
    type,
    ogType,
    ...(opts.publishedTime ? { publishedTime: opts.publishedTime } : {}),
    robots: (opts.robots ?? ['index', 'follow']).join(','),
    lang: SITE.lang,
    twitterCard: opts.image ? 'summary_large_image' : 'summary',
    jsonLd: buildJsonLd({ ...opts, description }, kind, canonical),
    rssUrl: absoluteUrl(SITE.rssPath),
  };
}

/* -------------------------------------------------------------------------- */
/* buildHead                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ordered markup tags for the document <head>. Order is pinned (tests assert
 * it): title → meta charset-free essentials → description → canonical → RSS →
 * robots → OG block → Twitter block → JSON-LD.
 *
 * The prerenderer joins these into index.html; the runtime uses `titlePlain`
 * (see applyDocumentMeta) so DOM and prerender never disagree.
 */
export function buildHead(meta: MetaResult): string[] {
  const tags: string[] = [];
  tags.push(`<title>${meta.title}</title>`);
  tags.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
  tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`);
  tags.push(
    `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(`${SITE.name} RSS`)}" href="${escapeHtml(meta.rssUrl)}">`,
  );
  tags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}">`);

  /* OpenGraph */
  tags.push(`<meta property="og:site_name" content="${escapeHtml(SITE.name)}">`);
  tags.push(`<meta property="og:type" content="${escapeHtml(meta.ogType)}">`);
  tags.push(`<meta property="og:title" content="${escapeHtml(meta.titlePlain)}">`);
  tags.push(`<meta property="og:description" content="${escapeHtml(meta.description)}">`);
  tags.push(`<meta property="og:url" content="${escapeHtml(meta.canonical)}">`);
  tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}">`);
  tags.push(`<meta property="og:locale" content="${escapeHtml(meta.lang)}">`);
  if (meta.publishedTime) {
    tags.push(`<meta property="article:published_time" content="${escapeHtml(meta.publishedTime)}">`);
  }

  /* Twitter */
  tags.push(`<meta name="twitter:card" content="${escapeHtml(meta.twitterCard)}">`);
  tags.push(`<meta name="twitter:site" content="@${escapeHtml(SITE.twitter)}">`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(meta.titlePlain)}">`);
  tags.push(`<meta name="twitter:description" content="${escapeHtml(meta.description)}">`);
  tags.push(`<meta name="twitter:image" content="${escapeHtml(meta.image)}">`);

  /* JSON-LD: `<` escaped to \u003c so a `</script>` inside data can't break
   * out of the tag; the result is still strict JSON (JSON.parse handles it). */
  const ld = JSON.stringify(meta.jsonLd)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  tags.push(`<script type="application/ld+json">${ld}</script>`);

  return tags;
}

/**
 * Runtime counterpart (client only): set document.title + description +
 * canonical on route change. Guarded so importing this module in Node never
 * touches document.
 */
export function applyDocumentMeta(meta: MetaResult): void {
  if (typeof document === 'undefined') return;
  try {
    document.title = meta.titlePlain;
    const set = (selector: string, create: () => HTMLElement, attrName: string, value: string): void => {
      let el = document.head.querySelector<HTMLElement>(selector);
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      el.setAttribute(attrName, value);
    };
    set('meta[name="description"]', () => document.createElement('meta'), 'content', meta.description);
    set('link[rel="canonical"]', () => document.createElement('link'), 'href', meta.canonical);
  } catch {
    /* never break navigation over a meta sync failure */
  }
}

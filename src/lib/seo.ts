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
  name: 'William Boyden',
  /* R8D-1: overridable at build time (vite `define` bakes import.meta.env.
   * SITE_URL from the env — CI sets it to the real Pages origin). The
   * placeholder domain is the owner's deliberate fallback until a real
   * domain exists; CI builds therefore never ship it in head tags. The
   * trailing-slash strip makes joinUrl templates and raw `${SITE.url}/…`
   * compositions agree (CI's env value carries a trailing slash). */
  url: (import.meta.env.SITE_URL || 'https://alexrivera.dev').replace(/\/+$/, ''),
  title: 'William Boyden — AI Engineering & Technical Consulting',
  /** Short name for OG cards / manifest (R1-C #10: was referenced before it existed). */
  shortTitle: 'William Boyden',
  /** Tagline appended to the home <title> only. */
  tagline: 'Technical Consulting',
  description:
    'Portfolio of William Boyden, technical consultant and AI engineer: LLM systems, data platforms, full-stack builds, writing and talks.',
  author: 'William Boyden',
  /**
   * R2-A A3: hire-me metadata a recruiter looks for in 20 seconds. UNSET =
   * hidden (never fabricated). Owner: set these before launching the job push —
   *   hiring: one line, e.g. "Seeking senior AI-platform / full-stack roles —
   *           remote (UTC-5 ±3) — available from Nov 2026"
   *   email:  the mailbox that receives engagements and recruiter mail
   *   resume: path to a PDF in public/ (e.g. '/william-boyden-resume.pdf')
   */
  hiring: null as string | null,
  email: null as string | null,
  resume: null as string | null,
  /**
   * X handle WITHOUT the @ prefix. Null until the owner confirms the real
   * handle — R4-C F3: a placeholder shipped as twitter:site on every page
   * violated the hide-don't-fabricate rule (the Footer hides unset handles;
   * this was the missed sibling sink of R2-A A3). When set, twitter:site is
   * emitted; unset means no tag at all.
   * <!-- DRAFT-REVIEW(owner): set to the real handle before launch -->
   */
  twitter: null as string | null,
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
  jsonLdKind?: 'person' | 'article' | 'collection' | 'contact';
  /** Default: index,follow. Use noindex for drafts/404. */
  robots?: readonly RobotsDirective[];
  /** R9A-5: topic keywords (post tags) — Article JSON-LD `keywords`. */
  keywords?: readonly string[];
  /** R9A-3: CollectionPage `dateModified` (ISO) — machine-readable freshness. */
  dateModified?: string;
  /** R9A-1: Person `knowsAbout` — route-meta derives real tags from content. */
  knowsAbout?: readonly string[];
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

/**
 * R7A-3: prepend the Vite build base to a root-absolute path.
 *
 * `import.meta.env.BASE_URL` is statically replaced at build time by the
 * `--base` flag (deploy-pages.yml rebuilds with `--base="/portfolio/"` for
 * GitHub Pages project sites). With base `/` the path passes through
 * unchanged, so local/nginx-root builds are untouched.
 */
export function withBase(path: string): string {
  return import.meta.env.BASE_URL.replace(/\/$/, '') + path;
}

/** Root-absolute src/href values inside build-rendered markdown ("/posts/x.svg",
 * "/writing/y") get the deploy base too — the markdown pipeline cannot know it,
 * and without it every in-body image and link 404s under /portfolio/. */
export function rebaseHtml(html: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base ? html.replace(/\b(src|href)="\/(?!\/)/g, `$1="${base}/`) : html;
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

/** R9A-2: JSON-LD headline/name must be the BARE entity name — titleFor
 * composes " — Projects"-style segments for tab titles, and leaking that
 * chrome into schema.org fields makes machines quote "My Post — Writing" as
 * the work's name. */
function entityName(rawTitle: string): string {
  return rawTitle.replace(/ — (Projects|Writing|AI Engineering|Videos|Talks|About|Now|Contact)$/, '').trim();
}

function buildJsonLd(opts: PageMetaOptions, kind: 'person' | 'article' | 'collection' | 'contact', canonical: string): JsonLdObject {
  /* R9A-1: every non-home page binds the Person entity so agents can answer
   * "who made this?" from ANY deep link, not just the homepage. */
  const personRef = {
    '@type': 'Person',
    '@id': `${SITE.url}/#person`,
    name: SITE.author,
    url: SITE.url,
  };
  if (kind === 'person') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': `${SITE.url}/#person`,
      name: SITE.author,
      url: SITE.url,
      description: opts.description.trim() || SITE.description,
      jobTitle: 'AI Engineer & Technical Consultant',
      knowsAbout: opts.knowsAbout ?? ['LLM systems', 'data platforms', 'full-stack engineering'],
    };
  }
  if (kind === 'article') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: entityName(opts.title),
      description: opts.description.trim(),
      inLanguage: SITE.lang,
      author: personRef,
      publisher: { '@type': 'Person', name: SITE.author },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      /* R2C-8: Google's Article rich results expect an image. */
      image: absoluteUrl(opts.image ?? SITE.defaultImagePath),
      /* R9A-5: frontmatter tags are machine-visible topic keywords. */
      ...(opts.keywords && opts.keywords.length > 0 ? { keywords: [...opts.keywords] } : {}),
      ...(opts.publishedTime ? { datePublished: opts.publishedTime } : {}),
    };
  }
  if (kind === 'contact') {
    /* R9A-7: /contact shipped a generic CollectionPage — an agent could not
     * bind "how do I reach this person" to a structured type. contactPoint
     * appears only when SITE.email is set (hide-don't-fabricate). */
    return {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: entityName(opts.title),
      description: opts.description.trim(),
      url: canonical,
      inLanguage: SITE.lang,
      isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
      about: personRef,
    };
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: entityName(opts.title),
    description: opts.description.trim(),
    url: canonical,
    inLanguage: SITE.lang,
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
    about: personRef,
    /* R9A-3: machine-readable freshness for living pages (/now). */
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
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
    /* R2C-10: og:locale wants a territory-qualified tag (en_US), not the
     * BCP-47 page lang ("en"). Single locale until the site localizes. */
    lang: 'en_US',
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
  /* R8D-5: dimensions so fetchers don't download to measure; alt because the
   * card is content. All site OG art is 1200x630 (gen_media.py contract). */
  tags.push(`<meta property="og:image:width" content="1200">`);
  tags.push(`<meta property="og:image:height" content="630">`);
  tags.push(`<meta property="og:image:alt" content="${escapeHtml(meta.titlePlain)}">`);
  tags.push(`<meta property="og:locale" content="${escapeHtml(meta.lang)}">`);
  if (meta.publishedTime) {
    tags.push(`<meta property="article:published_time" content="${escapeHtml(meta.publishedTime)}">`);
  }

  /* Twitter */
  tags.push(`<meta name="twitter:card" content="${escapeHtml(meta.twitterCard)}">`);
  if (SITE.twitter) {
    tags.push(`<meta name="twitter:site" content="@${escapeHtml(SITE.twitter)}">`);
  }
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

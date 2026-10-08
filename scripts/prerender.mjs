/**
 * Static prerender + SEO artifacts.
 *
 * Runs the real React app through react-dom/server for every route, injects
 * the emotion CSS collected during render, and writes
 *   dist/<path>/index.html  (clean URL for nginx try_files)
 * then generates sitemap.xml, rss.xml, robots.txt, site.webmanifest.
 *
 * Usage: node scripts/prerender.mjs            (full run after vite build)
 *        PRERENDER_LIMIT=5 node scripts/prerender.mjs  (debug subset)
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
/* R2C-1: origin is derived from the app's SITE.url (via siteMeta) at write
 * time; this env override exists only for staging previews. No fabricated
 * default host. */
const SITE_URL_OVERRIDE = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/$/, '') : null;

async function main() {
  /* React 19 renders server-side natively; alias the vendored emotion shims
   * the same way vite does, via NODE_PATH-free import map isn't available, so
   * we import the *built* client bundle instead: it already contains the app,
   * the router and emotion compiled in. */
  const appEntry = join(ROOT, 'prerender-built', 'entry.mjs');
  if (!existsSync(appEntry)) {
    console.error('prerender-built/entry.mjs missing — run the vite SSR prerender build first (scripts/build.mjs does).');
    process.exit(1);
  }

  const mod = await import(pathToFileURL(appEntry).href);
  const { renderRoute, prerenderPaths } = mod;

  const paths = applyLimit(prerenderPaths());
  process.stderr.write(`prerendering ${paths.length} route(s)… `);

  let written = 0;
  for (const path of paths) {
    const { html, cssErrors } = renderRoute(path);
    if (cssErrors.length > 0) {
      throw new Error(`CSS errors while prerendering ${path}:\n - ${cssErrors.join('\n - ')}`);
    }
    const outFile = path === '/' ? join(DIST, 'index.html') : join(DIST, path.replace(/^\//, ''), 'index.html');
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, html, 'utf8');
    written += 1;
  }
  process.stderr.write(`${written} page(s)\n`);

  await writeArtifacts(mod);
}

function applyLimit(paths) {
  const limit = Number(process.env.PRERENDER_LIMIT ?? 0);
  return limit > 0 ? paths.slice(0, limit) : paths;
}

async function writeArtifacts(mod) {
  const { siteMeta, feedItems, sitemapPaths } = mod;
  /* R2C-1: origin comes from the app's own SITE.url (via siteMeta) — never a
   * divergent env default. URL FORM matches canonicals exactly (no forced
   * trailing slash): '/' stays '/', '/writing' stays '/writing'. */
  const ORIGIN = (SITE_URL_OVERRIDE ?? siteMeta.url).replace(/\/$/, '');
  if (!ORIGIN || !/^https?:\/\//.test(ORIGIN)) {
    console.error('refusing to write discovery docs without a real https origin (siteMeta.url missing?)');
    process.exit(1);
  }

  writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`, 'utf8');

  /* F5 (R4-C): lastmod must NOT be build wall-clock — mass churn on every
   * rebuild with unchanged content is disfavored by crawlers and made the
   * "byte-stable output" claim false for discovery docs. Use the last commit
   * that actually touched content (stable until content changes); fall back
   * to a fixed floor date when git is unavailable. */
  let lastmod = '2026-01-01';
  try {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('git', ['log', '-1', '--format=%cs', '--', 'content'], {
      cwd: ROOT ?? process.cwd(), encoding: 'utf8',
    });
    if (r.status === 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.stdout.trim())) {
      lastmod = r.stdout.trim();
    }
  } catch {
    /* keep floor date */
  }
  const urls = sitemapPaths.map(
    (p) => `  <url><loc>${ORIGIN}${p === '/' ? '/' : p}</loc><lastmod>${lastmod}</lastmod></url>`,
  );
  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    'utf8',
  );

  const items = feedItems.map((item) => {
    /* R2C-10: guid = the canonical absolute URL (permalink) — validators flag
     * urn:uuid:<slug> as not a UUID, and it duplicated the link anyway. */
    const url = `${ORIGIN}${item.path === '/' ? '/' : item.path}`;
    return [
      '  <item>',
      `    <title>${xmlEscape(item.title)}</title>`,
      `    <link>${url}</link>`,
      `    <guid isPermaLink="true">${xmlEscape(url)}</guid>`,
      `    <pubDate>${rfc822(item.date)}</pubDate>`,
      `    <description>${xmlEscape(item.summary)}</description>`,
      item.tags.map((t) => `    <category>${xmlEscape(t)}</category>`).join('\n'),
      '  </item>',
    ]
      .filter(Boolean)
      .join('\n');
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xmlEscape(siteMeta.title)}</title>
  <link>${ORIGIN}/</link>
  <description>${xmlEscape(siteMeta.description)}</description>
  <language>en-us</language>
  <lastBuildDate>${rfc822(lastmod + 'T00:00:00Z')}</lastBuildDate>
  <atom:link href="${ORIGIN}/rss.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
</channel>
</rss>
`;
  writeFileSync(join(DIST, 'rss.xml'), rss, 'utf8');

  writeFileSync(
    join(DIST, 'site.webmanifest'),
    JSON.stringify(
      {
        name: siteMeta.title,
        short_name: siteMeta.shortTitle ?? 'Portfolio',
        start_url: '/',
        display: 'standalone',
        /* R3D-04: manifest colors are static, so match the case theme-init
         * actually resolves for most first-time mobile users (system light)
         * — dark hard-coded here meant a dark splash flashing to light.
         * PNG icon included: some Android launchers reject SVG-only icons. */
        background_color: '#eef1f6',
        theme_color: '#eef1f6',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  process.stderr.write('artifacts: robots.txt, sitemap.xml, rss.xml, site.webmanifest\n');
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rfc822(dateLike) {
  return new Date(dateLike).toUTCString();
}

main().catch((error) => {
  console.error('PRERENDER FAILED:', error.stack ?? error.message);
  process.exit(1);
});

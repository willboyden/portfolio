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
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL ?? 'https://example.com').replace(/\/$/, '');

async function main() {
  /* React 19 renders server-side natively; alias the vendored emotion shims
   * the same way vite does, via NODE_PATH-free import map isn't available, so
   * we import the *built* client bundle instead: it already contains the app,
   * the router and emotion compiled in. */
  const appEntry = join(ROOT, 'prerender', 'entry.mjs');
  if (!existsSync(appEntry)) {
    console.error('prerender/entry.mjs missing — it must be built with `npm run build:prerender`.');
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

  writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8');

  const now = new Date().toISOString();
  const urls = sitemapPaths.map(
    (p) => `  <url><loc>${SITE_URL}${p === '/' ? '/' : p + '/'}</loc><lastmod>${now}</lastmod></url>`,
  );
  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    'utf8',
  );

  const items = feedItems.map((item) => {
    const url = `${SITE_URL}${item.path}/`;
    const guid = `urn:uuid:${item.slug}`;
    return [
      '  <item>',
      `    <title>${xmlEscape(item.title)}</title>`,
      `    <link>${url}</link>`,
      `    <guid isPermaLink="false">${xmlEscape(guid)}</guid>`,
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
  <link>${SITE_URL}/</link>
  <description>${xmlEscape(siteMeta.description)}</description>
  <language>en-us</language>
  <lastBuildDate>${rfc822(now)}</lastBuildDate>
  <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
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
        background_color: '#0b0e14',
        theme_color: '#0b0e14',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
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

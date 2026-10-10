/**
 * Tiny static file server for e2e + preview, mirroring the nginx config's
 * behaviour: hashed assets cached immutably, HTML no-store, SPA fallback to
 * index.html, clean URLs (/about -> /about/index.html).
 *
 * Usage: node scripts/serve-dist.mjs [distDir] [port] [--no-spa]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve , sep} from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? process.env.PORT ?? 4321);
const spa = !process.argv.includes('--no-spa');

/** R3-A #2: one security-header set, applied to EVERY response — including
 * the 404/400 error paths, which previously answered bare (no CSP), leaving
 * the reflected-URL debug text unshielded. */
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

/** R1-C #5 + R3-A #2: attacker-controlled strings never reach HTML raw. */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? '');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function safeJoin(rootDir, urlPath) {
  /* Decode then normalize, and refuse anything escaping root. */
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  const candidate = normalize(join(rootDir, decoded));
  /* prefix-compare WITH separator: plain startsWith admits siblings like
   * `/a/distevil/` for root `/a/dist` (R3C-10). */
  if (candidate !== rootDir && !candidate.startsWith(rootDir + sep)) return null;
  return candidate;
}

export function startServer({ dir = root, port: bindPort = port, spaMode = spa } = {}) {
  const server = createServer((req, res) => {
    /* R8: strip the hosting base (VITE_BASE, e.g. /portfolio/ on Pages) so
     * the e2e server — which serves dist at root — resolves base-prefixed
     * asset/asset-script refs the same way nginx-with-subpath would. */
    let reqUrl = req.url ?? '/';
    const base = (process.env.VITE_BASE ?? '/').replace(/\/$/, '');
    if (base && (reqUrl === base || reqUrl.startsWith(`${base}/`))) {
      reqUrl = reqUrl.slice(base.length) || '/';
    }
    const path = safeJoin(dir, reqUrl);
    if (path === null) {
      res.writeHead(400, { ...SECURITY_HEADERS, 'content-type': 'text/plain; charset=utf-8' }).end('Bad path');
      return;
    }

    const serve = (file, cacheControl) => {
      /* gzip_static parity with nginx: prefer the precompressed sibling when
       * the client accepts gzip — real transfer size then matches production. */
      const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
      let servedFile = file;
      const headers = {
        'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': cacheControl,
        /* Mirrors deploy/nginx.conf — the preview server must behave like
         * production so the e2e security spec tests real responses. */
        ...SECURITY_HEADERS,
      };
      if (acceptsGzip && existsSync(`${file}.gz`)) {
        servedFile = `${file}.gz`;
        headers['content-encoding'] = 'gzip';
        headers.vary = 'Accept-Encoding';
      }
      res.writeHead(200, headers);
      createReadStream(servedFile).pipe(res);
    };

    const notFound = (message) => {
      /* The message interpolates req.url — escape HERE, at the sink, so every
       * call site is safe by construction (was: escaped only at one of two). */
      const body = `<!doctype html><html><head><meta charset="utf-8"><title>404</title></head><body style="font-family:sans-serif;background:#0b0e14;color:#eef1f8"><h1>404</h1><p>${escapeHtml(message)}</p></body></html>`;
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS });
      res.end(body);
    };

    const candidates = [];
    if (existsSync(path) && statSync(path).isDirectory()) {
      candidates.push(join(path, 'index.html'));
    } else {
      candidates.push(path);
      /* Clean URL: /about -> about/index.html (matches the prerender output). */
      candidates.push(`${path}/index.html`);
    }

    for (const candidate of candidates) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        const hashed = /-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/.test(candidate) || candidate.includes('/assets/');
        const cache = hashed ? 'public, max-age=31536000, immutable' : 'no-store';
        serve(candidate, cache);
        return;
      }
    }

    /* 404 semantics mirror nginx: error_page 404 /404/index.html (status 404),
     * and hashed-asset misses are hard 404s (no SPA fallback poisoning a
     * <script> tag with HTML). */
    const spaFallback = spaMode ? join(dir, '404', 'index.html') : null;

    if (path.startsWith(join(dir, 'assets')) && !candidates.some((c) => existsSync(c) && statSync(c).isFile())) {
      notFound(`Missing asset ${req.url}`);
      return;
    }

    if (spaFallback && existsSync(spaFallback)) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS });
      createReadStream(spaFallback).pipe(res);
      return;
    }
    notFound(`No file for ${req.url} (prerendered 404 page missing? build 404 route)`);
    /* (notFound escapes — sink-side, R3-A #2) */
  });

  return new Promise((resolveListen) => {
    server.listen(bindPort, '127.0.0.1', () => {
      /* With port: 0 the OS picks — report the ACTUAL bound port. */
      resolveListen({ server, port: server.address().port });
    });
  });
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { port: bound } = await startServer();
  console.log(`serving ${root} at http://127.0.0.1:${bound}`);
}

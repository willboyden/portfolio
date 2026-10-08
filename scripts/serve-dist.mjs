/**
 * Tiny static file server for e2e + preview, mirroring the nginx config's
 * behaviour: hashed assets cached immutably, HTML no-store, SPA fallback to
 * index.html, clean URLs (/about -> /about/index.html).
 *
 * Usage: node scripts/serve-dist.mjs [distDir] [port] [--no-spa]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? process.env.PORT ?? 4321);
const spa = !process.argv.includes('--no-spa');

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
  if (!candidate.startsWith(rootDir)) return null;
  return candidate;
}

export function startServer({ dir = root, port: bindPort = port, spaMode = spa } = {}) {
  const server = createServer((req, res) => {
    const path = safeJoin(dir, req.url ?? '/');
    if (path === null) {
      res.writeHead(400).end('Bad path');
      return;
    }

    const serve = (file, cacheControl) => {
      const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, {
        'content-type': type,
        'cache-control': cacheControl,
        /* Mirrors deploy/nginx.conf — the preview server must behave like
         * production so the e2e security spec tests real responses. */
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
        'content-security-policy':
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      });
      createReadStream(file).pipe(res);
    };

    const notFound = (message) => {
      const body = `<!doctype html><html><head><meta charset="utf-8"><title>404</title></head><body style="font-family:sans-serif;background:#0b0e14;color:#eef1f8"><h1>404</h1><p>${message}</p></body></html>`;
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
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

    if (spaMode) {
      const fallback = join(dir, 'index.html');
      if (existsSync(fallback)) {
        serve(fallback, 'no-store');
        return;
      }
    }
    notFound(`No file for ${req.url}`);
  });

  return new Promise((resolveListen) => {
    server.listen(bindPort, '127.0.0.1', () => resolveListen({ server, port: bindPort }));
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { port: bound } = await startServer();
  console.log(`serving ${root} at http://127.0.0.1:${bound}`);
}

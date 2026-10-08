# Deploying to nginx — step by step

This site is a pure static build: `npm run build` produces `dist/`, and nginx
just serves it. No Node runtime in production.

## Option A — Docker (recommended)

Two Dockerfiles, one honest split:

- **`deploy/Dockerfile.prebuilt`** — what THIS repo ships today. The build is
  done by the baked toolchain (`npm run deps` links the offline node_modules;
  there is intentionally **no package-lock.json** for a networked `npm ci`
  here), so the image just serves `dist/`:

  ```bash
  node scripts/build.mjs
  docker build -f deploy/Dockerfile.prebuilt -t portfolio .
  docker run -d -p 8080:80 --name portfolio portfolio
  curl -sI http://localhost:8080/about/ | grep -i cache-control   # no-store
  ```

- **`deploy/Dockerfile`** — CI variant: builds inside the image via `npm ci`.
  Use it from a networked pipeline **after committing a package-lock.json**
  (`npm install --package-lock-only`). Without the lockfile, `npm ci` fails by
  design — that stage is not exercised in the offline sandbox.

Both variants copy the same `deploy/nginx.conf` + `deploy/snippets`, and a
config-lint unit test (`src/config-lint.test.ts`) pins that parity, the
healthcheck probe (`nc` — nginx:alpine has no wget), and the caching contract
the e2e suite asserts.

## Option B — existing nginx

```bash
# 1. build locally (Node 22+)
npm run deps && npm run build

# 2. copy artifacts
sudo cp -r dist/* /var/www/portfolio/
sudo cp deploy/nginx.conf /etc/nginx/conf.d/portfolio.conf
#    edit root + server_name in the copied file

sudo nginx -t && sudo systemctl reload nginx
```

## What the nginx config gives you

| Concern | Behaviour |
|---|---|
| Clean URLs | `/projects/foo/` resolves to `projects/foo/index.html` (real prerendered file — no SPA-fallback trickery) |
| Cache policy | `/assets/*-hash.js|css` → `immutable, max-age=1y`; HTML → `no-store`; images → 7d |
| Compression | `gzip_static` serves build-time `.gz` siblings (level 9); runtime gzip as fallback |
| Security headers | CSP (scripts `'self'` only), nosniff, frame DENY, referrer-policy, permissions-policy, COOP |
| 404 | `error_page 404 /404/index.html` served with a real 404 status (prerendered page) |
| Fingerprinting | `server_tokens off`, dot-files denied |

## HTTPS

Terminate TLS in front (Caddy/nginx + certbot/your LB), then uncomment the
`return 301 https://$host$request_uri;` line in the server block.

## Updating content

1. Edit/add Markdown under `content/` (see README content workflow).
2. `npm run build` — validation failures abort the build with the file+field.
3. Swap the new `dist/` in; hashed assets get new names automatically, so
   visitors pick up changes on the next HTML load with zero cache purge.

## Health check

`docker inspect` shows the built-in healthcheck; on bare nginx:

```bash
curl -fsS http://localhost/ | grep -q '<h1' && echo serving
curl -fsSI http://localhost/no-such-route | head -1   # -> HTTP/1.1 404
```

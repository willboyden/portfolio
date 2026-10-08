# Portfolio — React + nginx

Professional portfolio, writing, project index, and talk/video library.
Static-first: every route is prerendered real HTML (SEO, social cards, no-JS),
then the same React app takes over in the browser for client-side navigation.

```
content/**/*.md ──build-content──▶ src/content/generated/content.json
                                          │
 vite build ────▶ dist/assets/*.js        │  prerender pass (react-dom/server)
                          ◀───────────────┴─▶ dist/**/index.html + rss + sitemap
                                                nginx serves dist/ read-only
```

## Quick start (offline / this repo)

Dependencies are vendored or symlinked from the local package store — no network:

```bash
npm run deps        # symlink node_modules from /opt/hermes/node_modules
npm run verify      # typecheck + lint + unit + full build + e2e + dist audit
```

| Command | What it does |
|---|---|
| `npm run dev` | vite dev server on :5173 |
| `npm run build` | content → client bundle → prerender → audit → gzip |
| `npm run preview` | serves `dist/` on :4321 with nginx-equivalent routing/headers |
| `npm test` | vitest unit + component suites (SSR-render based) |
| `npm run test:e2e` | real headless Chrome (CDP) against built `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint (hooks rules included) |
| `npm run audit:site` | checks dist/ pages, feeds, links, bundle budget |

## Deploying with nginx

`dist/` is a plain static tree; any static host works, nginx config provided:

```bash
docker build -f deploy/Dockerfile -t portfolio .
docker run -p 8080:80 portfolio
```

The config (`deploy/nginx.conf`) provides:
- clean URLs (`/projects/foo/` served from `projects/foo/index.html`),
- immutable caching for `/assets/*-hash.js`, `no-store` for HTML,
- `gzip_static` (the build emits `.gz` siblings at level 9),
- security headers incl. CSP (`script-src 'self'` only).

Copy to an existing nginx: `site/` → `/usr/share/nginx/html`, conf → `conf.d/`.

### Variant: Cloudflare Pages / Netlify / S3

Any static host: point the publish dir at `dist/`. For SPA fallback rules,
note that **every route already exists as a real HTML file** — the SPA
fallback is only a safety net for client-only paths.

## Content workflow

Everything published lives in `content/` as Markdown with YAML-ish frontmatter:

```bash
# write
$EDITOR content/posts/2026-05-01-my-new-post.md
npm run content:build     # validates schema, renders markdown, emits JSON
npm run dev               # preview it live at /writing/my-new-post
```

Schema (enforced by `scripts/build-content.mjs`, fail-closed with line numbers):
`title`, `summary`, `date` (YYYY-MM-DD), `tags[]` + per-type fields — see
`src/content/schema.ts`. Build fails loudly on bad dates, duplicate slugs,
missing required fields, or unknown frontmatter keys.

## Architecture notes

- **Styling**: `@emotion/react` + `@emotion/styled`. In this repo they alias to
  a vendored subset (`vendor/emotion/*`) with contract tests pinning behaviour;
  swapping to published Emotion = delete alias, `npm install @emotion/react @emotion/styled`.
- **Routing**: tiny history router (`vendor/router`) — 230 lines, route params,
  nested layout via `Outlet`, prerender-safe (`initialPath`).
- **Prerender**: `prerender/entry.mjs` renders each route, collects emotion CSS,
  injects meta/OG/JSON-LD, and writes the file tree. `scripts/build.mjs` chains it.
- **Theme**: `theme-init.js` sets `data-theme` pre-paint; `ThemePreferenceProvider`
  owns the preference; `AppThemeProvider` maps it to Emotion tokens + globals.
- **E2E**: zero-dependency CDP harness (`e2e/harness/`) drives the system
  Chrome-headless-shell; specs are Playwright-shaped (`describe/test` registry).

## Where reviews live

`REVIEW_LOG.md` records each review round: reviewer persona, findings with
severity, and the fix/verify entries. The site ships only at 0 unresolved
HIGH/MEDIUM findings across the final round.

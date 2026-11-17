# Portfolio — React + nginx

Professional portfolio, writing, project index, and talk/video library.
Static-first: every route is prerendered real HTML (SEO, social cards, no-JS),
then the same React app adopts that markup in the browser (it keeps the
elements already on screen and attaches to them) for client-side navigation.

```
content/**/*.md ──build-content──▶ src/content/generated/content.json
                 └────────────────▶ public/knowledge-graph.json (/graph)
                                          │
 vite build ────▶ dist/assets/*.js        │  prerender pass (react-dom/server)
                          ◀───────────────┴─▶ dist/**/index.html + rss + sitemap
                                                nginx serves dist/ read-only
```

## Quick start

Two supported environments (CONTRACT §1):

```bash
# Networked host / CI (GitHub Actions, your dev machine):
npm ci               # or: npm install --legacy-peer-deps on npm 10.9.x
npm run verify       # typecheck + lint + format check + unit + full build + e2e + dist audit

# Offline sandbox (/opt/hermes container) — no network:
npm run deps         # symlink node_modules from /opt/hermes/node_modules
npm run verify
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
| `npm run format` | Prettier 3.9.10 rewrites code and JSON in place (`.prettierrc.json`; Markdown, YAML and generated content are skipped, see `.prettierignore`) |
| `npm run format:check` | the same check `verify` and the deploy workflow run; fails on any unformatted file |
| `npm run audit:site` | checks dist/ pages, feeds, links, bundle budget |
| `npm run themes:sync` | rewrites the theme tables in `public/theme-init.js` from `src/theme/tokens.ts` (run after adding or changing a theme) |

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

Posts (`content/posts/*.md`) and local recipes (`content/recipes/*.md`) are the
exceptions to "everything is in content.json": each body is written to
`public/post-bodies/<slug>.json` or `public/recipe-bodies/<slug>.json`, and
content.json keeps only the card fields plus a `bodyHash`, so bodies never count
against the JS budget. Commit the body file with the post or recipe and
content.json. The prerender inlines it, the first load reuses that copy, and a
client-side visit fetches it once (`src/content/post-bodies.ts`,
`src/content/recipe-bodies.ts`).

The same step rebuilds the **knowledge graph** behind `/graph` from all of the
content: every project, post, AI capability and recipe, the topics (tags and
stack entries, merged by name) at least two of them share, their series, their
frontmatter cross-links and the links inside post bodies, with a precomputed 3D
layout (`scripts/knowledge-graph.mjs` → `public/knowledge-graph.json`). It is
keyed to content.json's `contentHash`, so every content change redraws it on the
next build and deploy; a unit test and the prerender fail a stale file. Commit it
with content.json. The page draws it with a small canvas renderer
(`src/lib/graph3d.ts`, ~3 kB gzipped, loaded only on `/graph`), and selecting any
node lists links to its page and every connected page.

## Design: a lab notebook, typeset

The site has one idea and keeps to it: **paper, ink, and one highlighter**.

- **Ink does the work.** Text, links, buttons and rules are the ink colour.
  There is no brand colour and no gradient.
- **The highlighter marks, it does not decorate.** One colour per theme
  (`color.mark`), always as a fill behind ink-coloured text: a link's
  underline, the thing under the pointer, the current page, a selection, a
  measured number.
- **Type is IBM Plex**, self-hosted from IBM's unmodified release files
  (`public/fonts/`, checksums pinned in `src/theme/fonts.ts`): Serif for
  headings and long reading, Sans for the interface, Mono for data (dates,
  versions, measurements). Three files are preloaded (the faces that set
  large or long text on a first screen); the rest load when a page uses them,
  and metric-matched local fallbacks keep the page from moving when they
  arrive.
- **Flat and square.** Hairline rules instead of cards with shadows; a ruled
  margin column beside the body on wide screens; ISO dates in lists; tables set
  like a report.
- **Measured numbers are content.** A post can carry a `keyMetric`
  (`keyMetric: "label = value"` in its frontmatter); the home page and the
  writing list show them.

The shared looks live in `src/theme/mixins.ts` (links, chips, labels, data
text) and the primitives in `src/components/ui/` (see its README).

A few of the redesign's decisions are a matter of taste and can be taken back
one by one: `REDESIGN.md` lists them, with a switch (`src/site-choices.ts`),
the old wording, or the one command for each.

### Themes

Twelve themes, every one the same idea in different materials. A theme is a
recipe of three colours and a mode in `src/theme/tokens.ts`:

```ts
legal: { mode: 'light', paper: '#faf5d2', ink: '#1a2440', mark: '#ff8d7a' },
```

`makePalette` (`src/theme/make-theme.ts`) derives every other token from the
recipe and enforces contrast while it does: a derived text colour is moved
toward the ink until it clears its floor on the worst surface it is used on.

To add a theme:

1. Add its id to `ThemeName`, an entry to `THEME_INFO` (label, mode, note) and
   a recipe to `RECIPES`.
2. `npm run themes:sync` (writes its colours into `public/theme-init.js`).
3. `npm test`: `contrast.test.ts` measures every text/surface pair of every
   theme, and `npm run test:e2e` measures the text the browser really painted,
   on every kind of page, under every theme (`e2e/specs/12-themes.e2e.mjs`).

Where the colours live: the stylesheet in each page holds two palettes, Night
(on `:root`) and Paper (`[data-theme=light]`). Every other theme is applied as
custom properties on `<html>`, by `theme-init.js` before first paint when the
visitor has one stored and by the app when they pick one
(`tokens.ts: applyThemeVars`). That keeps ten palettes out of every page's
HTML.

## Architecture notes

- **Styling**: `@emotion/react` + `@emotion/styled`. In this repo they alias to
  a vendored subset (`vendor/emotion/*`) with contract tests pinning behaviour;
  swapping to published Emotion = delete alias, `npm install @emotion/react @emotion/styled`.
- **Routing**: tiny history router (`vendor/router`) — 230 lines, route params,
  nested layout via `Outlet`, prerender-safe (`initialPath`).
- **Prerender**: `prerender/entry.ts` renders each route, collects emotion CSS,
  injects meta/OG/JSON-LD, and writes the file tree. `scripts/build.mjs` chains it.
- **Boot**: the entry script (`src/main.tsx`) only waits: until the browser
  reports that it has painted the page (and any picture on the first screen),
  then it imports the app (`src/app/start.tsx`). The app's files download in
  parallel from the first byte; running them never stands between the visitor
  and the first paint. The app then adopts the prerendered markup
  (`hydrateRoot` inside a transition, so the work is split into short steps)
  whenever the first render is certain to match it, and rebuilds the page
  otherwise (a query string, the not-found page, the dev server);
  `src/app/boot.ts` is that decision. A page whose markup was rendered from
  the knowledge-graph file fetches that file before it is adopted. Anything that could differ between the build and the browser
  answers with the build's value during adoption and corrects itself after:
  the theme, media queries, and the date (`src/lib/today.ts`, stamped on
  `<html data-built>`). The prerendered stylesheet is adopted as a fixed base
  and never rewritten; rules a page did not come with go to a second, small
  sheet (`vendor/emotion/core`). `e2e/specs/13-boot.e2e.mjs` checks every
  prerendered page: adopted, no error, and identical to a fresh render.
- **Theme**: `theme-init.js` sets `data-theme` (and a generated theme's
  colours) pre-paint; `ThemePreferenceProvider` owns the preference;
  `AppThemeProvider` maps it to Emotion tokens + globals.
- **Content-Security-Policy**: no inline script, no eval. zod is imported
  through `src/lib/z.ts`, which turns off its `new Function` probe (the policy
  refused it on every page load, which browsers report as an issue).
- **E2E**: zero-dependency CDP harness (`e2e/harness/`) drives the system
  Chrome-headless-shell; specs are Playwright-shaped (`describe/test` registry).

## Where reviews live

`REVIEW_LOG.md` records each review round: reviewer persona, findings with
severity, and the fix/verify entries. The site ships only at 0 unresolved
HIGH/MEDIUM findings across the final round.

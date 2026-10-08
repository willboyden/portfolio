# Build Contract — professional-portfolio

Authoritative for every builder subagent. If your brief conflicts with this file, **this file wins**.
If reality contradicts this file, **reality wins** — record it in `FINDINGS.md` and adapt.

## 0. Verified environment facts (do not re-derive, do not assume otherwise)

| Fact | Evidence |
|---|---|
| No network egress. `npm install` is impossible. | `curl https://registry.npmjs.org` → `Could not resolve host` |
| Node 26.5.1, npm 11.17.0. TypeScript 6.0.3, Vite 8.2.0, Vitest 4.1.10 present. | `node node_modules/typescript/bin/tsc --version` |
| Third-party packages resolve from `/opt/hermes/node_modules` via `bash scripts/link-offline-deps.sh .` (already run; `node_modules/` exists). | symlinks present |
| `@emotion/react` and `@emotion/styled` are **vendored** in `vendor/emotion/` and aliased in `vite.config.ts` + `vitest.config.ts` + `tsconfig.json` paths. Import them by their real names. | 15 passing contract tests |
| **NOT installed and NOT installable**: react-router-dom, jsdom, @testing-library/*, @playwright/test, marked, gray-matter, any markdown/yaml parser. | probed exhaustively |
| Real headless Chromium exists and works: `/opt/hermes/.playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell` → `Google Chrome for Testing 151.0.7922.34`. Driven over raw CDP with Node's native WebSocket (no playwright package). Verified: navigate, click via real mouse events, computed styles, responsive emulation (`Emulation.setDeviceMetricsOverride`, then `Page.reload`), screenshots. | harness run |
| **jsdom is unavailable.** Vitest runs `environment: 'node'`. Component unit tests render with `react-dom/server` (`renderToStaticMarkup`) and assert on the HTML string + the CSS the vendored Emotion registered (`__sheetCss()`). Real-interaction behaviour belongs in the CDP e2e suite, not unit tests. | verified |
| `vitest.setup.ts` calls `__resetSheet()` after each test. Per-test CSS assertions are therefore isolated. | verified |
| Emulation pitfall: `setDeviceMetricsOverride({mobile:true})` reported a wrong viewport width. Use `mobile: false` + explicit width and `Page.reload` after changing width. | verified |
| Fonts installed: DejaVu, Liberation, Noto Color Emoji only. **No Inter, no JetBrains Mono.** Font stacks must keep a solid fallback chain and must not depend on a webfont to look right. | `fc-list` |
| `nginx` is NOT installed. Its config is a reviewed artifact + a Dockerfile, not a locally runnable server here. | `command -v nginx` empty |
| Write access is restricted to `/opt/data`. Never write to `/tmp`. | `HERMES_WRITE_SAFE_ROOT` |

## 1. Commands (run from project root)

```bash
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json   # typecheck
node node_modules/vitest/vitest.mjs run                          # unit tests
node node_modules/vite/bin/vite.js build                         # production build
```
`npm run …` works too. Do not run `npm install` — it cannot succeed.

## 2. Hard rules

1. **Emotion only** for styling (`@emotion/styled` template literals). No CSS files, no Tailwind, no inline `style` prop except for genuinely dynamic values.
2. **Tokens only.** No hex colours, px radii, or raw font sizes in `src/components` or `src/pages` — read them from `p.theme`. `src/theme/tokens.ts` is the only place literal values live.
3. **Styling-only props must use the `$` transient prefix** (`$active`, `$tone`) so they never hit the DOM.
4. **Never** invent a package import. If it is not in §0, it does not exist. Write it yourself under `vendor/` or don't do it.
5. Accessibility is not optional: every interactive element reachable by keyboard, visible focus ring, landmarks, headings in order, `prefers-reduced-motion` respected, colour contrast ≥ 4.5:1 for body text.
6. Only touch files in **your file fence**. Need something from a sibling? Code against the API pinned in §4 — do not edit their file.
7. Run **your own** test files only (`vitest run <your files>`), never the whole suite — siblings are mid-write.
8. No fabrication. If a command fails or an assumption is wrong, say so in your final report and in `FINDINGS.md`.
9. Kill anything you start. Leave no servers running.
10. Do not run `git commit` — the orchestrator owns git.

## 3. Routes (from `@portfolio/router`)

`/` · `/about` · `/projects` · `/projects/:slug` · `/writing` · `/writing/:slug` · `/talks` · `/contact` · `*` (404)

Import: `Link`, `useRouter`, `useParams`, `useIsActive`, `Outlet`, `RouterProvider`, `type RouteDefinition` from `@portfolio/router`.

## 4. Pinned cross-module APIs

Implement exactly these signatures so parallel work integrates without negotiation.

### `src/content/schema.ts` (owner: content-pipeline)
```ts
export const ProjectSchema, PostSchema, VideoSchema, TalkSchema   // zod
export type Project = …; export type Post = …; export type Video = …; export type Talk = …;
export interface SiteContent {
  projects: Project[]; posts: Post[]; videos: Video[]; talks: Talk[];
}
```
Every entry carries: `slug`, `title`, `summary`, `tags: string[]`, `date` (`YYYY-MM-DD`), plus type-specific fields:
- Project: `role`, `status: 'shipped'|'active'|'archived'`, `period`, `highlights: string[]`, `stack: string[]`, `links: {source?,demo?,paper?}`, `metrics?: {label,value}[]`, `featured: boolean`, `accent?: string`
- Post: `readingMinutes`, `series?`, `heroImage?`, `html` (sanitized rendered markdown), `excerpt`
- Video: `url`, `embedId?`, `provider: 'youtube'|'vimeo'|'other'`, `duration`, `speakers?`, `event?`
- Talk: `event`, `date`, `location`, `slidesUrl?`, `videoUrl?`, `abstract`

### `src/content/index.ts` (owner: content-pipeline)
```ts
export const content: SiteContent;                    // validated at import time, throws loudly
export function getProject(slug: string): Project | undefined;
export function getPost(slug: string): Post | undefined;
export function postsByDate(): Post[];                 // newest first
export function featuredProjects(): Project[];
export function allTags(): { tag: string; count: number }[];  // sorted count desc, then alpha
```

### `src/components/ui/*` (owner: ui-primitives) — one file each, named export
```ts
Button        // props: variant 'primary'|'secondary'|'ghost', size 'sm'|'md'|'lg', as?, href?, iconLeft?, iconRight?
Tag           // props: $tone?: 'default'|'accent'|'outline', size?
Card          // props: interactive?: boolean, href?: string  (renders <a> when href given)
Section       // props: id?, size?: 'compact'|'default'|'wide', eyebrow?, title?, description?
Container     // max-width wrapper
Stack         // props: gap?, direction?, wrap?
Prose         // article body wrapper; styles the generated markdown
Heading       // props: level 1|2|3|4, size?
Spinner, EmptyState, SkipLink, Icon, VisuallyHidden, Pagination
```

### `src/components/layout/*` (owner: site-chrome)
```ts
Header   // sticky nav, active route state, mobile menu (button + dialog semantics), theme toggle
Footer   // links, RSS, back-to-top
Layout   // <a11y shell> SkipLink + Header + <main id="main"> + Footer
```

### `src/theme/ThemeProvider.tsx` (owner: platform-primitives)
```ts
export function AppThemeProvider({ children }): ReactNode   // dark/light, localStorage, system pref
export function useReducedMotion(): boolean
export function useThemeName(): [ThemeName, (t: ThemeName) => void]
```

### `src/lib/seo.ts` (owner: platform-primitives)
```ts
export function pageMeta(opts: {title: string; description: string; path: string; image?: string; type?: 'website'|'article'; publishedTime?: string}): MetaResult
export function buildHead(meta: MetaResult): string[]   // used by prerender + runtime document.title
```

### `vendor/markdown/` (owner: markdown-engine)
```ts
export function renderMarkdown(src: string): string        // CommonMark subset → HTML
export function parseFrontmatter(src: string): { data: Record<string, unknown>; body: string }
export function deriveHeadingId(text: string): string
export function readingMinutes(text: string): number
```

## 5. Content is pre-rendered, not fetched

`scripts/build-content.mjs` reads `content/**\/*.md`, validates with zod, renders markdown to HTML, and writes
`src/content/generated/content.json`. The app imports that JSON — **no runtime fetch of content files**. This is
what makes nginx serving trivial, SEO honest, and e2e deterministic.

## 6. Definition of done for any builder

- [ ] Your files typecheck: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` reports no errors **in your files**
- [ ] Your tests exist and pass: `node node_modules/vitest/vitest.mjs run <your test files>`
- [ ] No `console.log` left in shipped code paths; no TODO/FIXME placeholders
- [ ] No hard-coded colours/spacing outside tokens; no `.css` files
- [ ] Keyboard + screen-reader semantics considered and described in your report
- [ ] Report: files written, commands run with real output, assumptions you could NOT verify

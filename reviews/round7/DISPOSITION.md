# Round 7 disposition — decided by orchestrator 2026-10-23

Baseline (fresh `npm install` host, first real-network install): typecheck/lint were RED
(missing `@types/node`, `typescript-eslint` — now added to devDependencies); unit 503/503;
build AUDIT OK 23 pages, 153 kB JS gzipped; e2e pending baseline run.
Live-site divergence confirmed by R7-A/R7-B (live canonical at placeholder domain; live
/rss.xml + /sitemap.xml + 404 semantics differ from HEAD) — redeploy after this round.

## Accepted for implementation this round

From R7-A (zero-JS) — report: R7A-zero-js.md
- R7A-1 HIGH: no-JS mobile navigation — prerender a hidden static nav (same NAV_ITEMS)
  + `<noscript>` CSS in the prerender template; add a no-JS e2e spec (375px, all nav links
  reachable without JS).
- R7A-2 MEDIUM: inert search form/tag chips without JS — hide behind `<noscript>` CSS
  (target via stable classes/data-testid already present).
- R7A-3 MEDIUM: root-absolute URLs (`/rss.xml`, `/sitemap.xml`, theme-init, favicon,
  manifest, head links) must respect BASE_URL — central `withBase` helper applied at every
  sink; add config-lint/audit assertion that no `href="/` literal survives when base ≠ /.
- R7A-4 MEDIUM: emit `dist/404.html` (copy from dist/404/index.html) in build + audit check.
- R7A-5 LOW: remove the dev-only `<noscript>` block from index.html (dead code).
- R7A-6 LOW: back-to-top becomes `<a href="#main">` (works without JS); update tests.
- R7A-7 LOW: email `<li>` renders only when configured; move DRAFT comment out of the list.
- R7A-8 LOW: accept + document (comment near theme-color meta).
- Out-of-lens (accepted, content bug): wordmark monogram "AR" → "WB" (placeholder-persona
  remnant, visible on every page).

From R7-B (cross-browser) — report: R7B-cross-browser.md
- R7B-1 MEDIUM: live canonical/OG placeholder domain — ensure the Pages pipeline emits
  canonical/OG/sitemap from SITE_URL override; verify in built dist with base ≠ /.
- R7B-2 MEDIUM: live artifact not reproducible from HEAD — resolved by redeploy from HEAD
  after this round; verify live afterwards (orchestrator task).
- R7B-3 MEDIUM: add `-webkit-tap-highlight-color: transparent` (globals).
- R7B-4 MEDIUM: `overscroll-behavior: contain` on open MobileMenu.
- R7B-5 LOW: `max-height: 100vh` fallback before `100dvh` in MobileMenu.
- R7B-6 LOW: add `-webkit-user-select: none` before `user-select: none`.
- R7B-7/R7B-9 LOW: one `@media (forced-colors: active)` block restoring borders/outlines.
- R7B-8 LOW: `overflow-wrap: break-word` fallback line before `anywhere` sites.
- R7B-10 INFO: no action.

From R7-C (cognitive/language) — report: R7C-cognitive-language.md (tool:
reviews/r7c_readability.py for re-measurement)
- R7C-1 MEDIUM: re-cut all 17 card summaries to ≤2 sentences / ≤25 words, outcome first
  (content/*.md summaries — re-cutting fact-checked copy only, no new facts).
- R7C-2 MEDIUM: Home lede → 2 sentences, promise first (proposed copy in report).
- R7C-3 MEDIUM: render `post.summary` as a standfirst under the MetaRow in PostDetail.
- R7C-4 MEDIUM: projects filter chips — show tags with count ≥ 2; long tail behind a
  `<details><summary>` "More tags" disclosure (works without JS).
- R7C-5 LOW: unify link label to "Read the case study" (Projects.tsx).
- R7C-6 LOW: About languages sentence → plainer phrasing from report.
- R7C-7 LOW: "Now" nav link gets title + aria-label "What I'm working on now".
- R7C-8 LOW: one-line explanation under "Related projects" BlockTitle (ProjectDetail).
- Success criteria: projects-index FRE ≥ 35, home FRE ≥ 40, ≤5 sentences >25 words per
  grid page (re-measure with r7c_readability.py).

From R7-D (maintenance/rot) — report: R7D-maintenance-rot.md
- R7A-01/R7A-02 (deps): DONE already (devDeps added) — commit package.json.
- R7B-01 HIGH: EADDRINUSE — serve-dist.mjs detects busy port, logs a clear diagnostic and
  (for the e2e runner) picks the next free port; e2e run.mjs surfaces the resolved port.
- R7B-02 MEDIUM: Pages workflow runs the e2e suite against the subpath-base artifact that
  actually ships (not only the root-base artifact).
- R7B-03 MEDIUM: pin chrome-headless-shell version in the workflow (query the local
  binary's version and pin that exact version).
- R7B-04 + R7E-01 HIGH: commit package-lock.json; add .github/dependabot.yml; workflow
  uses `npm ci` now that a lockfile exists (keep install fallback).
- R7C-01 MEDIUM: untrack `prerender-built/` (gitignore + git rm --cached; build regenerates).
- R7D-01 MEDIUM: remove unused `heroImage` from schema (verify no content uses it first);
  unknown-key strictness then covers it.
- R7E-02 + R7G-01/02: README quick-start + CONTRACT §31 updated to describe BOTH
  environments (offline container linker; networked host `npm install`) accurately.
- R7F-01 MEDIUM: REVIEW_LOG.md gains a Round 7 entry (written at round close by
  orchestrator/implementer) linking reviews/round7/.
- R7H-01 MEDIUM: build-content fails with file:line when a markdown image target does not
  exist under public/ (or is an unsupported remote URL, per existing policy).
- R7I-01 LOW: /now "Last updated" moves into content frontmatter, rendered from there.
- R7J-01 LOW: ACCEPTED (owner-verified project status; do not change facts).

## Rules for the implementer
- Every code change ships with/updates a test where the repo already tests that surface.
- `npm run verify` (CHROME_BIN env per README note) must be green before committing.
- Commits in logical batches, messages reference finding IDs (R7A-3, R7C-1, ...).
- Do NOT push — orchestrator pushes after re-review.
- Update REVIEW_LOG.md Round 7 section at the end (personas, findings, dispositions,
  battery numbers).

# R7-D Re-Review — Maintenance / Content-Rot (round 7 fix wave)

**Re-scored lens: 8.5/10** (was 5/10). Verified against HEAD `85f7a7d`, clean tree, via a
fresh `git clone` into `/tmp/opencode/r7d-rereview` + `npm ci --legacy-peer-deps` + full
gate battery run in the throwaway copy. Real repo untouched.

## Per-finding verdicts

| ID | Verdict | Evidence |
|----|---------|----------|
| R7A-01 typecheck gate rot | **FIXED** | `@types/node ^26.6.5` in package.json:39. Fresh clone + `npm ci --legacy-peer-deps` → `npm run typecheck` exit 0 (throwaway probe). |
| R7A-02 lint gate rot | **FIXED** | `typescript-eslint ^8.72.0` in package.json:47. Same fresh install → `npm run lint` exit 0. |
| R7B-01 EADDRINUSE crash | **FIXED** | serve-dist.mjs:141-160: EADDRINUSE → loud diagnostic + next-port retry, returns resolved port. Probe: blocked 4321 → server bound 4322; second call → 4323. e2e/run.mjs:34-35 uses `served.port` instead of assuming 4321. |
| R7B-02 e2e on wrong artifact | **FIXED** | deploy-pages.yml: e2e step moved AFTER "Rebuild with Pages base path", runs against the subpath artifact that ships (comment cites R7B-02). |
| R7B-03 floating chrome tag | **FIXED** | `chrome-headless-shell@151.0.7922.34` pinned (exact version); verified installable via @puppeteer/browsers; the pinned binary drove the 57/57 e2e pass. |
| R7B-04 lockfile untracked | **FIXED** | package-lock.json committed (`git ls-files` confirms, 109.7 kB); CI install is `npm ci` when present. |
| R7C-01 prerender-built/ tracked+dirty | **FIXED** | `.gitignore:12` now ignores `prerender-built/` (with comment); but note: 7 files under it are STILL tracked (`.nojekyll`, icons, og pngs, theme-init.js) — see residual risk below. Real repo tree is clean at HEAD. |
| R7D-01 heroImage dead schema field | **FIXED** | Removed from PostSchema (schema.ts:79 comment explains the strict-mode re-add rule). Probe: post with `heroImage` → `Unrecognized key: "heroImage"`, exit 1. CONTRACT §4 still lists `heroImage?` on Post — doc line stale (LOW). |
| R7E-01 no dependency automation | **FIXED** | `.github/dependabot.yml` present: npm ecosystem, weekly, grouped prod/dev, limit 5. |
| R7E-02/R7G-01/02 docs rot | **FIXED** | README "Quick start" now documents both environments (networked `npm ci` / offline `npm run deps`); CONTRACT §1 has a "Two supported environments" block with the npm 10.9.x `--legacy-peer-deps` caveat. Consistent with CI reality. |
| R7F-01 REVIEW_LOG round-7 gap | **FIXED** | REVIEW_LOG.md:417+ "R7 (round 7 — four fresh lenses…)" entry: fleet scores, per-finding dispositions incl. R7D/R7H/R7I/R7J, gate battery, links to reviews/round7/ + DISPOSITION.md. Matches what shipped. |
| R7H-01 broken markdown images | **FIXED** | build-content.mjs:181-217 fail-closed image gate. Probes: missing `public/` file → exit 1 with file+src; remote `https://` src → exit 1 (zero-external-URL policy); both cite file:slug. |
| R7I-01 /now date hardcoded | **FIXED** | Now.tsx:23 `NOW_UPDATED = formatMonthYear(newestContentDate)` derived from newest shipped content date (build invariant, fallback literal). Verified: newest post date 2026-10-06 renders "Last updated October 2026" (unit test pins it). |
| R7J-01 status:active staleness | **ACCEPTED (as directed)** | Unchanged; owner-verified field, dispositioned in REVIEW_LOG round-7 entry. |

## Verification battery (throwaway clone, all green)
- `npm ci --legacy-peer-deps`: clean install, 0 vulnerabilities, lockfile honored
- `npm run typecheck` 0 · `npm run lint` 0 · unit **503/503** · `node scripts/build.mjs` AUDIT OK · e2e **57/57** (with pinned chrome-headless-shell@151.0.7922.34 via CHROME_BIN)

## Residual rot risks (do not block)
1. **PRERENDER-BUILT MIXED STATE (LOW):** `.gitignore` has `prerender-built/` but 7 static files under it remain tracked (`.nojekyll`, favicon, apple-touch-icon, og-*.png, theme-init.js). Harmless today (they're static sources the build copies, and tree is clean), but the intent "never committed" is half-applied — `git rm --cached prerender-built/*` (or `!` negation rules for the static set) would finish it. If the build ever starts writing different bytes into those names, they go dirty again.
2. **CONTRACT §4 still lists `heroImage?` on Post (LOW):** one stale line in a pinned-API doc; next reader could re-add the field believing it's supported. One-line doc fix.
3. **Now.test pins the literal "October 2026" (INFO):** the test asserts the current derived output; it self-updates with content (good) but the test name/comment should not imply a fixed string contract — cosmetic.
4. **e2e needs CHROME_BIN outside CI (INFO, pre-existing):** local runs require a chrome binary on PATH/CHROME_BIN; README documents the CI path. Acceptable.
5. **Summary-warning guardrail is warn-only (INFO):** R7C summary guardrail doesn't fail the build — deliberate per REVIEW_LOG.

## Disposition recommendations
- All 14 R7-D findings: **no action required** — verified fixed or accepted as directed.
- Optional one-liners for the next content/docs touch: finish the prerender-built untracking (git rm --cached the 7 static files or add negation rules) and drop `heroImage?` from CONTRACT §4.
- Next review cadence: dependabot weekly + the committed lockfile make the gate-rot class unlikely to recur silently; a 6-month re-check of dated post claims (test counts, tool versions in prose) remains the main standing rot watch.

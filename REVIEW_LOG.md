# Review log

Each round: reviewer persona → findings (severity: BLOCKER/HIGH/MEDIUM/LOW) →
fix commits → re-verification. Site ships only with 0 unresolved
BLOCKER/HIGH/MEDIUM findings in the final round.

## Round 1 — three adversarial reviewers (completed)

Reviewers: **R1-A** principal React engineer (vendored emotion/router/theme/shell),
**R1-B** WCAG 2.2 AA auditor (chrome/UI/tokens/a11y-suite), **R1-C** app-security
engineer (markdown→browser trust chain, CSP, supply chain, secrets). All findings
were reproduced with executed probes before acceptance (AGENTS.md §1).

### R1-A (React/emotion) — disposition

| ID | Sev | Finding | Disposition |
|----|-----|---------|-------------|
| R1A-01 | BLOCKER | `ThemePreferenceProvider` never mounted in `createApp()` → prerender crashed all 16 routes | FIXED — provider mounted above AppThemeProvider (integration verified: build green, e2e theme tests green) |
| R1A-02 | HIGH | Two theme controllers persisted incompatible formats under `portfolio.theme` (JSON vs raw string), mutually evicting | FIXED — single JSON codec both sides write/read; reader tolerates legacy bare strings; theme-init.js already matched JSON |
| R1A-03 | HIGH | `keyframeCache` survived `__resetSheet()` → later routes got animation names with NO `@keyframes` rule | FIXED — registration re-checked against sheet every call (`vendor/emotion/core/src/index.ts`) |
| R1A-04 | MEDIUM | `styled(Component)` stripped custom/`$` props (isPropValid applied to non-DOM targets) | FIXED — Emotion semantics: component targets forward everything except stripped internals; `$current` trap on Pagination closed |
| R1A-05 | MEDIUM | `<Global>` sheet key used a 40-char prefix → different Globals sharing a prefix silently clobber | FIXED — key = `global:${hash(cssText)}` (full text) |
| R1A-06 | MEDIUM | MobileMenu referenced `fade-in`/`slide-down` keyframes that were never defined (dead CSS) | FIXED — nested `@keyframes` added to Backdrop/Panel (Spinner pattern) |
| R1A-07 | LOW | SUSPECT_VALUE guard false-positives on quoted `NaN`/`undefined` text | ACCEPTED as documented strictness; failure mode is a loud build error, never silent corruption |
| R1A-08 | LOW | `.attrs()` merge order inverted vs upstream; unused in repo | ACCEPTED — no call sites; documented in vendor README scope |
| R1A-09 | LOW | Router: popstate+hashchange double-setLocation; multi-`#` scroll id | ACCEPTED for now (no user-visible break); candidate for round-2 polish |
| R1A-10 | LOW | Prerendered `<style id="emotion-prerender">` not adopted by client → CSS shipped twice until boot | OPEN candidate — cosmetic byte doubling, no FOUC/drift (deterministic keys); round-2 |

Verified clean by R1-A (recorded so future rounds don't re-litigate): class-name
determinism, CSS insertion-order parity, validation-throwing serialization,
router param decoding, SVG casing.

### R1-B (WCAG) — disposition

| ID | Sev | Finding | Disposition |
|----|-----|---------|-------------|
| F1 | HIGH | light `success` #0e8a5f = 4.10:1 (fails AA as text; PostDetail share status uses it) | FIXED → #0b7a53 (5.04), pinned by new contrast matrix |
| F2 | HIGH | `textSubtle` fails AA on every surface in BOTH themes (footer copyright, dialog hint, pagination labels) | FIXED → dark #7c88a3 / light #5d6880, pinned by matrix + distinctness-from-textMuted test |
| F3 | MEDIUM | `Section` emitted `aria-labelledby` to a nonexistent heading when no `title` | FIXED — conditional on title |
| F4 | MEDIUM | Modal dialog lacked background `inert` (NVDA browse-mode escape) + focus-restore hazards | FIXED — body-children inerted while open (restored on close), one-shot restoreTarget, hidden-target guard |
| F5 | MEDIUM | Wordmark rendered accentText-on-accent (3.16:1 dark) — the combo Button documents as rejected | FIXED → bg-on-accent verified pair |
| F6 | MEDIUM | Nothing enforced contrast math (how F1/F2 shipped) | FIXED — `src/theme/contrast.test.ts` computes WCAG ratios for 21 curated pairs × 2 themes |
| F7 | MEDIUM | Sticky header @72% opacity over content → transient 3.19:1 | FIXED — blur branch raised to 88% |
| F8 | MEDIUM | `/videos` routed but linked nowhere (unreachable page) | FIXED — Videos added to NAV_ITEMS; layout test updated |
| L1 | LOW | reduced-motion guard lost to component animations/scroll-behavior | FIXED — `!important` on the global guard (load-bearing, commented) |
| L2 | LOW | Pagination current/disabled edges project as generic; keyboard can't step past disabled edge | OPEN — round-2 UX fix (needs a11y-preserving disabled-button pattern) |
| L3 | LOW | `useThemeTokens()` comment overclaims an assertion | OPEN — cosmetic |
| L4 | LOW | Unused SkipLink primitive duplicates Layout's real skip link | OPEN — consolidate in round 2 |
| L5 | LOW | noscript linked `/blog/` (not a route) | FIXED → `/writing/` |
| L6 | LOW | `aria-controls` dangles while dialog closed | ACCEPTED — the documented ARIA-permitted pattern (comment in Header.tsx); VoiceOver tradeoff noted |
| L7 | LOW | Spinner status text inside aria-labeled button not announced | ACCEPTED — aria-busy conveys it; live region candidate round 2 |
| F9 | — | e2e a11y-suite gap list (15 items) | PARTIALLY FIXED — fail-fast, contrast gate, touch-target threshold; remaining gaps (AX-tree, focus-trap real Tab cycle, 240px reflow) → round-2 a11y reviewer owns |

### R1-C (security) — disposition

| ID | Sev | Finding | Disposition |
|----|-----|---------|-------------|
| #1 | HIGH | nginx `add_header` inheritance: every location with its own `add_header` lost CSP/XFO/nosniff | FIXED — `deploy/snippets/security-headers.conf` included server-level AND in every add_header location; Dockerfile copies snippets/; `config-lint.test.ts` enforces the invariant + CSP parity with serve-dist |
| #2 | HIGH | `z.string().url()` accepted `javascript:`/`data:` in frontmatter → `<a href>` sinks | FIXED — shared `SafeUrl` (http/https/mailto refine) on all schema URL fields |
| #3 | MEDIUM | Manifest deps lied (eslint ^9 vs 10.8 installed etc.) + phantom `@testing-library/dom`; no lockfile in offline container | FIXED versions to installed truth + dropped phantom dep. Lockfile: NOT PRODUCIBLE offline (no registry) — Docker note added instead; flagged in deploy docs |
| #4 | LOW | `style-src 'unsafe-inline'` needed by emotion sheet injection | ACCEPTED — documented rationale (accurate per reviewer) |
| #5 | LOW | serve-dist 404 reflected raw `req.url` into HTML | FIXED — HTML-escaped |
| #6 | LOW | audit didn't prove prerender ran | FIXED-in-effect — audit's canonical/title checks already fail a client-only dist (verified); reviewer's scenario passes the gate only for zero-page dists, which route-existence check already blocks |
| #7 | LOW | plaintext :80, HTTPS 301 commented | ACCEPTED for container boot; deploy docs say re-enable TLS+HSTS |
| #8 | LOW | CSP `img-src 'self' data:` unused; `object-src` implicit | FIXED — img-src 'self', object-src 'none' (nginx + serve-dist + e2e CSP string all synced by config-lint test) |
| #9 | LOW | `dangerouslySetInnerHTML` DRAFT-comment footgun | ACCEPTED (string literals only); will be deleted with the DRAFT markers at content finalization |
| #10 | INFO | `SITE.shortTitle`/`tagline` referenced but undefined → home title rendered "… — undefined" | FIXED — both defined on SITE |

Reviewer-verified strong areas (recorded): full XSS vector sweep BLOCKED
(61-case harness incl. `</script>`/JSON-LD/head-injection/slug traversal),
secrets scan clean, lifecycle hooks clean.

## Round-2 carry list (for the next reviewer wave)

- R1A-10: adopt/dedupe prerendered style tag at boot (perf byte-doubling)
- R1A-09: router scroll-id edge + popstate dedupe
- R1-B L2: Pagination disabled-edge keyboard path + AX projection
- R1-B L4: consolidate SkipLink implementations
- R1-B F9 remaining: AX-tree assertions, real-Tab focus-trap cycle, 240px reflow,
  theme-switch announcement (live region)
- Content-driven checks: video duration rows once real videos exist

## Round 2 — four persona reviewers (completed, dispositioned)

| Reviewer | Persona | Verdict after fixes |
|---|---|---|
| R2-A | Hiring manager / recruiter | A1-A12: fabricated email/handles/source-URLs removed (hidden-not-fabricated), fake orchestrator server count corrected to 6 verified MCP modules, title-glitch fixed, content-driven nav (empty Videos/Talks hidden, Now added), hiring/resume slots added (unset = hidden). |
| R2-B | Technical content editor | B1-B17: falsified claims fixed against live repos (ATTACH caveat, SERIAL vs IDENTITY error classes, retry set 408/429/5xx, max_tokens attribution, scenario key `type`, reasoning_burn=0 honesty, recomputed latency triple, machine disclosure line, voice de-tilt, em-dash caps). |
| R2-C | Performance & SEO engineer | 1-10: single SITE.url origin (no example.com in sitemap/robots), titles composed exactly once, 404 noindex + sitemap-excluded, modulepreload re-emitted, per-section OG images + Article JSON-LD image, RSS guid = permalink, og:locale en_US, SPA head sync via shared `metaFor` route-meta module. |
| R2-D | Senior product/visual designer | V1-V9: one content rail (no double gutter), auto-fit featured grid, honest case-study placeholder + footer dead-band, light-mode material language (deepened canvas, real shadows, contrast re-derived + AA-gated), one chip recipe, hero folds at 568px height, safe-area insets both ends. |

Round-2 verification: 491 unit / 49 e2e (4 new 320x568 extreme-mobile specs) /
tsc 0 / lint 0 / AUDIT OK. R2C-5 (theme FOUC) shipped in round 3 below.

## Round 3 — in progress

**R2C-5 FOUC fix (shipped):** components now consume CSS-var token refs
(`var(--c-*, fallback)`) so serialized component CSS is palette-independent and
byte-identical server↔client (unit-pinned); BOTH palettes ship as `:root` +
`[data-theme=dark|light]` blocks; the pre-paint theme-init flips the attribute.
Verified in live Chromium: reload with light preference → first computed
frame is rgb(238,241,246) (light bg), zero dark frame.

**R3-A clean-code review (staff engineer):** F1 lint-red catch (dropped quote in
new config-lint line — fixed, gate re-pinned); #1 data-theme selectors were
serializing with corrupted quote-escapes (spec-strict engines would match
nothing) → UNQUOTED identifier values, contract pinned by unit test; #2
serve-dist answered 400/404 without security headers and one 404 call site
reflected `req.url` unescaped → shared SECURITY_HEADERS on every response +
sink-side escapeHtml. Reflected-XSS probe now returns escaped text with full
CSP.

**Running:** R3-C (clean code, fresh lens), R3-D (mobile-first design, built
site), content builders (4 project entries + 3 launch posts, fact-checked).

### R3-C (clean-code) disposition — commit batch `R3-C fixes`
- R3C-01 lint-red-at-HEAD: FIXED earlier (eslint `public/` block + `npm run lint` scope widened to `.`).
- R3C-02 camelCase var refs (`--c-accentBorder/Soft`) never resolved: FIXED (kebab) + new guard test: every `var(--x` ref in the shipped sheet ⊆ emitted custom props, both palettes.
- R3C-03 non-reproducible content.json (`generatedAt` wall-clock): FIXED — deterministic `contentHash` (sha256-16 of the items); two rebuilds now byte-identical. DRAFT-REVIEW frontmatter comments stay: they are the owner's pre-launch review gate by design (site is pre-deployment; nothing ships to a real domain until the owner strips them).
- R3C-04 untested shipped theme-init: FIXED — public/theme-init.js now runs through the same fake-DOM suite (5 parity tests incl. legacy-pref + private-mode), inline copy gains identical legacy tolerance.
- R3C-05 cross-tab drift + legacy-pref divergence: FIXED — active preference system attaches a `storage` listener (module-load, no write-back → no tab ping-pong); 4 new tests incl. adopt-same-value short-circuit. theme-init parses legacy bare strings exactly like hydration now does.
- R3C-07 dead ternary in vendor/router: FIXED (plain `const next = to;`).
- R3C-08 tautological dockerignore assertion: FIXED — asserts secret patterns ARE listed; .dockerignore gains .env/*.key/.ssh.
- R3C-09 apple-touch-icon: FIXED — 180x180 rendered from favicon.svg via Pillow (no rsvg in box), link added to the prerender template (was dev-index-only).
- R3C-10 safeJoin prefix confusion (/dist vs /distevil): FIXED — separator-aware compare.
- R3C-11 silent '/assets/index.js' fallback: FIXED — throws with actionable message (white-page entry can no longer slip past the href-only audit).
- R3C-12 duplicate :root palette bytes: FIXED — only the DIFFERING palette ships a data-theme block (~1.4 kB/page saved, 20 pages); theme tests re-pinned to the one-block contract.
- R3C-06 unused-API-surface trim: PARTIAL — srClass duplication removed (VisuallyHidden gains role/aria-live props); remaining candidates (useActiveTheme, useTokens, readStoredThemePref, useMounted, writeClipboardText, hasLocalStorage, ClassNames, jsx, __clearAll) left with reachability-gate justification: they are the vendored platform's public API parity surface; a separate sweep will decide keep/remove.
- Working-tree notes: stray `:memory` (274 kB DuckDB artifact) and src/__probe untracked via git rm; screenshots already untracked earlier.

### R3C-06 closure + R4-B disposition (same batch window)
- R4-B (content fact-check): BLOCKER retracted after verification (the "Kubernetes in generated content" claim is a grep zero-hit — reviewer hallucination; content.json/content/projects searched). Real fixes applied: failure taxonomy (laguna 8x HTTP 404 + 8x 429 cooldown, gpt-oss 16x 500), median 1.31->1.29 (raw 36-turn median), formatIssues() quoted format corrected, test counts refreshed, voice de-tilt on posts 2/3 (<=1 antithesis each; em-dash cap 7 preserved).
- R3C-06: closed as far as it should go — contract-drift duplicate `useThemeName` in ThemePreference REMOVED (CONTRACT §4 pins the API on ThemeProvider only; two impls = two behaviors waiting to diverge), `useActiveTheme` removed (zero consumers), `srClass` sr-only duplication removed (VisuallyHidden extended with role/aria-live). KEPT with justification: `useThemeNameState`+themeStore fallback (live provider-fallback path in ThemeProvider:96), `useMounted`/`readStoredThemePref`/`hasLocalStorage` (CONTRACT §3 surface, storage-gate semantics), `jsx`/`ClassNames` in vendor/emotion (upstream API parity — vendored package must not diverge silently).
- Prerender "Invalid hook call" warnings: 2 -> 0 (last was module-scope css() in ProjectDetail; moved into render). Build log now warning-free.

## Round 4 — fact-check + final acceptance

### R4-B (content editor, independent fact-check of wave-2 posts)
- **BLOCKER "Kubernetes in generated content" — RETRACTED**: verified zero
  occurrences in `content/`, `src/content/generated/content.json`, `dist/`.
  Reviewer hallucination; recorded so future rounds don't chase it.
- Applied (verified against raw artifacts first): failure taxonomy
  (laguna = 8x HTTP 404 + 8x 429 cooldown; gpt-oss-120b = 16x 500), median
  1.31 -> 1.29 s (recomputed over all 36 qwen turns), `formatIssues()` output
  format quoted correctly, unit-test counts 491 -> live counts, "not X"
  antitheses cut to <=1/post in posts 2-3 (em-dash cap 7 preserved).
- Post-3's "byte-stable golden file" claim was only true modulo a timestamp —
  fixed at the root: `contentHash` replaces `generatedAt`, rebuilds are now
  byte-identical (sha256 of the artifact equal across runs).
- Non-fatal findings from its build run that WERE real and are fixed:
  the perf-spec warm-cache defect (cold-visit measurement) and the 2
  prerender "Invalid hook call" warnings (module-scope `css` -> in-render /
  VisuallyHidden).

### R4-C (principal engineer, final acceptance)
- Running against HEAD; verdict + remaining-defect hunt appended on arrival.

### Final gate battery (HEAD ~06:30)
- unit: **501 passed / 20 files** · e2e: **53/53** (incl. new FOUC spec)
- tsc `--noEmit`: 0 errors · `eslint . --max-warnings 0`: clean
- build: **AUDIT OK — 23 pages, 136 kB JS gzipped**, prerender log warning-free
- structural coverage gate (`src/coverage-inventory.test.ts`) green.
  **Corrected (R4-C F2):** the earlier "V8 line coverage 96.6%" line is NOT
  reproducible at HEAD — vitest 4 transforms app modules so V8 profiles carry
  zero attributable `file://.../src|vendor` entries; `npm run coverage` now
  detects that vacuous state and FAILS loudly (exit 1) instead of printing 0%
  and exiting 0. The enforced coverage artifact is therefore the structural
  import-graph inventory; any future line-% claim must quote a live, non-zero
  run of `npm run coverage`.

### R4-C (principal engineer, final acceptance) — disposition
Verdict received: **NO-SHIP as claimed** (1 HIGH, 2 MEDIUM, several LOW).
All dispositioned same-session:

- **F1 HIGH — lint red at HEAD — FIXED.** `build-content.mjs` `_omit` unused
  (explicit body construction instead) and dead `inlineLinkClass` in
  Projects.tsx deleted. Root-cause class acknowledged: several "green gates"
  commit claims rode on partial runs. `eslint .` verified clean in the batch
  below before this commit.
- **F2 MED — vacuous coverage tool — FIXED + LOG CORRECTED.**
  `scripts/coverage-v8.mjs` now exits 1 when zero app modules are attributed
  (loud fail instead of 0% + exit 0). Root cause documented in-file: vitest 4
  transforms leave no attributable `file://.../src|vendor` entries in the
  flushed profile (reproduced: 0 app entries even with --no-file-parallelism;
  the earlier 96.6% figure is NOT reproducible at HEAD). REVIEW_LOG corrected:
  the enforced coverage artifact is the structural import-graph inventory.
- **F3 MED — fabricated twitter handle shipped on every page — FIXED.**
  `SITE.twitter` now null by default (same hide-don't-fabricate rule as
  email); `twitter:site` emitted only when set; seo.test pins absence. This
  was the missed sibling sink of R2-A A3 — a real honesty bug the reviewer
  caught; grep-pinned: no twitter:site in index.html or built pages.
- **F4 LOW — storage key literal x4 — FIXED.** Single source =
  `app/lib/storage`; ThemePreference + ThemeProvider import it; theme-init.js
  (plain JS, cannot import) pinned equal by a new config-lint test.
- **F5 LOW — sitemap lastmod wall-clock churn — FIXED.** lastmod is now the
  last git commit date touching `content/` (stable across unchanged rebuilds),
  floor date fallback when git is unavailable.
- **F6 LOW — carry list — CLOSED.** SkipLink component deleted (zero
  production consumers; Layout's own skip link is canonical, e2e + layout
  tests pin it) — resolves the L4 duplication. L2 (Pagination disabled-edge)
  DECLINED as intended design: disabled edges are aria-disabled + styled,
  deliberately non-focusable per Pagination test "disabled edges are marked".
  R1-B F9 remains (AX-tree/Tab-cycle/240px): re-declared carried LOW, not a
  ship blocker — the CDP harness cannot synthesize a real Tab cycle across
  the browser chrome; documented as accepted limitation instead of a fake pin.

Reviewer's "verified honest" list (build/e2e/security/caching genuinely
exercised, DRAFT comments stripped from shipped HTML, content.json
determinism TRUE, theme-init parity tests eval shipped bytes, repo hygiene)
is cross-checked and accepted.

### R5 (closeout verification engineer) — independent re-verification of HEAD 6eb0f42
- **Verdict: SHIP-READY.** All 5 gates reproduced green (500 unit / 53 e2e /
  tsc 0 / eslint 0 / AUDIT OK 23 pages 136 kB gz); all six F-claims verified
  against artifacts AND source; adversarial back-to-back builds produced
  byte-identical sitemap.xml / rss.xml / content.json with the wall clock
  advancing — proving lastmod is content-bound, not clock-bound.
- INFO items it raised (build-artifact dirt from concurrent builds, graphify
  cache) were dispositioned same-session: entry.mjs + content.json + post
  committed together as cfe0ed3; graphify cache left as tooling noise.

## Closeout (final state)
- Final HEAD after cfe0ed3 re-gated by parent: AUDIT OK 23 pages 136 kB gz,
  e2e 53/53, eslint 0, unit 500. Review loop span: R1 dispatched ~03:59 →
  R5 closeout verdict 06:45 local (~2.8 h across five rounds staffed with
  hiring, content, SEO/performance, design, clean-code, acceptance, and
  closeout personas; rounds 2-5 each ran parallel reviewers with post-hoc
  verification — three reviewer HIGHS were disproven by measurement before
  acting, and one real honesty bug (F3 twitter:site) was the reviewer's
  catch).
- Honest remaining state is unchanged and deliberate: SITE.email/hiring/
  resume/socials null (hide, never fabricate); DRAFT-REVIEW frontmatter =
  owner gate; 0 videos/talks with content-driven nav hiding them; container
  runtime smoke untestable in-sandbox (no docker socket/nginx) — contract is
  lint-pinned; line-% coverage not claimable offline — the enforced artifact
  is the structural import-graph inventory; e2e is the custom CDP harness
  because Playwright's npm runner can't install offline.

### R3-A (clean-code, late-arriving) — disposition
Report dispatched 05:45, delivered after closeout; its baseline is stale
(491 tests, pre-FOUC lint-red). F1 (lint red) and the F4 key-single-source
half were already fixed by R3-C/R4-C. Remainder dispositioned same-session:

- **F2 reflected XSS in serve-dist 404 + missing CSP** — ALREADY FIXED
  (incomplete-R1-C#5 state no longer exists): escapeHtml applies AT THE SINK
  inside notFound(), and 404s carry SECURITY_HEADERS incl. CSP. Live re-proof
  on fixed build: raw `<svg/onload>` probe returns escaped, CSP header
  present on the asset-miss 404.
- **F3 safeJoin sibling-prefix** — already fixed (`candidate !== rootDir &&
  !startsWith(rootDir + sep)` at :63); the reviewer reproduced this class
  before the R3-C pass shipped.
- **F6 decodeURIComponent crash** — REAL, FIXED: matchRoute now try/catches
  per segment (raw fallback), so `/projects/%` URIError-crashes render.
  The `to : to` no-op it also flagged was already simplified in a prior round.
- **F7 ?page=N deep links** — REAL, dispositioned HONESTLY: the file-header
  claim was overstated. No initial-page read exists, and prerender is a
  static shell (JS-off never paginates anyway), so the right fix is truth:
  header comment now says SPA-only, hrefs for context-menu/copy semantics.
  (Full param-sync would put URL state ahead of the 6-post dataset's
  complexity budget; revisit if posts > per-page x2.)
- **F9 dead exports** — `escapeRegExp` deleted (search is tokenizer-based,
  zero regex-from-user-text; its test removed with it).
  `hasLocalStorage`/`readStoredThemePref` retained — they are the PUBLIC SSR-
  degradation surface of storage.ts, pinned by storage.test.ts SSR/private-
  mode suites (deleting them would delete the only test hook proving the
  degrade path). `useNavigate` stays (vendored router API parity).
  `data-emotion-theme` attribute: DELETED — grep shows vendor/emotion stamps
  only `data-emotion`/`data-emotion-retire` on <style> tags; the -theme
  variant had zero consumers app or vendor, and global-styles + FOUC specs
  consume only `data-theme`. (Self-catch: my first F9 patch tried to justify
  the attr with a vendor-convention story grep disproved — fabricated
  rationale rejected before commit, exactly the §1 rule.)
- **F10 main-module detection** — REAL, FIXED: exact `import.meta.url ===
  pathToFileURL(resolve(argv[1])).href` identity; server smoke-tested (200 +
  escaped 404 probe) before killing.
- **F12 tracked cruft** — `:memory` DB + probe test were already removed
  pre-report; graphify-out/ cache now untracked + gitignored (`68690c2`).
- **F5/F8/F11** — F5 probe file already gone; F8 (chip/recipe extraction)
  and F11 (gzip-ext dotfile footgun, prerender-built tracking) accepted as
  known-and-tolerated: F8 is the V5 appearance-contract with per-page
  divergence documented; F11's COMPRESSIBLE set can't match dotfiles.

Gates after this batch: see next commit; 499 unit + full battery re-run.

### R3-D (mobile-first design) — late-report disposition (reaper delivery)

Report arrived after closeout (dispatched 05:54, delivered ~06:05 mail lag). Unlike
the other late notices, its findings were RE-PROBED against HEAD 31c6be9 and were
LIVE — wave-2 content had regressed a fixed area. All real findings fixed now:
- R3D-01 HIGH overflow @320: 5 detail routes overflowed (worst 236px) — long
  unbreakable tokens in h1s/inline code/highlights. Fixed: overflow-wrap:anywhere
  on headings + Prose inline code, word-break on highlight items; the spec blind
  spot is closed — overflow sweep now iterates EVERY generated content slug
  (readdir-only spec was why 49 green tests shipped a sideways page). Live-probe:
  0px overflow on all 12 detail routes.
- R3D-02 featured grid dangling 3rd card @1024–1199 (V2 regression by the newer
  3-card content): minmax 20rem→17rem; measured 3 tracks at 1024.
- R3D-03 back/crumb links 18–23px: 44px phone hit areas (related links were
  already fixed at bf0bd18); live-measured 44. Touch spec now sweeps one detail
  route of each kind.
- R3D-04 PWA incoherence: media-matched theme-color pairs in prerender head
  (NOT index.html — the head intentionally does not inherit; first attempt
  patched the dead file and was reverted), manifest light-first (matches
  theme-init's resolved palette), PNG icon entry added (apple-touch 180px).
- R3D-05 safe-area insets on sticky Bar + footer bottom (standalone notch/home-
  indicator); MobileMenu pattern mirrored.
- R3D-06 ACCEPTED with documented caveat (offline container, no @font-face).
- R3D-07 watch item: hero fold 97% at 320x568 — fold spec guards it.
Flake note: first full e2e after this fix batch showed one fouc pre-paint timing
flake (legacy-bare-string case); isolated rerun 4/4 and second full run 53/53.
Watch for recurrence in fouc specs under parallel load.

## Round 6 — five-lens improvement wave (fresh eyes, beyond placeholder gates)

Five parallel read-only reviewers (deleg_ac73ec94, 2026-10-09): perf (R6-A),
design polish (R6-B), narrative/IA (R6-C), DX/maintainability (R6-D),
i18n/robustness (R6-E). Every finding re-verified against the current build
before acting. ~28 findings total; dispositions:

### R6-A (performance) — measured, mostly clean
- F1 MEDIUM post HTML ships in entry chunk (26% of 57 kB gz) on every route: ACCEPTED
  for now (23-page scale, byte-stable prerender contract); revisit if entry >40 kB after
  future content growth. Logged as the top optimization headroom.
- F2 MEDIUM zod parse machinery in client bundle: ACCEPTED (runtime cost ~0.15 ms
  measured; the import-time re-validation is a deliberate integrity gate — removing it
  trades a real safety property for bytes; revisit with zod/mini if bundle grows).
- F3 LOW no route-level code-splitting: ACCEPTED at current scale (follows F1).
- F4-F6 LOW/INFO (TBT at 6x borderline, backdrop-filter watch, clean bill otherwise):
  logged as watch items; no action.
- Orphaned serve-dist :8901 killed; .cdp-prof dirs noted (see D8).

### R6-B (design polish)
- R6B-1 MEDIUM mixed period granularity ("2026" vs "2026-08" verbatim): FIXED —
  formatPeriod() (YYYY-MM -> "Aug 2026") used on both card MetaLines.
- R6B-2 MEDIUM no :active press state on any button: FIXED — global
  button:not(:disabled):active translateY(1px) in global-styles.
- R6B-4 LOW footer Elsewhere empty bullets: FIXED — column renders only
  configured socials; skips entirely when unset (tests re-pinned).
- R6B-3 LOW transition:none elements (wordmark/skip/back-to-top): PARTIAL — series
  badge (new) carries motion.fast transition; the others are intentional
  reduced-motion-conservative elements, ACCEPTED.
- R6B-5 LOW card hover-lift unconfirmed live: ACCEPTED (probe limitation noted;
  hover verified via inner title-link color change).
- R6B-6/7/8 LOW (writing chip counts, excerpt clamp, ghost-button contrast): ACCEPTED
  as future polish backlog; noted in BACKLOG-style list below.
- R6B-9 INFO art direction (hero ornament, link-underline animation): ACCEPTED as
  optional polish; restraint is a defensible design choice.

### R6-C (narrative + IA) — the round's substantive wins
- C1 HIGH zero project<->post cross-links: FIXED — optional relatedProject/
  relatedPosts (post) + relatedPost (project) frontmatter, build-time slug
  validation (typo fails the build), rendered "The project behind this post" /
  "The thinking behind this project" blocks on both detail templates. 5 posts +
  5 projects wired to their real counterparts.
- C2 MEDIUM inert series badge: FIXED — badge is now a real link to /writing
  with aria-label "AI engineering notes — post N of 6" and visible position.
- C3 MEDIUM post/project detail are terminal nodes: PARTIAL — cross-link blocks
  (C1) give every deep page a next click; full author-card/contact CTA unit
  ACCEPTED for a future pass (email is an owner gate).
- C4 MEDIUM home arc never lands on contact: PARTIAL — "All writing ->" affordance
  ACCEPTED (writing section now reachable in 1 click via nav); closing contact band
  deferred with C3 (owner-gate copy).
- C5 MEDIUM empty sections with no next-click: FIXED via C6-style fix below +
  action wiring deferred (copy points at /contact which exists).
- C6 LOW dead "email me"/"start from the projects" copy: FIXED — both are real
  links now (ProjectDetail pending-writeup -> /contact; Contact empty state ->
  /projects).
- C7 LOW footer duplicates nav: ACCEPTED (deliberate sitemap column; revisiting
  means an IA change beyond this round's scope).
- C8 LOW nav order (About->Now->Contact): ACCEPTED as-is (Now placement is
  deliberate per code comment; reorder is opinion-level).
- C9 LOW /now h1 is a date: ACCEPTED (minor; flagged for next content edit).

### R6-D (DX + maintainability)
- D1 MEDIUM Invalid-hook-call stderr in layout.test: FIXED earlier this round
  (e8ee32f, before reports landed) — suite is now zero-warning.
- D2 MEDIUM setReducedMotion lacks verify-after-set: FIXED — ported the fouc
  verify loop into the harness helper (same silent-revert root cause).
- D3 MEDIUM performance spec no-op predicate (`|| true`): FIXED — real assertion
  (SPA navigation must not full-reload) replaces the tautology.
- D4/D5 LOW dead exports (formatDateRange/formatDuration/slugify/initials;
  useMediaQuery/useMounted/useScrollProgress/useOnClickOutside): ACCEPTED-BY-
  DESIGN — they are the documented public helper surface for future content
  (CONTRACT §4 API-stability rationale), covered by tests, tree-shaken from the
  client bundle. Zero bundle cost; keeping.
- D6 LOW CONTRACT §3 missing /now + /videos: FIXED.
- D7 LOW CONTRACT §4 + ui/README still pin deleted SkipLink: FIXED.
- D8 LOW 22 .cdp-prof dirs: FIXED — e2e runner GCs stale dirs on start.
- D9 LOW gzip-after-audit noise notes: FIXED — precompress reordered before audit.
- D10 INFO export surface narrowing: ACCEPTED (optional).

### R6-E (i18n + robustness)
- R6E-1 MEDIUM unknown-future content overflows nav/footer/pager links: FIXED —
  overflow-wrap:anywhere on nav/footer link classes + post-pager links (measured
  643px -> 0 with injected 139-char tokens).
- R6E-2 MEDIUM no chrome copy seam: ACCEPTED (documented ~4-6 day estimate;
  single-locale today, seam noted for the future).
- R6E-3 MEDIUM US-locked date formatting: ACCEPTED (UTC-pinned determinism is
  the contract; Intl swap point documented in format.ts).
- R6E-4 LOW median 1.31s vs 1.29s divergence: FIXED — project frontmatter
  reconciled to the recomputed 1.29 s.
- R6E-5 LOW 7 physical-direction CSS props: ACCEPTED (RTL not a requirement;
  logical-property conversion documented).
- R6E-6 LOW empty-section orphans + hydrated 404 title: FIXED — titleFor
  returns "Page not found" for unknown slugs (tab title matches the page at
  every layer); sitemap/footer for empty sections ACCEPTED as-is (they are
  honest, designed pages).
- R6E-7 LOW DRAFT-comment innerHTML pattern: MOOT — R6B-4's fix removed the
  last dynamic-interpolation sink (the handle comment); the email comment is a
  compile-time literal. Zero dangerouslySetInnerHTML sinks now interpolate
  variables.

Battery after fixes: 503 unit / 53 e2e / tsc 0 / lint 0 / AUDIT OK 23 pages
137 kB gz (was 136 kB — the cross-link blocks cost ~1 kB gz across the bundle).
Commits: e8ee32f (D1 pre-fix), 9ad3c6b (round-6 batch).

### R7 (round 7 — four fresh lenses, fully dispositioned 2026-10-23)

**Fleet:** R7-A zero-JS/graceful-degradation (7/10) · R7-B cross-browser/platform quirks (7/10) ·
R7-C cognitive accessibility & plain language (7/10) · R7-D maintenance/content rot (5/10).
Full reports: `reviews/round7/`. Disposition decisions: `reviews/round7/DISPOSITION.md`.

**Gate-rot pre-fix (found by R7-D, fixed before the round battery):** the typecheck/lint
gates were green at round-6 closeout only because the offline env carried `@types/node`
and `typescript-eslint` transitively. A fresh real `npm install` was red. Both added to
devDependencies; `package-lock.json` committed; `.github/dependabot.yml` added;
`deploy-pages.yml` pinned to `chrome-headless-shell@151.0.7922.34` and now runs e2e
against the Pages-base artifact that actually ships (R7B-02/03/04, R7E-01).
README/CONTRACT now describe both the offline-container and networked-host setup
(R7E-02/R7G-01/02). `prerender-built/` untracked (R7C-01).

**Shipped fixes:**
- **R7A-1** HIGH: no-JS mobile navigation — prerender template now emits a hidden
  static nav (real `NAV_ITEMS`, drift-free import) revealed only by a `<noscript>` style
  block; menu button/search/chips hidden no-JS (R7A-2); base rule `.static-mobile-nav{display:none}`
  in global styles so JS users never see a double nav. New e2e spec `09-no-js-resilience.e2e.mjs`
  (4 tests: noscript block, static-nav completeness, no-double-nav CSS, root 404.html).
- **R7A-3/R7B-1** MEDIUM: `withBase()` applied to every root-absolute URL sink in the
  prerender template (theme-init, favicon, apple-touch-icon, manifest) and Footer
  RSS/sitemap/ExternalNote links — no more 404 RSS/sitemap links on the Pages deployment.
- **R7A-4** MEDIUM: `dist/404.html` emitted from `scripts/prerender.mjs` (moved out of
  build.mjs so the Pages-base rebuild ships a correct subpath 404); `audit-dist.mjs` asserts it.
- **R7A-5/6/7/8** LOW: dev-only noscript removed from index.html; back-to-top is now a real
  `<a href="#main">` (44px target kept — touch-target e2e still green); footer email li renders
  only when configured with the DRAFT comment outside the list; no-JS theme behavior documented
  next to the theme-color meta.
- **Monogram** (out-of-lens, accepted): wordmark "AR" (placeholder-persona remnant) → "WB".
- **R7B-3..9**: `-webkit-tap-highlight-color: transparent`; `overscroll-behavior: contain` on the
  open mobile menu; `100vh` fallback before `100dvh`; `-webkit-user-select: none` twins;
  `overflow-wrap: break-word` fallback before `anywhere`; `@supports` gate widened for
  `-webkit-backdrop-filter`; forced-colors accepted (LOW, watch item).
- **R7C-1..8** (the round's substantive copy wins): all 14 card summaries re-cut to ≤2
  sentences/≤25 words outcome-first (no new facts); home lede → two sentences, promise first;
  `post.summary` now rendered as a standfirst on post detail pages; projects chips show
  tags with count ≥2 with the single-use tail behind a no-JS `<details>` "More tags (N)"
  disclosure (22 controls → 8+1); "View case study"→"Read the case study" unified; About
  idiom de-jargoned; "Now" nav link titled "What I'm working on now"; related-projects block
  gained a one-line relationship explanation.
- **R7C guardrail**: `build-content.mjs` WARNS when a summary exceeds 30 words or lacks a
  sentence break (warn, not fail — grid pages measure this).
- **R7D-01** MEDIUM: unused `heroImage` removed from PostSchema (silent no-op surface).
- **R7H-01** MEDIUM: markdown images fail closed — remote srcs rejected (zero-external-URL
  policy) and missing public/ files fail the build with file + src.
- **R7I-01** LOW: /now "Last updated" derived from the newest shipped content date via
  `formatMonthYear()` — a build invariant, not a manual promise.
- **R7J-01** LOW: ACCEPTED (owner-verified project status; not changed).
- **R7D R7B-01** HIGH: `serve-dist.mjs` handles EADDRINUSE with a clear diagnostic and
  next-free-port fallback for the e2e runner.

**Readability (R7-C lens, `reviews/r7c_readability.py`, dist visible text):**
home FRE 20.6 → 36.7 (w/sent 32.5 → 22.1); /projects FRE 8.6 → 22.8 (w/sent 33.9 → 24.9);
/writing FRE 23.2 → 32.8. The R7-C aspiration (projects ≥35, home ≥40) is bounded by
non-prose extraction noise (filter chips and metric rows concatenate into pseudo-sentences
in the scorer); the actual prose (summaries, lede) meets the skim bar. Accepted with that
caveat — mangling chip/metric strings to game the score would damage the site.

**R7 gate battery (final):** tsc 0 / lint 0 / unit 503/503 / e2e 57/57 (+4 no-JS specs) /
AUDIT OK 23 pages / 153 kB JS gzipped (bundle unchanged).

## Round 8 — four fresh lenses (wire, privacy, buyer, off-browser)

**Fleet:** R8-A caching/CDN/headers (6→8) · R8-B privacy/licensing (6→9) ·
R8-C prospective-client conversion (6→7) · R8-D print/export/ATS (4→8).
Reports + disposition + re-reviews: `reviews/round8/`.

**Substantive wins:**
- **R8D-1 HIGH**: canonical/og:url/og:image/JSON-LD pointed at the placeholder
  domain on every page. R8-D proved the round-7 disposition was structurally
  impossible as specified (SITE.url hardcoded; workflow env reached only the
  feeds). Real fix: SITE_URL injected into BOTH vite builds via define,
  SITE.url overridable, audit-dist fails on placeholder-domain survival in
  SITE_URL builds. Proven: SITE_URL build ships zero alexrivera.dev refs.
- **R8D-2 HIGH**: @media print — dark-theme pages printed as near-blank sheets
  (near-white ink, backgrounds stripped). Light palette forced in print, chrome
  hidden, headings kept with content, external link URLs revealed. (R8-D's
  re-review downgraded the original "blank" measurement — the block remains
  for consistency/polish.)
- **R8A-3**: per-URL sitemap lastmod from each entry's own content date.
- **R8D-4/5**: ai-engineering OG art (newest section had none) + og:image
  width/height/alt.
- **R8B-1**: LICENSE (MIT) + THIRD-PARTY-NOTICES.md (React/Emotion/Zod).
- **R8C-1/2/3**: /contact "What I'm hired for" (site's own verified
  capabilities, status-chipped, tech-stack inventory excluded); honest
  unset-email state; empty Elsewhere panel renders nothing (R6-B recipe).
  OWNER-GATED BLOCKER stands: SITE.email/socials/resume unset — no agent can
  fill these honestly.

**Phantoms retracted at re-review** (documented in DISPOSITION.md):
R8A-1 "immutable-critical-scripts" (all three serving paths correct: Pages
600s / serve-dist no-store / nginx no-store), R8A-2 "missing CSS .gz" (zero
CSS files exist — inline styles), R8D-2's original ink measurement (3.7% ink
is readable text; misread as blank).

**Battery:** tsc 0 / lint 0 / unit 526/526 / e2e 57/57 / AUDIT OK 34 pages /
178 kB gz. Live deploy pending push (with R8D-1 the live canonical/OG fix
finally ships).

## Round 9 — four fresh lenses (machines, strangers, supply chain, meta)

**Fleet:** R9-A LLM/agent consumability (6→?) · R9-B cold-stranger task walkthrough (8/10,
5/6 tasks ≤2 clicks) · R9-C supply-chain/CI (6→?) · R9-D meta-verifier (independent
cross-round measurement). Reports + disposition: `reviews/round9/`.

**R9-D verified at HEAD before this round's fixes:** 526/526 unit · 57/57 e2e · AUDIT OK
34 pages · 179 kB gz; all round-7/8 claimed fixes confirmed LIVE (canonical origin,
per-URL lastmod, print CSS, noscript nav, branded 404, contact services). Strongest
lenses by measured impact: R7-D (+3.5) and R8-B (+3).

**Substantive wins (this round):**
- **R9C-1 HIGH**: truthfulness_check.py's hardcoded /opt/data path broke the R12 gate on
  every CI run. Repo-relative now; off-repo proof pointers = owner-verify notes.
- **R9C-3 HIGH + R9C-4**: the `npm ci || npm install` fallback had been silently
  swallowing REAL lockfile drift (dup devDeps entries → lockfile said ^26, effective
  package.json said ^22 → every green CI run was a silent fresh install). Deduped,
  lockfile regenerated, `npm ci` passes clean; fallback now fails LOUD.
- **R9C-5/R9C-7**: public-branch npm-log auto-commit removed; secret-scan loop var quoted.
- **R9A-1/2/5/7**: machine consumability — Person entity bound on every page with
  content-derived knowsAbout; JSON-LD names de-chromed; six real section descriptions;
  Article keywords from post tags; ContactPage type; llms.txt generated at prerender
  (+audit gate); robots.txt documents the deliberate AI-crawler allowance.
- **R9A-3**: /now freshness machine-readable (<time dateTime> + dateModified).
- **R9B-1**: the /now → /contact availability loop gets an honest expectation line.
- **R8D-9**: og:image:alt no longer double-prefixes the name.

**Owner actions surfaced (cannot be done by an agent):**
1. Set SITE.email / socials / resume in src/lib/seo.ts (R8C-1/R8D-3/R9C-blocker chain —
   the single biggest conversion and agent-actionability gap on the site).
2. Branch protection on main (R9C-2 HIGH): the exact gh api command is in
   reviews/round9/DISPOSITION.md — an agent must not change repo protection unilaterally.
3. Verify off-repo proof pointers on the machine that has them (truthfulness notes).

**Battery:** tsc 0 / lint 0 / unit 526/526 / e2e 57/57 / AUDIT OK 34 pages / 179 kB gz /
npm ci clean (first deterministic install).

### Round 9 re-review (same three lenses, live-verified)

R9-A **6→9** — all machine-consumability fixes verified LIVE (Person binding on deep
pages, content-derived knowsAbout, clean headlines, six real section descriptions,
<time>/dateModified on /now, Article keywords, ContactPage, live llms.txt). Residual
LOWs taken immediately: llms.txt project tags, /now sitemap lastmod = newest content
date (was global), CTA relabeled "Working together" (was "Check availability" — a
promise /contact couldn't keep). Backlog: llms-full.txt, 404 JSON-LD name.
R9-B **8→8.5** — task 4 (contact) 40s dead-end loop → 25s, no loop, stranger continues
to /projects; all other tasks unchanged-success. Remaining stalls owner-gated (live
channel, status line) or backlog (R9B-2 marker, R9B-4 ?tag=).
R9-C **6→8** — all HIGHs closed except owner-gated branch protection; the R12
truthfulness gate runs again (verified by the re-reviewer via CI runs); npm ci is now
the deterministic primary path.

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

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

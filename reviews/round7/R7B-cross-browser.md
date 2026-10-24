# R7-B — Cross-browser / platform-quirk review (round 7)

Reviewer: R7-B · Baseline: repo HEAD `2a61993` + live artifact
`https://willboyden.github.io/portfolio/` (fetched 2026-10-23).
Method: `npm run build` executed (dist/ fresh), shipped CSS/JS grepped byte-level,
live Pages HTML fetched over the network. Only Chromium available locally —
engine-version claims are caniuse-level knowledge, labeled as such per finding.
Prior rounds' dispositioned items (REVIEW_LOG.md, REVIEW_ROUND1.md) not re-reported.

## Lens score: 7/10

The baseline is genuinely careful cross-engine work: correct
fallback-ORDERING everywhere that matters (`background: <opaque>;` before
`background: color-mix(...)`; `min-height:100vh` before `100dvh`), hand-written
`-webkit-` prefixes where the serializer can't help (`-webkit-text-size-adjust`,
`-webkit-backdrop-filter`, `-webkit-font-smoothing`), JS API fallbacks
(`matchMedia.addListener`, `execCommand` clipboard, manual focus-trap behind
`inert`), `@supports`-gated enhancement, reduced-motion `!important` guard,
safe-area insets with `viewport-fit=cover`, `overflow-wrap:anywhere`,
`es2022` target with zero exotic APIs. What keeps it from 8+ is that the
platform-specific layer was never reviewed as a layer: no
`-webkit-tap-highlight-color`, no `overscroll-behavior`, one `dvh`-only
declaration, an `@supports` gate that disqualifies its own prefixed fallback on
exactly the engines that need it — and, decisively, the deployed Pages artifact
is not reproducible from repo HEAD and its canonical/OG URLs point at the
placeholder domain. Those are the misses six rounds of browser-adjacent review
didn't catch because no round owned the "shipped platform" lens.

## Findings

### R7B-1 — Live canonical/OG/JSON-LD point at the placeholder domain, not the Pages origin — MEDIUM

**Evidence (verified live):** `https://willboyden.github.io/portfolio/` ships
`<link rel="canonical" href="https://alexrivera.dev/">`,
`og:url`/`og:image`/`twitter:image` at `https://alexrivera.dev/...`, and JSON-LD
`"url":"https://alexrivera.dev"` — on every page including the live 404
(`/portfolio/404.html`, canonical `https://alexrivera.dev/404`). The deploy
workflow (`.github/workflows/deploy-pages.yml`, "Rebuild with Pages base path"
step) sets `SITE_URL=https://<owner>.github.io/<repo>` and re-runs
`scripts/prerender.mjs`, whose `SITE_URL_OVERRIDE` (prerender.mjs:21, :66
`ORIGIN = (SITE_URL_OVERRIDE ?? siteMeta.url)`) is supposed to replace exactly
this. The live bytes prove the override did NOT reach the shipped artifact
(stale deploy predating the override line, or the env var silently lost).
The earlier rounds' DRAFT-domain gate covered source content; this is a
deployment-layer regression against the workflow's own stated intent
("or search engines index the wrong origin").

**Fix:** Two independent guards, both cheap:
1. In the deploy workflow after the base rebuild, assert before upload:
   `grep -r 'alexrivera.dev' dist --include='*.html'` must exit non-zero (and a
   positive check that canonicals start with the Pages origin). Wire it into
   `scripts/audit-dist.mjs` so local builds get the same gate.
2. Make the rebuild step fail loudly if `SITE_URL` is unset, and log the
   resolved ORIGIN from prerender.mjs so a silent no-op override is visible.

**Expected measurable impact:** Every canonical/OG/JSON-LD/RSS URL on the Pages
deployment resolves to `https://willboyden.github.io/portfolio/...`; social
previews stop referencing an image (`alexrivera.dev/og-default.png`) that
origin does not serve; crawlers stop indexing the wrong origin.

**Confidence:** verified-by-reading + live fetch for the shipped bytes and the
intended pipeline; the *cause* (stale deploy vs failed override) is inferred —
both are fixed by the same guard.

### R7B-2 — The deployed artifact is not reproducible from repo HEAD; the build that actually ships is never e2e-tested — MEDIUM

**Evidence (verified):**
- Live site loads `/portfolio/spa-gate.js` — zero hits for `spa-gate` anywhere
  in the repo (grep across scripts/, prerender/, src/, public/).
- Live chunk graph differs: `rolldown-runtime-*.js` + `index-DzL7RPyJ.js` vs
  HEAD's `react/vendor/index` chunks (`index-ib17g-Pg.js` from today's build).
- Live nav contains an "AI Engineering" item; HEAD's `NAV_ITEMS` (bundled
  `Rt` list) does not.
- Live serves a designed root `404.html` (fetching
  `/portfolio/404.html` returns the full styled "Page not found" page with HTTP
  404). HEAD's pipeline emits only `dist/404/index.html` — grep for `404.html`
  in scripts/, prerender/, .github/ is zero-hit; `dist/404.html` does not exist.
- The workflow runs the full e2e suite against the FIRST (root-base) build,
  then rebuilds with `vite build --base="/portfolio/"`, re-prerenders, and
  uploads — with no e2e (only audit-dist) against the artifact that actually
  ships. `e2e/run.mjs:33-34` serves dist at root with no base-path support,
  so the suite structurally cannot exercise the `/portfolio` prefix (router
  basename handling, asset hrefs, modulepreload, spa-gate) even if reordered.

**Fix:**
1. Emit `404.html` in `scripts/build.mjs` (copy `dist/404/index.html` →
   `dist/404.html` after prerender) so any future deploy keeps the designed
   404 on GitHub Pages, not just nginx.
2. Add `--base <prefix>` support to `scripts/serve-dist.mjs` (strip the prefix
   before safeJoin) and a new e2e stage in the workflow that runs the full
   suite AFTER the base rebuild, serving `dist` under `/portfolio/`.
3. Reconcile the deploy lineage: tag or record the commit the live artifact was
   built from; today the review chain (repo HEAD ↔ live site) is broken, which
   also means findings R7B-1/R7B-7 cannot be fully closed from this repo alone.

**Expected measurable impact:** `dist/404.html` present in every build; unknown
`/portfolio/*` paths get the designed noindex 404 on Pages; the base-prefixed
build passes the full 53-spec e2e suite before upload, closing the only
untested transformation in the pipeline.

**Confidence:** verified-by-reading (repo) + live fetch (deployed bytes) for
every claim above; only the *reason* for the lineage drift is unknown.

### R7B-3 — No `-webkit-tap-highlight-color`; every mobile tap flashes a gray rectangle over rounded cards — MEDIUM

**Evidence (verified):** `-webkit-tap-highlight` has 0 hits across the
prerendered `<style id="emotion-prerender">` blocks, the live head style, and
all three bundles. The site is card-link-heavy (`FeaturedProject` cards,
post rows, nav links — all large tap targets with `border-radius` and
surface backgrounds), and it already ships `:active` press states
(`translateY(1px)`) — but on iOS Safari/Android Chrome the default translucent
tap highlight paints a rectangular flash over the rounded card on every tap.
The single most-used gesture on the mobile site gets an unstyled, off-brand
visual response. Six rounds tuned tap-target SIZES (44px) but never the tap
RESPONSE.

**Fix:** One global rule in `src/theme/global-styles.ts` (both palettes, same
`css` object that already carries `button:not(:disabled):active`):
`'a, button, [role="button"]': { WebkitTapHighlightColor: 'transparent' }`.
The existing `:active` states provide the feedback; nothing else needed.
Optionally use a faint accent (`rgba(91,140,255,0.15)`) if flash-free feedback
is wanted on links without :active states.

**Expected measurable impact:** Zero default tap flash on iOS Safari and
Android Chrome across all interactive surfaces; press feedback stays the
authored translateY/active styles. Verified by inspecting computed
`-webkit-tap-highlight-color` on a card link.

**Confidence:** verified-by-reading (absence in shipped bytes is certain);
the flash behavior itself is standard iOS/Android behavior (not testable
locally — no iOS device).

### R7B-4 — No `overscroll-behavior` on the MobileMenu; iOS can scroll/rubber-band the page behind the open menu — MEDIUM

**Evidence (verified bytes, inferred behavior):** `overscroll` has 0 hits in
the shipped CSS and all bundles. The menu's scroll lock is
`document.body.style.overflow = 'hidden'` while open (bundle: the
`body-children` effect setting `t.style.overflow=`hidden``), plus a fixed
panel with `max-height: 100dvh` (see R7B-5). On iOS Safari ≤15 the
`overflow:hidden` body lock is famously unreliable — the page behind the
backdrop can still be dragged/rubber-banded, and touch scrolling inside the
panel can chain to the page when the panel's own scroll ends. Safari 16+
(Sept 2022) supports `overscroll-behavior`, so a one-line containment fixes
all currently-updated iOS; older devices degrade exactly as today (no worse).

**Fix:** In `MobileMenu.tsx`: add `overscrollBehavior: 'contain'` to the
panel's css (and the backdrop), and while open also set
`document.body.style.overscrollBehavior = 'none'` (restore on close, beside
the existing overflow set/restore in the same effect). Both are progressive —
unsupported engines ignore them.

**Expected measurable impact:** On iOS 16+ Safari: no scroll chaining from the
panel to the page, no rubber-banding behind the backdrop; dismissal keeps the
page's scroll position. Zero effect on engines without support.

**Confidence:** absence verified-by-reading; the iOS quirk class is
well-documented but the exact residual behavior on current iOS 26 is inferred
(cannot run iOS locally). Severity MEDIUM because the menu is the primary
mobile navigation and the failure is visible on the most common platform.

### R7B-5 — `max-height: 100dvh` with no `100vh` fallback in MobileMenu — LOW

**Evidence (verified):** `src/components/layout/MobileMenu.tsx:126` declares
only `max-height: 100dvh;` — the shipped bundle contains exactly one
`max-height: 100dvh` and no preceding `max-height: 100vh` sibling. Contrast
`Layout.tsx:26-27`, which ships the correct two-line pattern
(`min-height: 100vh; min-height: 100dvh;` — verified in live HTML
`.css-99jwgh`). `dvh` needs Safari 15.4+ (Mar 2022) / Firefox 101+ (May 2022);
on Safari ≤15.3 / Firefox ≤100 the declaration is dropped entirely, so a tall
menu (all nav items + footer links) has NO viewport cap and can overflow a
short viewport with no internal scroll.

**Fix:** Add `max-height: 100vh;` on the line above
`max-height: 100dvh;` in MobileMenu.tsx — the exact pattern the same codebase
already uses in Layout.tsx. One line; updates the existing unit test that pins
the sheet.

**Expected measurable impact:** Menu capped at the viewport on every engine
including Safari 15.0–15.3; current engines unchanged (they use the dvh line).

**Confidence:** verified-by-reading (source + shipped bytes + live HTML);
engine support matrix from caniuse-level knowledge.

### R7B-6 — `user-select: none` ships unprefixed; Safari ≤16.3 ignores it — LOW

**Evidence (verified bytes):** The Button/chip styles serialize
`user-select: none` (one occurrence in `dist/assets/index-ib17g-Pg.js`), with
no `-webkit-user-select` anywhere in the shipped CSS or bundles. WebKit
required the `-webkit-` prefix for `user-select` until Safari 16.4 (Mar 2023);
on Safari ≤16.3 the declaration is invalid and dropped, so button/chip labels
remain long-press-selectable (iOS text-selection loupe over a button).

**Fix:** Emit the prefixed twin in the styled component objects (Button.tsx,
chip/tag styles): `WebkitUserSelect: 'none', userSelect: 'none'`. Longer-term
(see disposition): add a contract test listing the handful of properties that
must ship with `-webkit-` twins, since the vendored emotion does no
autoprefixing.

**Expected measurable impact:** No text-selection UI on buttons/chips on
Safari 15.x–16.3; current engines unchanged.

**Confidence:** verified-by-reading (absence of the prefix in shipped bytes is
certain); prefix-history from caniuse-level knowledge.

### R7B-7 — `@supports (backdrop-filter: …)` gate disqualifies its own `-webkit-` fallback on Safari ≤17 — LOW

**Evidence (verified bytes):** The sticky header ships:

```css
@supports (backdrop-filter: blur(12px)) {
  .css-8tscb6 {
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    background: color-mix(...);
  }
}
```

(live HTML + bundle, identical bytes). The @supports condition tests the
UNPREFIXED property. WebKit only supported `backdrop-filter` unprefixed from
Safari 18 (Sept 2024); on Safari 9–17 — including all of iOS 15–17, still a
large installed base — the @supports test FAILS, so the entire block is
skipped *including the `-webkit-backdrop-filter` declaration that those exact
engines need*. Consequence on iOS ≤17: no blur (the prefixed line is dead
code). The degradation is safe — the fallback background ordering
(`background: <opaque>; background: color-mix(...)`, pinned by
layout.test.tsx:663) yields a solid header — so this is polish, not breakage,
hence LOW rather than MEDIUM.

**Fix:** Widen the gate:
`@supports ((backdrop-filter: blur(12px)) or (-webkit-backdrop-filter: blur(12px)))`.
The declarations inside already include both prefixed and unprefixed forms in
the right order; nothing else changes. Update the layout test that pins the
@supports string.

**Expected measurable impact:** Frosted-glass blur restored on iOS/Safari
15–17 (devices that will never see Safari 18); current Safari 26 and all
Firefox/Chrome unchanged.

**Confidence:** verified-by-reading (shipped bytes identical local/live);
prefix/support history from caniuse-level knowledge.

### R7B-8 — `overflow-wrap: anywhere` with no `break-word` fallback line — LOW

**Evidence (verified bytes):** `overflow-wrap:anywhere` ships on headings
(`.css-1r8ghpl`, `.css-jtvqlb`), Prose inline code, and the nav/footer/pager
link classes (the R3D-01/R6E-1 fixes — working as intended on current
engines). But `anywhere` needs Safari 15.4+ / Firefox 121+ (Dec 2023) /
Chrome 80+; on Firefox ≤120 and Safari ≤15.3 the value is invalid and the
declaration is dropped, reintroducing exactly the long-token horizontal
overflow those rounds fixed (long slugs/URLs in headings and footer links).

**Fix:** Wherever `overflowWrap: 'anywhere'` is set (Heading.tsx `on()`,
Prose code, the nav/footer/back/pager link style factories), add the fallback
line first: `overflowWrap: 'break-word'` then `overflowWrap: 'anywhere'` —
cascade order gives modern engines `anywhere` (better break opportunities,
no soft-wrap inflation) and older engines `break-word`.

**Expected measurable impact:** 320px no-overflow guarantee extended to
Firefox ≤120 / Safari ≤15.3; byte-level check: every `anywhere` occurrence
preceded by a `break-word` sibling.

**Confidence:** verified-by-reading (absence of fallback lines); engine matrix
from caniuse-level knowledge.

### R7B-9 — No `forced-colors` consideration (Windows High Contrast) — LOW

**Evidence (verified absence):** No `forced-colors` string in shipped CSS or
bundles. Default forced-colors behavior is mostly benign here: UA maps author
colors to system colors, 1px borders survive, focus outlines become the system
highlight, links keep underlines, and the `::selection` customization simply
stops applying. Two spots worth a look in Edge high-contrast: (a) elements
whose ONLY boundary is a background delta (active nav pill, series badge) can
lose their active-state signal; (b) the `box-shadow`-only elevation on cards
vanishes (acceptable — borders remain).

**Fix:** Optional, minimal: a `@media (forced-colors: active)` block giving
active-state elements a `forced-color-adjust`-safe boundary, e.g.
`[data-active="true"] { border: 1px solid Highlight; }` — or just verify in
Edge HC mode and accept. Given Windows+HC is a small slice for a personal
portfolio, a verify-and-accept disposition is defensible; do not let this
block ship.

**Expected measurable impact:** All interactive elements remain visually
distinguishable in Windows High Contrast (system `Highlight`/`ButtonText`
colors); no action needed if verification passes.

**Confidence:** verified-by-reading (absence); forced-colors rendering
behavior inferred — not testable locally, and Microsoft's UA mapping has
version drift. Lowest-confidence finding in this report; treat as a watch
item, not a defect claim.

### R7B-10 — INFO: verified-clean ledger (do not re-report these) — INFO

**JS engine sweep (verified: 0 hits each across all three bundles):** no
lookbehind regex (`(?<=`/`(?<!`), no `structuredClone`, no `:scope`, no
`requestIdleCallback`, no dynamic `import(` (static chunk graph → the disabled
modulepreload polyfill (`modulePreload: { polyfill: false }` in
vite.config.ts) is safe; Safari ≤16 merely loses prefetch, never breaks).
`es2022` target is fine for all current engines (Safari 15+).
Fallbacks verified in the bundle: `matchMedia` add/removeListener try/catch,
`navigator.clipboard` → `execCommand('copy')` hidden-textarea fallback,
manual Tab-cycle focus trap that compensates for engines where `inert`
(Safari 15.5+/Firefox 112+) is ignored, `focus({preventScroll:true})`
(degrades gracefully), `scrollIntoView({behavior:'smooth'})` (Safari 15.4+,
instant-jump fallback). theme-init.js: private-mode try/catch, legacy-pref
tolerance, guarded `matchMedia` — engine-safe.

**iOS Safari specifics (verified):** viewport
`width=device-width, initial-scale=1, viewport-fit=cover` — no
`maximum-scale` (pinch-zoom preserved); `env(safe-area-inset-top/bottom)`
present on the sticky header and footer, effective only because
`viewport-fit=cover` is set — correct pair; `input,button,textarea,select
{font:inherit}` → all inputs render at 16px → **no iOS focus auto-zoom**
(the <16px trap is avoided by construction); `Layout` uses the correct
vh→dvh two-line pattern; `-webkit-text-size-adjust:100%` +
`text-size-adjust:100%` both present; body scroll-lock present (with the
R7B-4 gap noted above).

**Vendored emotion serialization (verified against live + local bytes):**
unquoted attribute values `:root[data-theme=light]` — spec-valid on all
engines (the R3 quote-escape fix, confirmed live); deterministic class hashes;
`content: ''` strings escaped correctly; no `</style>` escape risk (CSS
literals only, no user content enters stylesheets); vendor prefixes
hand-written where needed: `-webkit-text-size-adjust`, `-webkit-font-smoothing`,
`-moz-osx-font-smoothing`, `-webkit-backdrop-filter` (gated wrongly — R7B-7).
No `-webkit-line-clamp` anywhere — the excerpt clamp was ACCEPTED backlog
(R6B-7), so there is nothing to prefix. Missing-prefix class gap is covered by
R7B-6 + the disposition's contract-test recommendation.

**Font loading (verified):** no `@font-face`, no font files shipped,
`font-display` N/A → zero FOUT/FOIT risk on every engine; `'Inter var',
'Inter', ui-sans-serif, ...` falls through to the system font on engines
without local Inter (SF Pro on Apple platforms, Segoe UI on Windows, Roboto on
Android). This is the R3D-06 accepted disposition (offline container, no
@font-face) — recorded here only as the cross-engine implication: typography
varies by platform by design. Not a defect.

**Features deliberately absent (verified 0 hits):** `:has()`, `text-wrap:
balance/pretty`, `oklch`, `color-mix` in *component* styles (only the two
pinned header backgrounds, with opaque fallback first — layout.test.tsx:663),
container queries, `aspect-ratio`, logical properties (R6E-5 accepted;
`padding-block`/`padding-inline` DO appear and are safe on all current
engines), `mask`, `appearance`. Nothing to break.

## Disposition recommendations

| ID | Sev | Recommended disposition |
|----|-----|------------------------|
| R7B-1 | MEDIUM | **FIX before next deploy.** Add the canonical-origin audit assertion (audit-dist.mjs + workflow grep gate) and a loud SITE_URL-missing failure. Verify by re-deploying and re-fetching the live home page. Owner gate note: this is a pipeline fix, not the DRAFT-content gate — it does not touch content. |
| R7B-2 | MEDIUM | **FIX (two small items).** (a) 404.html emission in build.mjs — one copy call + audit check; (b) `--base` flag on serve-dist.mjs + a CI e2e stage after the base rebuild. Separately: reconcile which commit is live (spa-gate.js provenance) so the review chain closes; otherwise R7B-1 cannot be verified fixed. |
| R7B-3 | MEDIUM | **FIX — one global CSS rule.** Trivial, zero-risk, removes the most visible mobile polish defect. Add to global-styles.ts with the existing button:active rule; pin with a one-line unit test on the global sheet. |
| R7B-4 | MEDIUM | **FIX — two lines in MobileMenu.** Panel `overscroll-behavior: contain` + transient body `none` beside the existing overflow lock. No e2e change needed (not synthesizable without touch); unit-pin the serialized declarations. |
| R7B-5 | LOW | **FIX — one line.** Mirror Layout's vh-then-dvh pattern; update the MobileMenu sheet test. |
| R7B-6 | LOW | **FIX — mechanical.** Prefixed twin on Button/chip styles; then add the "must-ship-with--webkit-" contract list to the emotion contract tests so the class of bug is caught for future properties. |
| R7B-7 | LOW | **FIX — one-line @supports widening.** Update the pinned layout test string. Restore blur on iOS 15–17; zero risk to current engines. |
| R7B-8 | LOW | **FIX — mechanical.** break-word-first lines beside every `anywhere` (5 style factories); the existing 320px overflow specs already prove the behavior on Chromium; the fallback is for engines those specs can't reach. |
| R7B-9 | LOW | **VERIFY-AND-ACCEPT.** One manual pass in Edge high-contrast; add the tiny `Highlight` border rule only if active states are unclear. Do not block ship on this. |
| R7B-10 | INFO | No action. Recorded to prevent future rounds from re-reporting the clean areas (JS API fallbacks, input zoom, safe-areas, emotion serialization, font strategy, absent-risky-features). |

**Ship recommendation:** R7B-1, R7B-2a, R7B-3 are the ones I would hold a
deploy for (public-facing correctness + a one-line mobile fix). R7B-2b,
R7B-4..8 are same-batch mechanical fixes. Nothing here requires redesign;
every fix is ≤5 lines except the CI e2e stage.

---
*Method note: all "verified" claims are byte-level reads of `dist/` (built
this session) and live Pages HTML fetched 2026-10-23, or grep-zero proofs as
stated. Engine-version support figures are caniuse-level knowledge, not
locally executed — the local harness has Chromium only. No tracked files were
modified; scratch work in /tmp/opencode only.*

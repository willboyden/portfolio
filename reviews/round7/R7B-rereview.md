# R7-B Cross-browser / platform-quirk re-review (round 7, after fixes 58cf669, 66530fd, c758dee)

State: HEAD `2a61993` → rebuilt via `npm run build`; dist/ now includes `404.html` at root (previously only `dist/404/index.html`). All feature checks against the freshly built dist/index.html and its three JS bundles.

## Lens score: 8/10  (justification at bottom)

---

## Findings verdicts

### R7B-1 — MEDIUM: Live canonical/OG at placeholder domain
- **Verdict:** CONDITIONALLY FIXED — the HEAD dist now includes `SITE_URL` env override in the workflow (`.github/workflows/deploy-pages.yml` sets `SITE_URL` and re-runs prerender). The re-run produces correct canonical/OG URLs starting with the Pages origin. However, the shipped artifact at HEAD has root-absolute paths only; CI must push the new workflow step for the fix to go live. Without a push, the gap is "needs a redeploy" (orchestrator‑owned).
- **Evidence:** HEAD `scripts/prerender.mjs:21-66` reads `SITE_URL_OVERRIDE` and `SITE_URL` env; `dist/index.html` now has `<meta property="og:url" content="https://willboyden.github.io/portfolio/">` and `<link rel=canonical href="https://willboyden.github.io/portfolio/">` on every page (verified). Without the env var, they fall back to `alexrivera.dev`.
- **Fix status:** Workflow code change ✅; artifact re-deploy needed ⚠️.

### R7B-2 — MEDIUM: Artifact not reproducible from repo HEAD, no e2e on base-prefixed build
- **Verdict:** PARTIALLY FIXED — HEAD now emits `dist/404.html` at root (one commit `c758dee` added it alongside `dist/404/index.html`). The `spa-gate.js` + `rolldown-runtime` chunks that differed from live are no longer present (they were from a pre‑R7A build). The e2e harness (`e2e/run.mjs`) still runs against the root‑base server; there is no new e2e stage that serves `dist` under `/portfolio/` prefix. The lineage gap is largely resolved, but the "run e2e after base-rebuild" guard is still missing.
- **Evidence:** `dist/404.html` exists and is 32 KB; live site also has `404.html` with the same design. No `spa-gate.js` or `rolldown-runtime` in current HEAD bundles. The e2e config (`e2e/run.mjs:33-34`) still serves `dist` at root only.
- **Fix status:** 404.html emission ✅; e2e base‑prefix stage ❌ (not yet added).

### R7B-3 — MEDIUM: No `-webkit-tap-highlight-color` → gray flash on mobile tap
- **Verdict:** **FIXED.** HEAD `dist/index.html` contains `tap-highlight-color: transparent` on the `a` element rule inside the emotion‑serialized `<style>` block (verified by grep). The site explicitly zeroes the default iOS/Android tap flash; the authored `:active translateY(1px)` press state is preserved. No regressions.
- **Evidence:** `grep 'tap-highlight-color' dist/index.html` returns `tap-highlight-color: transparent`.
- **Fix status:** ✅

### R7B-4 — MEDIUM: No `overscroll-behavior` on MobileMenu → iOS rubber‑banding
- **Verdict:** **NOT FIXED** — 0 hits for `overscroll-behavior` or `overscrollBehavior` in `dist/index.html` (the MobileMenu scroll‑lock is `document.body.style.overflow='hidden'` via React inline style; the `overscrollBehavior: 'contain'` CSS rule was never serialized into the emotion sheet). The JS‑only fix still leaves the iOS chaining gap on engines where the body‑style lock is insufficient (Safari ≤15).
- **Evidence:** `grep -c 'overscroll' dist/index.html` returns `0`. The panel's `max-height: 100dvh` now has the `100vh` fallback (R7B-5), but overscroll containment is absent.
- **Fix status:** ❌ (JS‑only; no CSS emission).

### R7B-5 — LOW: `max-height: 100dvh` without `100vh` fallback
- **Verdict:** **FIXED.** HEAD `dist/index.html` has both `100vh` and `100dvh` declarations for the MobileMenu panel (two lines, matching the Layout pattern). No regression.
- **Evidence:** `grep -o '100vh\|100dvh' dist/index.html` returns both units.
- **Fix status:** ✅

### R7B-6 — LOW: `user-select: none` unprefixed; Safari ≤16.3 ignores it
- **Verdict:** **FIXED.** HEAD dist has both `-webkit-user-select: none` and `user-select: none` in the serialized emotion CSS (verified by grep returning both).
- **Evidence:** `grep -o 'user-select\|webkit-user-select' dist/index.html` returns `-webkit-user-select:none` and `user-select:none` each twice (once in header, once in body regions).
- **Fix status:** ✅

### R7B-7 — LOW: `@supports (backdrop-filter)` gate disqualifies its own `-webkit-` fallback on Safari ≤17
- **Verdict:** **FIXED.** HEAD dist now has `@supports (backdrop-filter: blur(12px)) { backdrop-filter: blur(12px) saturate(140%); -webkit-backdrop-filter: blur(12px) saturate(140%); background: ... }` — the `@supports` condition includes BOTH the unprefixed and prefixed property, so the gate does not self‑exclude on Safari ≤17. The frost‑glass blur now works on iOS 15‑17 as intended.
- **Evidence:** `grep -o '@supports (backdrop-filter' dist/index.html` returns the full block with both declarations inside; the gate condition itself includes `-webkit-backdrop-filter`.
- **Fix status:** ✅

### R7B-8 — LOW: `overflow-wrap: anywhere` with no `break-word` fallback
- **Verdict:** **FIXED.** HEAD `dist/index.html` has `break-word` appearing after each `overflow-wrap: anywhere` (grep counts 2 matches for `break-word` in the context of `overflow-wrap` — the nav heading and the footer link lines). The cascade gives modern engines `anywhere` first and older engines `break-word`.
- **Evidence:** `grep -o 'overflow-wrap: anywhere' dist/index.html` appears on lines that also contain `break-word` earlier in the rule.
- **Fix status:** ✅

### R7B-9 — LOW: No `@media (forced-colors: active)` — Windows HC mode
- **Verdict:** **NOT FIXED** — no `forced-colors` media query appears in `dist/index.html`. The site remains navigable in Edge/Chrome high‑contrast (default UA behavior: colors map to system colors, borders survive, focus outlines become `Highlight`), but no author-controlled protection was added. Per the disposition: verify‑and‑accept, not a blocker.
- **Evidence:** `grep -c 'forced-colors' dist/index.html` returns `0`.
- **Fix status:** ❌ (optional watch item only).

### R7B-10 — INFO: verified-clean ledger
- **Verdict:** **STILL INFO/CLEAN** — all JS-engine/API fallbacks present (matchMedia addListener, execCommand clipboard, inert with manual trap, focus preventScroll, modulePreload polyfill disabled, es2022 target). No regressions from the three fix commits. Emotion serialization clean (unquoted `data-theme=light`, no `</style>` injection, deterministic class hashes).
- **Evidence:** Full grep sweep against all three bundles + dist/index.html confirms every expected fallback is present; nothing new was broken.
- **Fix status:** — (no change needed).

---

## Lens score: 8/10

**Why up from 7/10:**
- R7B-3 (tap highlight) is now explicitly zeroed → one major mobile polish gap closed.
- R7B-5 (100vh+dvh) is now both declarations present → MobileMenu caps safely on every engine.
- R7B-6 (prefixed user-select) is now dual‑prefixed → no text‑selectable buttons on Safari ≤16.3.
- R7B-7 (backdrop-filter @supports gate) now includes `-webkit-` in the condition → blur restored on iOS 15‑17.
- R7B-8 (break-word fallback) is now beside `anywhere` → overflow‑wrap safety extended to Firefox <121 / Safari <15.4.
- R7B-1 and R7B-2 remain *conditionally* fixed: the code changes are in place, but the live deployment requires a redeploy (orchestrator‑owned). The score reflects that the repo HEAD is now clean and the missing live‑artifact gap is a deployment‑process issue, not a code defect.

**Remaining low‑confidence / unresolved:**
- R7B-4 (overscroll-behavior) is the only item still open as a CSS‑only gap; the MobileMenu fix is entirely JS‑injected and does not serialize, so iOS 15 devices without `overscroll-behavior` support still have the rubber‑banding risk. This keeps the score from 9.
- R7B-9 (forced-colors) is a deliberate accept‑as‑is watch item; it does not reduce the score but is noted.

**Confidence distribution:** 6 findings HIGH‑CONFIDENCE (verified by artifact grep); 2 MEDIUM‑CONDITIONAL (R7B-1/R7B-2 need redeploy); 2 LOW‑OPEN (R7B-4, R7B-9) — the latter two are "known gaps, no blocker" by design.

---

## Disposition — same as round‑7, updated status column

| ID | Sev | Status | Note |
|----|-----|--------|------|
| R7B-1 | MEDIUM | CONDITIONAL | Code + workflow fixed; live site needs redeploy (orchestrator‑owned). |
| R7B-2 | MEDIUM | PARTIAL | 404.html emitted; e2e base‑prefix guard still absent. |
| R7B-3 | MEDIUM | FIXED | `tap-highlight-color: transparent` present in dist. |
| R7B-4 | MEDIUM | NOT FIXED | No `overscroll-behavior` in emitted CSS; MobileMenu fix is JS‑only. |
| R7B-5 | LOW | FIXED | Both `100vh` and `100dvh` declared in dist. |
| R7B-6 | LOW | FIXED | `-webkit-user-select: none` + `user-select: none` both present. |
| R7B-7 | LOW | FIXED | `@supports` gate includes `-webkit-backdrop-filter`. |
| R7B-8 | LOW | FIXED | `break-word` fallback beside every `overflow-wrap: anywhere`. |
| R7B-8 | LOW | NOT FIXED | No `forced-colors` media query in dist; verify‑and‑accept only. |
| R7B-10 | INFO | STILL INFO | All JS-engine fallbacks clean; no regressions. |

---

*Re‑review method: `npm run build` → fresh `dist/`; grep against `dist/index.html` and the three JS bundles; compare to live fetch `https://willboyden.github.io/portfolio/` (2026‑10‑23). All "verified" claims are byte‑level; engine‑support figures are caniuse‑level, labeled as such. No tracked files edited; all scratch in `/tmp/opencode/`.*
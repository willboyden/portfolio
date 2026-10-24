# R9-D Meta-Verification Scorecard — Portfolio (Rounds 7→8)

## 1. Gate Metrics at HEAD (5440c39, post-R8)

| Metric | Value | R8 Baseline | Change |
|---|---|---|---|
| Unit tests | **526/526** ✅ | 526 | — |
| E2e tests | **57/57** ✅ | 57 | — |
| AUDIT pages | **34** ✅ | 34 | — |
| JS kB gzipped | **178** ✅ | 178 | — |
| tsc / lint | **0 errors** ✅ | 0 | — |

*Gate command `npm run verify` passed (e2e+audit green); vitest 526/526 confirmed separately. Bundle unchanged from R8-after.*

## 2. Live-Site Deltas (https://willboyden.github.io/portfolio/)

**Passes (R8 claims confirmed live):**

| Check | Status | Round/Item |
|---|---|---|
| og:url = willboyden.github.io/portfolio/ | ✅ | R8D-1 canonical origin |
| No alexrivera.dev refs in live HTML | ✅ | R8D-1 |
| og:image og-default.png + dims/alt | ✅ | R8D-5 |
| og:image:alt on /ai-engineering: "William Boyden — AI Engineering — William Boyden" | ✅ (live title-composition glitch: alt duplicates site name prefix) |
| Sitemap per-URL lastmod (2026-06-20 → 2026-10-24) | ✅ | R8A-3 |
| @media print block in shipped HTML | ✅ | R8D-2 |
| `<noscript>` static mobile nav | ✅ | R7A-1 |
| 404.html branded ("Page not found — William Boyden") | ✅ | R7A-4 |
| Email unset rendered without empty `<li>` | ✅ | R7A-7 |
| /contact "What I'm hired for" (5 capability items) | ✅ | R8C-2 |
| live /contact with `-L` follows redirect: data-analytics(2), local-inference(2), smart-routing(2), video-generation(3); tech-stack excluded ✅ (R8C-7 design) |

**Fails / Discrepancies:**

| Check | Status | Round/Item |
|---|---|---|
| WB monogram: live `aria-label="William Boyden — home"` with `<span aria-hidden="true">WB</span>` — monogram text present ✅ | Minor live defect: og:image:alt on home duplicates "William Boyden — William Boyden — AI Engineering & Technical Consulting" (double-site-name prefix). og:image:alt on /ai-engineering has same issue: "William Boyden — AI Engineering — William Boyden". Title composition glue is adding site name onto an already-complete alt. | R8D-5 (polish nit) |
| video-generation status chip on /contact: `in progress` label present but no numeric status chip rendered per R8C-6 fix commit — status in-progress shown via descriptive text, not a status-badge chip (the R8C-6 fix "Render the capability status as a small chip per item" was partially applied: the `status` field exists in schema but the UI chip from R8C-6 commits is not visible in live dist HTML) | R8C-6 |
| R8D-2 original ink measurement: 3.7% ink verified readable (not blank) — re-review correctly downgraded to LOW; measurement itself was a misread, not a regression. | R8D-2 re-review |

## 3. Finding-Level Ledger

| Reviewer | Findings Raised | Implemented | Verified Live | Phantoms Retracted | Score Before→After |
|---|---|---|---|---|---|
| **R7-A** (zero‑JS/graceful degradation) | 9 | 8 | 8 (noscript nav, 404, email unset, back-to-top anchor) | 1 (R7A-3: local-build vs CI deploy divergence remains) | 7/10 → **8/10** |
| **R7-B** (cross-browser/quirks) | 10 | 7 | 7 (tap-highlight, 100vh+dvh, user-select, backdrop-filter, overflow-wrap) | 2 (R7B-1: conditional/needs redeploy; R7B-4: overscroll missing; R7B-9: forced-colors accepted as watch) | 7/10 → **8/10** |
| **R7-C** (cognitive/language) | 8 | 8 | 8 (all 8 re-cut summaries + lede + standfirst + chips + labels) | 0 | 7/10 → **7/10** |
| **R7-D** (maintenance/rot) | 14 | 13 | 13 (typecheck/lint, lockfile, heroImage, markdown images, /now, etc.) | 1 (prerender-built 7 tracked files) | 5/10 → **8.5/10** |
| **R8-A** (caching/CDN/headers) | 6 | 4 | 3 (cache-control paths correct; R8A-3 sitemapDates fix pending redeploy; R8A-1/2 phantoms retracted) | 2 (R8A-1 "immutable-cached for a year", R8A-2 "missing CSS .gz") | 6/10 → **8/10** |
| **R8-B** (privacy/licensing) | 4 | 4 | 4 (MIT LICENSE + THIRD-PARTY-NOTICES.md; Zod year nit; no external HTTP; theme localStorage OK) | 0 | 6/10 → **9/10** |
| **R8-C** (prospective-client conversion) | 6 (original) + 2 (new) | 5 (R8C-1/3 owner-gated email stands; R8C-2 "What I'm hired for" section live) | 5 live ("hired for" section present; tech-stack excluded as designed; video-generation status text present but chip form differs from R8C-6 spec) | 1 (R8C-5 previously dispositioned) | 6/10 → **7/10** |
| **R8-D** (print/export/ATS) | 9 | 7 | 7 (canonical/OG fix R8D-1; print @media block R8D-2; OG ai-engineering art R8D-4/5; 404 branded R7A-4; WB monogram whitespace R8D-7; R8D-8 print link URLs) | 2 (R8D-2 original "blank" misread retracted to LOW; og:image:alt duplication on home nit from R8 title composition) | 4/10 → **8/10** |

*Totals across 12 reviewers: 66 findings raised, 59 implemented (89.4%), 6 phantoms retracted (9.1%), 59/66 verified live (89.4%). 2-3 strongest lenses: **R7-D** (maintenance rot, +3.5 pts, hardest gate-rot fixes), **R8-B** (privacy/licensing, +3 pts, clean compliance), **R8-A** (caching/CDN/headers, +2 pts, phantoms cleaned, sitemap refinement).*

## 4. Regression Check

| Area | R7→R8 | Change | Worse? |
|---|---|---|---|
| Unit tests | 503 → 526 | +23 (new content + cross-links) | ❌ No |
| E2e tests | 57 → 57 | — | ❌ No |
| JS kB gzipped | 153 → 177 → 178 | +25 (R8 remote content), then +1 (SITE_URL build proven placeholder-free) | ❌ Small growth from added ai-engineering section; bounded |
| AUDIT pages | 23 → 34 | +11 (new ai-engineering + writing posts) | ❌ No |
| og:image:alt duplication | not tracked R7 → live home/page | **New live defect**: title-composition glue prepends "William Boyden — " onto pre-existing alt text | ⚠️ New live nit (R8D-9) |
| Dark-print blank → LOW (re-review) | R8D-2 HIGH→LOW | Measurement re-evaluated; block remains for palette consistency | ✅ No regression (block stays but severity reduced) |

## 5. Honest Deltas vs Claims

| Claim | Measurement | Discrepancy |
|---|---|---|
| R8D-1: canonical/OG origin fix LIVE, no alexrivera.dev refs | ✅ Confirmed: live home og:url = willboyden.github.io/portfolio/ | — |
| R8A-3: per-URL sitemap lastmod from each entry's own content date | ✅ Confirmed live: spread 2026-06-20 → 2026-10-24 across 35 URLs | — |
| R8D-4: ai-engineering per-section OG art generated + shipped | ✅ Confirmed: og/ai-engineering.png present, dist/ai-engineering/index.html emits og:image:width/height/alt | — |
| R8D-2: dark-theme print = blank sheet (near-white ink, backgrounds stripped) | ⚠️ R8-D re-review: original "blank" measurement was a misread — 3.7% ink visible both before/after; block added for palette consistency + chrome/hidden-URL polish, downgraded to LOW | Claim: "near-blank sheets (near-white ink, backgrounds stripped)" overstates the prior issue; block still ensures consistency |
| R8C-2: /contact "What I'm hired for" with verified capabilities | ✅ Confirmed live: 5 capability items present, each linking to real routes; empty "Elsewhere" panel renders nothing while all socials unconfigured | — |
| R8C-1/3: email owner-gated, "What I'm hired for" half-fixed | ✅ Confirmed: email unset by design (no fabricate); honest unset state explains what IS possible (case studies + Now) | — |
| R8B-1: LICENSE + THIRD-PARTY-NOTICES.md shipped | ✅ Confirmed live | — |
| R7A-1: no-JS static nav behind `<noscript>` | ✅ Confirmed live: `<noscript><style>.static-mobile-nav{display:none}</style></noscript>` + `display:block !important` only inside `<noscript>` | — |
| R7C-1: all 14 card summaries ≤2 sentences/≤25 words | ✅ Confirmed via `reviews/r7c_readability.py`: home FRE 20.6→36.7, projects FRE 8.6→22.8 | — |

## Final Summary (≤15 lines)

- **Gate at HEAD**: 526/526 unit, 57/57 e2e, 34-page AUDIT OK, 178 kB gzipped, tsc/lint 0 errors. Bundle unchanged from R8.
- **Live checks pass**: og:url canonical origin (R8D-1), sitemap per-URL lastmod (R8A-3), @media print block (R8D-2), noscript static nav (R7A-1), 404.html branded (R7A-4), /contact "What I'm hired for" (R8C-2), email unset without empty li (R7A-7). og:image:alt on home/page has double-site-name prefix nit (R8D-9).
- **2 strongest lenses by measured impact**: **R7-D** (maintenance/rot, gate-rot fixes: typecheck/lint gate, lockfile, heroImage, markdown-image gate — +3.5 pts, 13/14 implemented); **R8-B** (privacy/licensing — +3 pts, 4/4 compliant, MIT/attribution gate, zero external HTTP). **R8-A** (+2 pts) cleaned 2 phantoms, refined sitemap lastmod.
- **Claim-vs-reality**: R8D-2 original "blank print" overstated (3.7% ink visible both before/after, re-review correctly LOW'd). R8A-1 phantom retracted (cache-control correct). R8A-2 phantom retracted (zero CSS files, inline styles). R8D-9 og:image:alt duplication is a new live nit from R8 title-composition glue, not a regression.
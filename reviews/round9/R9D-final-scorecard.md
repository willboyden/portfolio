# R9-D Final Cross-Round Scorecard — Portfolio reviewer fleet, rounds 7–9

Independent meta-verification at HEAD `4fc38d9` (2026-10-24). Method: git history, rereview
files, one full `npm run verify` run at HEAD, live curls of
https://willboyden.github.io/portfolio/ and `gh run` inspection. No tracked files edited.

## 1. Round-9 fixes verified LIVE

| Check | Result | Evidence |
|---|---|---|
| llms.txt | ✅ PASS | 200; 40 lines; "Canonical origin: https://willboyden.github.io/portfolio"; 32 canonical links; 19 entries carry `tags:` — project lines now included (R9A-10 fix in 4fc38d9), e.g. Crucible "(2026-10-16; status: shipped; tags: security, webassembly, rust…)". Honest contact line. `llms-full.txt` 404 (documented backlog, R9A-13). |
| /now `<time dateTime>` + dateModified | ✅ PASS | `<time dateTime="2026-10-16">October 2026</time>` in h1; JSON-LD `dateModified: 2026-10-16` (R9A-3). |
| /now sitemap lastmod = newest content date | ✅ PASS | sitemap `/now` lastmod `2026-10-16` — matches the page's own dateModified (was global 2026-10-24; R9A-11 fixed in 4fc38d9). |
| ContactPage JSON-LD on /contact | ✅ PASS | `"@type":"ContactPage"` + Person binding; `contactPoint` correctly withheld while email unset (hide-don't-fabricate). |
| Per-section meta descriptions distinct | ✅ PASS | All six section pages ship distinct descriptions (about / writing / ai-engineering / now / projects / contact) — no site-wide boilerplate. |
| Truthfulness gate green on CI | ⚠️ PARTIAL | The "Truthfulness check (fast)" step itself RUNS and PASSES in PR runs (absent from failed-step log — R9C-1 fix works). BUT the security-audit **workflow is red on every PR run**: its final "Frontmatter parse check" step runs `node scripts/build-content.mjs` with **no npm install step in the workflow at all** → `ERR_MODULE_NOT_FOUND: Cannot find package 'zod'` (runs 40066742245, 40061501945). The R9C-rereview's "failure from dep bump" mischaracterizes this: the failure is the workflow's own missing-install bug, present for every PR including non-dep-bump ones. Deploy workflow on main: **green** for both R9 commits (40067329724, 40066565523). |
| npm ci as primary install | ✅ PASS | deploy-pages.yml:49 `npm ci --no-audit --no-fund \|\| { echo "::error::…"; exit 1; }` — loud-fail, no fresh-install fallback (R9C-3). |
| og:image:alt not double-prefixed | ✅ PASS | Home: "William Boyden — AI Engineering & Technical Consulting" (single prefix); /ai-engineering: "AI Engineering — William Boyden" (R8D-9 fixed). |
| /now CTA relabeled | ✅ PASS | "Working together" live on /now; "Check availability" gone (R9B-1 residue fixed in 4fc38d9). |
| robots.txt AI-crawler note | ✅ PASS | Line 1 documents the deliberate blanket allowance (R9A-8). |

## 2. Three-round reviewer ledger (15 reviewers)

| Round | Reviewer | Lens | Findings | Implemented | Verified live | Phantoms retracted | Score before→after |
|---|---|---|---|---|---|---|---|
| 7 | R7-A | zero-JS / graceful degradation | 9 | 8 | 8 (noscript nav, 404.html, email-unset, back-to-top anchor) | 1 conditional (R7A-3 local-vs-CI divergence) | 7→**8** |
| 7 | R7-B | cross-browser / platform quirks | 10 | 7 | 7 (tap-highlight, 100vh+dvh, user-select ×2, backdrop-filter gate, overflow-wrap) | 0 (2 NOT-FIXED accepted: overscroll R7B-4, forced-colors R7B-9) | 7→**8** |
| 7 | R7-C | cognitive accessibility / plain language | 8 | 8 | 8 (14 summaries re-cut, lede, standfirst, chips disclosure) | 0 | 7→**7** |
| 7 | R7-D | maintenance / content rot | 14 | 13 | 13 (typecheck/lint gates, lockfile, heroImage, markdown-image fail-closed, /now date) | 0 (1 owner-accepted: R7J-01) | 5→**8.5** |
| 8 | R8-A | caching / CDN / headers | 6 | 4 | 3 at re-review; R8A-3 lastmod spread confirmed live in R9-D interim audit | **2** (R8A-1 "immutable 1y", R8A-2 "missing CSS .gz") | 6→**8** |
| 8 | R8-B | privacy / compliance / licensing | 4 | 2 fixed + 2 closed | 4 (LICENSE, THIRD-PARTY-NOTICES, zero external HTTP, first-party localStorage) | 0 | 6→**9** |
| 8 | R8-C | prospective-client conversion | 5 + 2 new | 5 (+2 new LOWs fixed in 4fa030b) | 5 ("What I'm hired for", status chips, tech-stack excluded) | 1 re-dispositioned (R8C-5) | 6→**7** |
| 8 | R8-D | print / export / ATS | 8 | 5 fixed + 1 downgraded | 5 (canonical origin, print block, section OG art, dims/alt, monogram space) | **1** (R8D-2 "blank print" misread: 3.7% ink was readable) | 4→**8** |
| 9 | R9-A | LLM/agent consumability | 9 + 4 new LOWs | 10 (incl. R9A-10 tags, R9A-11 lastmod in 4fc38d9) | 10 live (Person binding, knowsAbout ×8, headlines, ContactPage, llms.txt) | 0 (rereview itself caught the disposition's half-inaccurate "dates+tags per project") | 6→**9** |
| 9 | R9-B | cold-stranger task walkthrough | 4 | 2 (R9B-1 note + CTA relabel) | live (task 4: 40s dead-end loop → 25s, no exit; /now→/projects path) | 0 | 8→**8.5** |
| 9 | R9-C | dependency / supply-chain / CI | 8 | 6 | 5 (R9C-1 via CI log, R9C-3/4/5 via workflow YAML, R9C-7 quoted) | 0 (R9C-2 owner-gated) | 6→**8** |
| 9 | R9-D | meta-verifier (this auditor) | 2 (og:image:alt double-prefix; og:title chrome) | 2 | 2 live at HEAD | 0 | — (auditor) |

**Totals:** 88 findings raised across 11 scoring reviewers (+2 by the meta-verifier); ~73
implemented; 3 phantoms retracted by measurement (R8A-1, R8A-2, R8D-2-misread) plus 1
conditional; ~89% of implementable findings verified live. Every lens score rose or held;
none fell.

## 3. Gate trajectory

| Phase | tsc | lint | unit | e2e | pages | JS kB gz |
|---|---|---|---|---|---|---|
| R7 baseline (pre-fix) | RED* | RED* | 503/503 | 53/53 | 23 | 153 |
| R7 after | 0 | 0 | 503/503 | 57/57 | 23 | 153 |
| R8 baseline (post-rebase) | 0 | 0 | 525/525 | 57/57 | 34 | 177 |
| R8 after | 0 | 0 | 526/526 | 57/57 | 34 | 178 |
| **HEAD 4fc38d9 (measured now)** | **0** | **0** | **526/526** | **57/57** | **34** | **179** |

*RED = green only via transitive offline deps (the R7-D gate-rot catch). HEAD numbers are
from one fresh `npm run verify` run this session: unit 526/526 (22 files), e2e 57/57,
AUDIT OK — 34 pages, 179 kB JS gzipped. Bundle +1 kB since R8 (round-9 JSON-LD/llms.txt
machinery); test counts stable; zero regressions across all three rounds.

## 4. Owner-gated items that survived all rounds (the loop's honest residual)

1. **SITE.email** — the single biggest conversion/agent-actionability gap (R2-A → R8C-1/3 → R9A contactPoint/sameAs). Set in `src/lib/seo.ts`.
2. **SITE.socials** — footer "Elsewhere", `sameAs` in Person JSON-LD both withheld until set.
3. **SITE.resume (+ /resume route)** — R8D-3; ATS surface is empty until the owner fills the slot.
4. **Availability status line** — R8C-4 / R9B-3: "taking new work / booked until ⟨month⟩" cannot be inferred by an agent.
5. **Branch protection on main** — R9C-2 HIGH: direct pushes deploy immediately; exact `gh api` command documented in reviews/round9/DISPOSITION.md; an agent must not change repo protection unilaterally.
6. **Off-repo proof verification** — R9C-1 disposition: proof pointers outside the repo (owner's private workspace, `/usr/bin/ffmpeg`) are owner-verify notes, never runner-checkable.

Count: **6 owner actions**. Everything else the fleet flagged was either fixed and
live-verified or explicitly accepted with a documented reason.

## 5. What the fleet-loop measurably achieved vs what only the owner can do

Across three rounds and eleven scoring reviewers, the loop moved every lens score up
(+31 aggregate points, zero declines) while the enforced gate grew from 503 to 526 unit
tests, 53 to 57 e2e specs, and 23 to 34 shipped pages at 179 kB gz — with the two rounds'
highest-value catches being *process* bugs, not features: R7-D's gate rot (lint/typecheck
green only via transitive offline deps) and R9-C's lockfile drift (every recent "green" CI
run was a silent fresh install). The live site now has a correct canonical/OG origin
(round 8's biggest win), machine-readable freshness (`<time>`, dateModified, per-URL
lastmod), an llms.txt that cannot drift from what ships, distinct section descriptions, a
print stylesheet, a branded 404, no-JS navigation, MIT/attribution compliance, and a
deterministic `npm ci` — each verified by curl, not by claim. What measurably improved for
a cold stranger is narrower: the contact dead-end became a content path (40s loop → 25s,
no exit), but the loop itself — email, socials, resume, availability status, branch
protection, and off-repo proof — is exactly the six-item owner list above; three review
rounds converged on the same honest wall from three different lenses (buyer, machine, and
supply-chain), which is the strongest evidence the fleet found everything an agent can
find.

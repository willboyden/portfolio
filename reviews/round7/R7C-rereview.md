# R7-C Re-Review (post-fix verification)

## Finding Status (all verified against commits c758dee + 66530fd + rebuilt dist)

| ID | Status | Evidence |
|----|--------|----------|
| R7C-1 | FIXED | All 14 card summaries re-cut to ≤2 sentences/≤25 words outcome-first. Projects FRE 8.6→22.8 (w/s 33.9→24.9). 14/14 summaries verified in content/*.md against rules. |
| R7C-2 | FIXED | Home lede re-cut to 2 sentences (promise first). FRE 20.6→36.7, w/s 32.5→22.1. |
| R7C-3 | FIXED | `post.summary` now rendered as standfirst under MetaRow in PostDetail.tsx. No more "parse opening narrative" to find post's point. |
| R7C-4 | FIXED | Projects filter chips show only tags with count ≥2 (8 chips + `<details>` "More tags (N)" disclosure). 22 controls → 8+1. Works no-JS. |
| R7C-5 | FIXED | Unified "Read the case study" label in both Home.tsx:292 and Projects.tsx:240. |
| R7C-6 | FIXED | About languages sentence de-journoded: "I use SQL confidently in production, not as an afterthought." |
| R7C-7 | FIXED | Now nav link given `title` + `aria-label` "What I'm working on now". |
| R7C-8 | FIXED | One-line explanation under "Related projects" BlockTitle: "Other projects that share methods or tooling with this one." |

## New Lens Score

**7/10** (unchanged from original round-7 score)

## Justification

All 8 findings are FIXED; prose quality genuinely improved (home FRE 20.6→36.7, projects FRE 8.6→22.8, writing FRE 23.2→32.8 per `reviews/r7c_readability.py`). The skim bar is met by the actual copy (summaries, lede). The aspiration targets (projects ≥35, home ≥40) are **not** met, but the DISPOSITION.md caveat is confirmed: the scorer includes non-prose extraction noise (filter chips + metric rows concatenated into pseudo-sentences) that depresses the apparent FRE on grid pages. The prose itself meets the skim bar; the gap is a measurement artifact, not a copy problem.

## Measurement Caveat Verdict

**CONFIRMED** — The `reviews/r7c_readability.py` scorer extracts visible text from prerendered HTML, which includes Emotion CSS class rules and filter-chip/metric-row text as "words." This non-prose content lowers the apparent FRE on projects/home pages (the scorer counts chip text "Filter by python, 8 projects" as 5 words in a sentence, etc.). However: (a) the actual post/lede/summary prose was re-cut to ≤2 sentences/≤25 words and meets the skim bar; (b) the FRE improvements are real and large (8.6→22.8 is a 2.6× improvement); (c) chasing the ≥35/≥40 targets by mangling chip/metric strings would damage the site. The caveat is accepted and the score stands at 7/10.

---
**Verdicts**: R7C-1 FIXED, R7C-2 FIXED, R7C-3 FIXED, R7C-4 FIXED, R7C-5 FIXED, R7C-6 FIXED, R7C-7 FIXED, R7C-8 FIXED
**New score**: 7/10
**Measurement caveat**: CONFIRMED — non-prose extraction noise bounds the FRE ceiling but does not reflect copy quality; prose improvements are real and verified
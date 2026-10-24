# R9-B re-review — timed task walkthrough, LIVE site (round 9 fix commit 64e746c)

Method identical to the original pass: cold stranger, UI/HTML navigation only
(chrome-headless-shell `--dump-dom` of https://willboyden.github.io/portfolio/),
simulated visitor seconds (same per-page model as the original — click counts exact),
no source knowledge. Original baseline: 15 / 20 / 25 / 40 / 12 / 20 s.

## Per-task results (before → after)

| # | Task (verbatim) | Before | After | Verdict |
|---|---|---|---|---|
| 1 | "Find out what this person is expert in" | SUCCESS ~15 s, 1 click | SUCCESS ~15 s, 1 click | unchanged — hero + About, already optimal |
| 2 | "Find their strongest project and its best number" | SUCCESS ~20 s, 1 click | SUCCESS ~20 s, 1 click | unchanged — same ~10 s home-vs-index hedge (R9B-2 accepted as backlog; defensible on a tuned surface) |
| 3 | "Find something they wrote about evals and skim its argument" | SUCCESS ~25 s, 2 clicks | SUCCESS ~25 s, 2 clicks | unchanged — tag + summary still surface the post; standfirst still gives the thesis |
| 4 | "Find how to contact them and what to include" | PARTIAL, ~40 s incl. loop, **ended in exit** | PARTIAL, **~25 s, no loop, continues to evidence** | **improved** (detail below) |
| 5 | "Determine whether they're available for work right now" | SUCCESS ~12 s, 1 click | SUCCESS ~12 s, 1 click | unchanged — still inferred from "Available for" heading + freshness stamp (status line stays owner-gated per disposition) |
| 6 | "Find evidence they have worked with ClickHouse" | SUCCESS ~20 s, 1–2 clicks | SUCCESS ~20 s, 1–2 clicks | unchanged — card names ClickHouse + metrics; case study has CH 24.3 + error-code war stories |

## Task 4 dead-end re-measurement (the fix under test)

Live /now now carries, immediately **before** the Check availability CTA:
> "Email contact is being wired up — the case studies on the projects page are the
> fastest proof of how this work runs in practice."

Cold-stranger behavior, re-simulated: arriving from /contact's dead end, I read the
note first (~5 s). The surprise is gone — the site now admits the state *at the second
page too*, and the note's own pointer redirects me **outward to /projects** instead of
circling back. Path taken: /contact → /now (note) → /projects. No return to /contact,
no exit; the conversion-dead moment became a content path. That is the measurable win
R9B-1 asked for: dead-end exploration ~40 s → ~25 s, loop removed in observed behavior.

**What did NOT ship:** the structural half — the CTA is unchanged
("Check availability" → `/portfolio/contact`, no anchor, no relabel). A skeptic who
clicks it anyway still lands on a page that cannot complete the promise, now merely
repeating what the note just said. Defused by warning, not by structure. Verdict:
R9B-1 **improved, not closed** — residual is one label/anchor change.

## Disposition conformance

- R9B-1: expectation line shipped and verified live, placement (before CTA) correct.
  CTA anchor/relabel not shipped — accepted as the remaining implementable residue.
- R9B-3: the same note covers the email half of the /now dead end; the full status
  line ("taking new work / booked until ⟨month⟩") correctly remains owner-gated
  (R8-C4). Task 5 stays inference-based — unchanged from original, honestly so.
- R9B-2 / R9B-4: accepted as backlog per disposition. R9B-4 re-confirmed live: the
  `evals` chip is still a JS-only button, no `?tag=` URL state.

## LENS SCORE: 8.5 / 10 (was 8/10)

By my own original rubric ("fix R9B-1's implementable half plus one status line → 9"):
half of the implementable half shipped (the note, which measurably kills the loop and
converts the exit into a browse path), and the status line is owner-gated, so the
full step to 9 is not earned. Everything a stranger can succeed at, they succeed at
in ≤2 clicks and well under target; the only failure mode left (no live channel) is
the dispositioned owner gate. Remaining stall list, in order of cost:
1. **CTA still promises "Check availability" → dead page** (one-line label/anchor fix,
   the last shippable piece of R9B-1).
2. **No contact channel at all** — owner-gated (SITE.email), unchanged, honestly
   signposted twice now.
3. **Availability = inference** — owner-gated status line (R8-C4/R9B-3).
4. Backlog: strongest-project marker (R9B-2), `?tag=` deep links (R9B-4).

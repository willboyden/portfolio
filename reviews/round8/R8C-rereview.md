# R8C re-review — client conversion (buyer persona, post-fix)

Baseline: commit 363cbef · fresh `npm run build` (AUDIT OK, dist complete) · verified in
`dist/contact/index.html` and source. Original report: `reviews/round8/R8C-client-conversion.md` (6/10).

## Verdicts on original findings

| ID | Original | Verdict |
|---|---|---|
| R8C-1 + R8C-3 | HIGH/MEDIUM — unset email | **Fixed as far as agents honestly can; BLOCKER stands (owner-gated).** Verified: unset state now reads "Email is the fastest channel and it is being wired up — not live yet, and I won't park a dead address here…" (honest, no dead mailto, no fabricated address). Empty "Elsewhere" panel renders nothing (0 occurrences of `contact-social-title` in built HTML). Root cause confirmed correct: hide-don't-fabricate — no agent can set a real mailbox. **From the buyer's chair nothing changed: there is still zero reachable channel.** Owner must set `SITE.email` (disposition documents this). |
| R8C-2 | MEDIUM — no engagement framework | **FIXED (implementable scope).** New "What I'm hired for" section on /contact verified in built HTML: 5 capability items (data-analytics, local-inference, smart-routing, tech-stack, video-generation) each linking to its real `/ai-engineering/<slug>` page (all routes exist in dist) + a 6th "Full-stack builds & data platforms" item → /projects. **Honesty check passed: every claim traces to existing verified content; no invented services, testimonials, or metrics.** Two framing nits below (new LOWs), no fabrication found. |
| R8C-4 | LOW — availability signal | **Owner-gated, stands.** /now unchanged ("Available for" list, no accepting-engagements statement). Correctly dispositioned as the owner's call. |
| R8C-5 | LOW — hidden Videos/Talks nav | **Previously dispositioned** (content-driven nav, R2-A/R7). Accept; not re-litigated. |

## New findings

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R8C-6 | LOW | `video-generation` is `status: in-progress` but is presented in the "Services" grid with no status marker — a buyer scanning the section reads it as currently hireable. Mitigated: its own summary line declares the diffusion lane "not yet exercised" (verified in built HTML), so it is not a fabrication — but the grid frame overstates it. | Render the capability `status` as a small chip per item (schema already carries it), or filter the grid to `shipped`/`offered` and move in-progress work to a one-line "also building" note. |
| R8C-7 | LOW | `tech-stack` ("The stack underneath the work") is his own hardware/software inventory, not a hireable service; under the eyebrow "Services" it reads as "you can hire me to have a rack." Traceable and honest, just miscast in a hire-me frame. | Exclude inventory-only pages from the grid (keep the 4 service-shaped capabilities + full-stack item), or retitle its entry ("Infrastructure I run" / "How I work") so the grid stays all-offerings. |

## 4-minute test re-answer (buyer with 4 minutes)

- **(a) What he does** — ✅ now answerable in one scroll of /contact (Services grid). Previously required stitching Now+About+projects.
- **(b) Proof it worked for others** — ⚠️ unchanged: all projects are solo/self-directed; metrics are impressive and verifiable in method, but there is no client outcome, testimonial, or externally reachable artifact (capability "proof" paths are `/opt/data/...` workstation paths — invisible to a buyer). This is a content-reality limit, not a site defect.
- **(c) Engagement shape** — ⚠️ partial: three commitments on /contact ("Fixed scope, written down", "Handover included") + engagement types on /now (2–6 months embedded, due-diligence, rescue, workshops). Still assembled across two pages; no duration/rate signal on /contact itself.
- **(d) How to start** — ❌ still the blocker: no email (owner-gated), no socials (panel now honestly absent), no resume. The buyer's only move is to leave.

## Re-score: 7/10 (was 6/10)

The site-side half of the funnel is fixed and the new section is honest — every claim traceable, nothing fabricated, empty-panel cleanup done. The score is capped at 7 because the conversion action itself is still unreachable until the owner sets `SITE.email` (+ socials/resume): with a live mailbox and the status chip, this is a 9/10 contact page for a solo consultant.

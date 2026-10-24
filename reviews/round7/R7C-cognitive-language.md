# R7-C — Cognitive Accessibility & Plain-Language Review

Reviewer: R7-C (cognitive-accessibility & plain-language lens) · Read-only pass over source,
`content/*.md`, and the prerendered `dist/` (rebuilt via `npm run build` at review time:
AUDIT OK — 23 pages). Scope note: screen-reader/WCAG conformance and prior-round
dispositions (R1-B contrast/landmarks/focus, R1-B L1 reduced-motion, R1-C #9 DRAFT
comments, R2-A A1 email-unset honesty, R6-C C8 nav order, R6-C C9 /now h1) are **not**
re-reported here. Measurement tool: `reviews/r7c_readability.py` (Flesch Reading Ease,
Flesch-Kincaid grade, Gunning Fog; vowel-group syllable heuristic applied identically to
every file, so cross-file comparisons are fair).

## Lens score

**7/10 — cognitive accessibility & plain language.**

Justification. The fundamentals a stressed or non-expert reader needs are genuinely present
and were verified, not assumed: every link is understandable out of context (nav labels,
full post titles as anchors, "Read the case study", wordmark `aria-label="William Boyden —
home"`, 404 recovery links "Back to home / Browse projects / Read the writing"); exactly one
h1 per page and zero heading-level skips across all sampled prerendered pages (h1→h2→h3 on
home, projects, posts, project detail); terminology is consistent site-wide ("projects",
"writing", "case study" used the same way everywhere); the series badge on every post detail
page states position ("AI engineering notes — 2/6", aria-label "post N of 6"); there are no
forms, so no error-message burden; empty states are honest and instructive; the footer's
"Elsewhere" column correctly disappears when no socials are configured; dates render
consistently ("Oct 6, 2026" in lists, "October 4, 2026" on detail pages); and the home
page puts name + value proposition + two CTAs in the first screenful. The 10-second
value-proposition test **passes** — the h1 lockup tagline ("I turn analytical work into
software that survives production…") is the first content a skimmer hits.

What holds it at 7 rather than 8–9: the **list/grid pages are the hardest-to-read text on
the site**. Measured on the rebuilt dist: projects index FRE **8.6** (FK 20.5, Fog 23.3,
33.9 words/sentence, 11 sentences over 25 words), writing index FRE **23.2**, home FRE
**20.6** — versus the post bodies themselves at FRE 44.9–58.9 (FK 10.4–12.2). The cause is
one content-wide pattern: card summaries written as single 40–60-word sentences (17
surfaces). A hiring manager skimming the projects grid meets college-graduate-plus prose
density before any evidence of the work. The four MEDIUM findings below all attack that
one root cause or adjacent skim-path gaps; none require new facts, only re-cutting copy
that already exists and has already passed fact-check rounds.

Reference measurements (all from this review, rebuilt dist + content):

| Surface | Words | W/Sent | Flesch Ease | FK grade | Fog | Sents >25w |
|---|---|---|---|---|---|---|
| content/posts/*.md (6 posts) | 673–886 | 18.1–21.7 | 44.9–58.9 | 10.4–12.2 | 12.9–15.2 | 10–16 |
| dist/projects (visible) | 645 | 33.9 | **8.6** | 20.5 | 23.3 | 11 |
| dist/writing (visible) | 408 | 37.1 | **23.2** | 19.2 | 21.4 | 9 |
| dist/index (visible) | 357 | 32.5 | **20.6** | 18.5 | 21.4 | 7 |
| dist/now (visible) | 334 | 17.6 | 33.7 | 12.9 | 16.0 | 5 |
| dist/about (visible) | 618 | 17.7 | 44.8 | 11.4 | 14.6 | 5 |
| dist/contact (visible) | 282 | 14.1 | 55.1 | 9.1 | 11.2 | 1 |

Register verdict for the audience: the post bodies (FK 10–12) are appropriate for
AI-engineering readers — technical but not gratuitously dense. The grid/index surfaces are
where the register slips below "served": summaries optimized for completeness rather than
for a 5-second scan. The clearest page is Contact (FRE 55.1, FK 9.1) — proof the team can
write plain language when the copy is short.

## Findings

### R7C-1 — MEDIUM — Card summaries are single 40–60-word sentences across all 17 list surfaces

**Evidence.** `content/projects/system-monitor.md:7` summary measured at **49 words, one
sentence**: "Three local monitoring services built on pure-stdlib /proc readers — a FastMCP
query server with 8 telemetry tools, a sqlite-backed threshold alerting server with a CLI
exit-code contract, and a unified FastAPI dashboard rendering Rich-styled gauges, …".
The same pattern repeats on all 8 project cards (`dist/projects/index.html`), 6 writing
cards, and 3 featured cards on home. Page-level consequence: projects index FRE 8.6 with
33.9 w/s; home FRE 20.6 with 32.5 w/s; 27 sentences >25 words across the three grid pages.
A skimmer cannot extract one fact per glance; every summary must be held in working memory
as a single chain.

**Fix.** Editorial rule for `content/*/summary`: two sentences, ≤25 words total, outcome
first, tool names second. Proposed replacement for system-monitor:

> "Three monitoring services, zero runtime dependencies — an MCP query server, an alerting
> server, and a dashboard, all built on Python's standard library."

Apply the same cut to the other 16 summaries (each already passed fact-check; this only
re-cutts verified facts).

**Expected impact.** Estimated projects-index FRE 8.6 → ~38 and home FRE 20.6 → ~42;
sentences >25 words on the three grid pages 27 → ~4; time-to-first-fact per card from
"read 49 words" to "read 12".

### R7C-2 — MEDIUM — Home lede is one 35-word sentence with the payoff last

**Evidence.** `src/pages/Home.tsx:373-377`, rendered verbatim in `dist/index.html`:

> "I advise teams on the hard middle of technical work: where a data-science result has to
> become a maintained service, and "it runs on my machine" has to become "it runs, and we
> know why.""

35 words, one sentence, colon + two quoted phrases; the concrete promise lands in the
final clause. The idiom "the hard middle of technical work" is also the reader's very
first encounter with the site's voice, and it is opaque to anyone outside software
consulting. Measured: this sentence plus the three 49-word card summaries drive home-page
w/s to 32.5 (highest of any page).

**Fix.** Two sentences, promise first, keep the strong quote pair as the second beat
(`src/pages/Home.tsx` `Lede`):

> "I help teams turn data-science results into services that survive production. That
> means making "it runs on my machine" become "it runs, and we know why.""

**Expected impact.** Lede becomes 2 sentences of ~13 and ~14 words; home w/s 32.5 → est.
~25; the value proposition is complete by word 13 instead of word 35.

### R7C-3 — MEDIUM — Post detail pages render no standfirst: the already-written summary is never shown on the post's own page

**Evidence.** `src/pages/PostDetail.tsx:391-431` renders h1, date, reading time, series
badge, and copy-link — then the body narrative begins. Grep confirms `post.summary` is
never rendered in PostDetail.tsx (the only `.summary` reference is the *related project*
block at line 492). Verified in `dist/writing/agent-proof-your-data-layer/index.html`:
between the h1 and the first h2 there is no abstract; a skimmer must parse the opening
narrative paragraph to learn what the post argues. The frontmatter summary — e.g.
"Lessons from a 279M-row payroll ETL that an agent could query safely: the aggregation
traps that overstate numbers 9x and 12x…" — is fact-checked, shown on index cards, and
shipped in meta description, but withheld from the page it describes.

**Fix.** Render `post.summary` as a styled standfirst immediately under the MetaRow in
`PostDetail.tsx` (visually distinct — slightly larger, textMuted, max-width ~60ch), e.g.
a `<p className={standfirstClass}>` between lines 421 and 423.

**Expected impact.** Time-to-point on a post page from ~40 s (read opening paragraph) to
~10 s (scan standfirst); zero new content required; also gives every post detail page the
"inverted pyramid" top the index pages already have.

### R7C-4 — MEDIUM — Projects index offers 22 filter controls for 8 projects; 14 chips have count = 1

**Evidence.** `dist/projects/index.html`: 21 `aria-label="Filter by …"` chips plus the All
chip = 22 interactive controls above a grid of 8 cards. Fourteen chips filter to exactly
one project: agents, cli, clickhouse, data-science, data-viz, developer-tools, evals,
fastapi, langfuse, ml, monitoring, observability, orchestration, static-analysis
(measured). Choice architecture where choices outnumber items by ~3:1 adds scan cost
without navigation value — a stressed reader must parse 22 options to save reading 8
summaries.

**Fix.** In `src/pages/Projects.tsx` `tagCounts` rendering: show only tags with count ≥ 2
(7 chips + All = 8 controls) and, if the tail must stay reachable, fold the rest behind a
"More tags" disclosure. Keep `visibleProjects` unchanged — this is presentation-only.

**Expected impact.** Choices per screen 22 → 8 (−64%); the filter bar fits one line at
375 px with larger perceived targets; no function is lost (single-tag filtering remains
possible via the writing page's search path or by browsing).

### R7C-5 — LOW — Same link target, two different labels: "Read the case study" vs "View case study"

**Evidence.** `src/pages/Home.tsx:292` ("Read the case study →") and
`src/pages/Projects.tsx:240` ("View case study →") — both navigate to the identical
project-detail route. Two verbs for one action teaches the pattern less efficiently and
reads as two different destinations.

**Fix.** Standardize on "Read the case study" in both files (the home phrasing is the
more natural verb for prose).

**Expected impact.** 2 labels → 1 for the site's primary repeated affordance (17+ links).

### R7C-6 — LOW — About page leans on idiom where plainer phrasing carries the same claim

**Evidence.** `src/pages/About.tsx:173-174` (Languages skill definition): "Python and
TypeScript **carry** most of my production work; SQL is a **first language, not an
afterthought**." Two idioms in one sentence (metaphorical "carry", "first language");
opaque for non-native-English readers, who are a real share of AI-engineering hiring
audiences. Measured page context: About is otherwise fine (FRE 44.8, FK 11.4).

**Fix.** Proposed replacement for that sentence:

> "I write most of my production code in Python and TypeScript, and I use SQL every day —
> not as an afterthought."

**Expected impact.** Removes 2 idioms; est. FK −0.5 on the About page; same claim, same
tone.

### R7C-7 — LOW — Nav label "Now" is not self-explanatory to a first-time visitor

**Evidence.** `src/components/layout/Nav.tsx:39` (`{ label: 'Now', to: '/now' }`). The
page itself explains the now-page convention beautifully (Now.tsx:188-193: "A standing
answer to 'what are you working on these days?'"), but the label a visitor clicks is a
bare word that could mean anything. Every other nav label is a plain category noun.

**Fix.** Keep the visible label "Now" (it is the established convention and short), but
add `title="What I'm working on now"` (and the same as an `aria-label` supplement) on the
nav link, and consider the same phrase as a small subtitle on the /now h1 area.

**Expected impact.** 1 ambiguous nav label disambiguated at zero layout cost.

### R7C-8 — LOW — "Related projects" block gives no signal of *why* the projects are related

**Evidence.** `src/pages/ProjectDetail.tsx:451-452` — `<BlockTitle>Related projects</BlockTitle>`
is immediately followed by the grid (`dist/projects/ds-core/index.html` verified: h2 →
`related-grid` with zero intervening copy). The relationship is actually principled —
shared-tag overlap, newest first (ProjectDetail.tsx:44 comment) — but the reader is left
to guess whether these are dependencies, siblings, or influences. Same gap exists on the
"Related projects" / related-post blocks of the other 7 project pages.

**Fix.** Add one static explanatory line under the BlockTitle in ProjectDetail.tsx:

> "Other projects that share methods or tooling with this one."

(And the mirror line on the post-detail related block: "The project behind this post"
already explains itself — no change needed there.)

**Expected impact.** 8 project pages gain one clarifying sentence; removes the only
heading on the site whose semantics the reader must infer.

## Explicitly checked and found sound (so later rounds don't re-chase)

- **Link text**: all prerendered anchors sampled on /, /projects, /writing, /now, /about,
  /contact, one project detail, one post detail, and /404 carry descriptive text; the 404
  recovery page is exemplary (three named links + two inline context links).
- **Headings**: one h1 per page; no level skips on any sampled page; card titles use h2/h3
  correctly per page context (Projects intentionally h2 — documented in source).
- **Memory demands**: no IDs or names must be carried across pages; series position is
  always visible ("2/6" + aria-label "post 2 of 6"); related links repeat full titles.
- **Forms/errors**: no forms exist; the one "unset state" (contact email) is honest,
  plain-text, and offers a real next click (R2-A A1 / R6-C C6 dispositions holding).
- **Motion**: nothing beyond hover/focus transitions; all gated on
  `prefers-reduced-motion` (R1-B L1 disposition holding) — no autoplay, no parallax, no
  attention-stealing animation found in dist CSS.
- **Terminology**: "projects" / "writing" / "case study" consistent everywhere except
  R7C-5; dates consistent in both list and detail styles.

## Disposition recommendations

1. **R7C-1, R7C-2 (summary/lede re-cutts)** — treat as one editorial batch with an owner
   pass over `content/*/summary` + `Home.tsx` lede; both are pure copy edits on
   fact-checked text; recommend doing together so the grid pages and hero fix in one
   review cycle. Add a lint-style guard if cheap: warn (not fail) when a `summary` field
   exceeds 30 words or contains no sentence break.
2. **R7C-3 (post standfirst)** — smallest code change with the largest skim payoff;
   render the existing verified `post.summary`. Recommend for the next component pass;
   no content work needed.
3. **R7C-4 (chip cap)** — presentation-only change in Projects.tsx; recommend accepting;
   revisit the ≥2 threshold if the project count grows past ~15 (at that point the
   long-tail chips become useful again).
4. **R7C-5, R7C-6 (label + idiom)** — trivial copy unifications; bundle with batch 1.
5. **R7C-7, R7C-8 (nav title, related-block line)** — optional polish; accept if a round
   is opened anyway, otherwise defer without risk.
6. After the batch, re-measure the three grid pages with `reviews/r7c_readability.py`;
   success criterion: projects index FRE ≥ 35 and home FRE ≥ 40, sentences >25 words ≤ 5
   per grid page.

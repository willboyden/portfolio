# R9-B — cold-stranger timed task walkthrough (round 9)

Reviewer: R9-B, stranger task-walkthrough lens. First visit to this site; no source
knowledge used for navigation. Method: local build of HEAD (`npm run build`, 34 pages,
AUDIT OK) served at `http://127.0.0.1:4321/`; navigation by rendered HTML only
(chrome-headless-shell `--dump-dom`, following links a stranger would click).

**Timing method (honest):** click counts are exact (observed from the HTML I acted on).
Seconds are simulated cold-visitor estimates: per-page scan/read time for the text
actually needed (≈5–12 s/page at reading speed) + ~2 s per navigation. Wall-clock agent
timestamps were logged per task but include tool overhead, so they are not shown as
visitor time. This is a measurement of *navigation structure*, not of render latency.

Prior-round items consciously NOT re-reported: unset email/socials/resume (owner-gated,
R8-C1/C3), unset-email copy state (implemented in R8), /now availability *statement*
content (R8-C4 owner call), hidden Videos/Talks nav, empty Elsewhere panel, placeholder
domain in a non-SITE_URL local build (live homepage verified clean of it).

---

## Task 1 — "Find out what this person is expert in" (target ≤30 s, ≤3 clicks)

**SUCCESS · ~15 s · 1 click**

Think-aloud: Landed on home. The hero answers most of it before any click —
"Technical consultant · Full-stack engineer · Data scientist" plus the promise
"turn data-science results into services that survive production." A stranger who wants
the specific version clicks the obvious nav item **About** (1 click). About states it
twice: the bio ("technical consultant who came through full-stack web engineering and a
data-science degree") and a literal heading "What I am good at, specifically:
translating between layers…". No hesitation. Nothing misled me.

Cheapest fix needed: **none.** This task is already under half its budget.

## Task 2 — "Find their strongest project and its best number" (target ≤45 s)

**SUCCESS · ~20 s · 1 click**

Think-aloud: "Strongest" is ambiguous on arrival, and the site offers two competing
answers: home's "Selected work — Projects I would put in front of a client" leads with
**ds_core**, while `/projects` is date-ordered and leads with **Crucible (Oct 2026)**.
I hesitated here (~10 s) weighing "curated-first" vs "newest-first". I trusted the
curation label — "I would put in front of a client" is the site explicitly ranking —
and clicked the ds_core card's "Read the case study" (1 click). Best numbers were
immediately legible in the card's metric rows and the case-study header:
**38 modules / 26 audit findings fixed (5 critical) / 295 tests**, plus
before/after proof in Highlights (t-SNE 5-NN accuracy 0.57→0.97, ECE 0.221→0.019).

Hesitation point: the home-vs-index ordering conflict (see R9B-2).
What misled me: nothing after the first 10 s; the curation copy resolved it.

Cheapest fix: one "Start here" marker on the /projects card the homepage ranks first
(or a "Featured" chip) — see R9B-2.

## Task 3 — "Find something they wrote about evals and skim its argument" (target ≤45 s)

**SUCCESS · ~25 s · 2 clicks**

Think-aloud: Nav **Writing** (1 click). The tag row shows an `evals` chip, but faster
still: scanning the 8 visible post cards, **"Testing when half your system is a prompt"**
is tagged `evals` and its card summary *is* the thesis ("You cannot unit-test a prompt,
so stop trying. Deterministic boundaries…"). Clicked it (1 click). On the post, the
standfirst (post.summary) restates the argument in two lines, and the first section
("Boundary one: the eval harness judges with rules, not opinions — 48 recorded runs, no
LLM-as-judge") gives the skim in one screen. Argument skimmed in ~10 s of reading.

Hesitation point: none on the happy path. (I did hit a 404 once by typing a guessed
URL instead of clicking — my error, not the site's; the 404 page is excellent, see
delighters.)

Cheapest fix needed: **none** for the task itself. Adjacent LOW: the `evals` chip is a
JS-only filter button with no URL state (see R9B-4).

## Task 4 — "Find how to contact them and what to include" (target ≤30 s)

**PARTIAL · ~12 s to the answer · ~40 s including the dead-end exploration · 3 clicks**

Think-aloud: Nav **Contact** (1 click). "What to include" is answered crisply in the
first screen: "a paragraph of unpolished context: the system, the constraint, the
deadline you are worried about" + "Include a link to context — a repo, a doc, an
incident timeline." That half succeeds in ~12 s.

Then the known dead end: "Email … is being wired up — not live yet, and I won't park a
dead address here." (Dispositioned root cause; what follows is the requested behavior
measurement.) What I, as a motivated stranger, actually did, in order:

1. Scanned the page and footer for any alternative channel — **none exists** (no
   socials, Elsewhere renders nothing, no form, RSS is not a contact channel). ~8 s.
2. Followed the page's own redirect copy ("the case studies below and the Now page show
   exactly what I am doing this quarter") → clicked through to **/now** (1 click).
3. /now ends its "Available for" panel with a primary button **"Check availability"** →
   clicked it (1 click) → landed back on **/contact** — the page that just told me
   there is no live channel. I recognized the loop (contact → now → contact) and left.
   2 clicks, ~20 s, ending in exit rather than conversion.

Measured dead-end outcome: **the site's own CTAs route a motivated buyer in a circle
and lose them.** The two pages most likely to be visited by someone ready to engage
each point at the other, and neither can complete the action.

Findings: R9B-1 (MEDIUM — the loop; agent-implementable mitigation + owner-gated root).

## Task 5 — "Determine whether they're available for work right now" (target ≤30 s)

**SUCCESS · ~12 s · 1 click**

Think-aloud: Nav **Now** (1 click). The **"Available for"** section lists four concrete
engagement types (due-diligence reviews, 2–6 month embedded consulting, rescuing
stalled projects, workshops) and the page stamps "Last updated October 2026". A
stranger reads the heading literally and concludes: yes, currently open to these.

Hesitation point (~5 s): "Available for" enumerates *what kind* of work, not *whether
there is capacity now* — I had to infer availability from the heading + freshness
stamp. A booked-until-December person could ship this exact page. See R9B-3.

Cheapest fix: one status line ("Currently taking new engagements — next opening
⟨month⟩" or "Booked until ⟨month⟩ — waitlist open") at the top of the Available-for
panel and on /contact. Content is owner-gated (R8-C4) but the *wording/slot* is an
agent change.

## Task 6 — "Find evidence they have worked with ClickHouse" (target ≤45 s)

**SUCCESS · ~20 s · 1–2 clicks**

Think-aloud: Chose ClickHouse (I had seen the word once on /contact's services list,
so I knew it existed; a true stranger without that hint would scan /projects the same
way I did). Nav **Projects** (1 click). Third card down: **"Gov Payroll Analytics
Workbench"** — the summary names it ("23-table, ~279M-row ClickHouse database"), the
card tag row visibly carries `clickhouse`, and the metric rows give numbers
("23 tables, ~279M rows", "14 probe datasets, each under 0.3 s server-side").
Case study (1 click) is deep evidence: ClickHouse 24.3, error-code-level war stories
(missing `arbitrary()` → error 46, alias-shadowing ILLEGAL_AGGREGATION → error 184,
`FY2026` string columns), MCP-over-JSON-RPC transport with session re-handshake.
This is not name-dropping; it reads like hands-on experience.

Hesitation point: none.

Cheapest fix needed: **none.**

---

## Findings

### R9B-1 · MEDIUM — the availability CTAs route a motivated buyer in a circle that ends in exit
- **Evidence:** Task 4. /contact (email unset, honestly declared) redirects to /now;
  /now's primary CTA "Check availability" links to /contact. Measured path
  contact → now → contact, 2 extra clicks, ~20 s, no completion possible; simulated
  outcome was abandonment at exactly the moment of highest intent.
- **Fix (agent-implementable half):** point /now's "Check availability" at the
  /contact "What I'm hired for" anchor (`/contact#hired-for`-style) or relabel it
  ("See what I'm hired for") so the CTA promises what the destination can deliver; and
  add one sentence on /now under "Available for" acknowledging the email-not-live
  state so strangers stop looping. **Fix (owner-gated half, root cause):** `SITE.email`
  in `src/lib/seo.ts` — already dispositioned R8-C1/C3; not re-raised.
- **Measurable impact:** removes the 2-click/~20 s loop; T4 dead-end exploration
  ~40 s → ~15 s, and the loop-exit (lost visitor) becomes a content path.

### R9B-2 · LOW — "strongest project" gives two conflicting answers (home curation vs index recency)
- **Evidence:** Task 2. Home featured list leads with ds_core under "Projects I would
  put in front of a client"; /projects is date-ordered leading with Crucible
  (Oct 2026). Cost ~10 s of hedging before trusting the curation label.
- **Fix:** a "Start here" label or Featured chip on the homepage-ranked card within
  /projects (one class + one string; no content change).
- **Measurable impact:** removes the ~10 s hedge; worst-case T2 45 s → ~30 s.

### R9B-3 · LOW — "Available for" answers *what work*, not *whether now* (Task 5 ambiguity)
- **Evidence:** Task 5. Availability is inferable only from the section heading plus
  "Last updated October 2026"; nothing distinguishes "open now" from "this is the kind
  of work I take".
- **Fix:** one status line atop the Available-for panel and on /contact
  ("Currently taking new engagements — next opening ⟨month⟩"). Content itself is
  owner-gated (R8-C4), but the slot/wording is shippable now with a neutral form.
- **Measurable impact:** T5 stays ~12 s but converts from inference to fact; protects
  the answer from silently rotting when bookings change.

### R9B-4 · LOW — tag filters have no URL state (`evals` chip is JS-only)
- **Evidence:** Task 3. The fastest evals path is the `evals` chip on /writing; it is a
  `<button aria-pressed>` client-side filter — no `?tag=` URL, so the filtered view
  can't be deep-linked, shared, or restored by Back. (Adjacent to, but distinct from,
  the R3-A F7 pagination-param decision.)
- **Fix:** reflect the active tag in the query string on /writing and /projects and
  read it on load; chips keep working as-is.
- **Measurable impact:** enables shareable filtered views; saves the repeat-visit
  re-navigation (~10–15 s per return visit). LOW at current traffic; grows with use.

## Delighters (better than expected)

1. **Real numbers everywhere.** Every card and case study carries measured figures —
   "26 bugs (5 critical), every one fixed", "23 tables, ~279M rows", "48 recorded runs,
   no LLM-as-judge". A stranger can judge the work without trusting adjectives.
2. **Honesty as a visible feature.** "One honest gap: 294/295 tests pass… the flake is
   documented, not deleted"; "not live yet, and I won't park a dead address here";
   failure taxonomies and coverage traps told as war stories. Rare, and it compounds
   trust across pages.
3. **Post standfirsts + the humane 404.** `post.summary` rendered as a standfirst made
   Task 3's "skim its argument" nearly free (the thesis is on screen before the body),
   and the 404 I triggered by my own bad URL gave plain-language causes plus three
   working exits — I recovered in seconds without frustration.

---

## LENS SCORE: 8 / 10 — cold-stranger task success

Five of six tasks succeed at or under target with ≤2 clicks, and the two
"find evidence" tasks (2, 6) succeed with unusually strong, verifiable specifics; the
information architecture is genuinely stranger-legible. The deduction is concentrated
in the conversion path: the one task that fails to complete (contact) fails at the
moment of highest visitor intent, and the site's own CTAs actively route the visitor in
a circle (R9B-1) before they exit. Root cause is the dispositioned owner-gated email —
but the loop around it is UI the site controls, and Task 5's availability answer is
inference rather than statement. Fix R9B-1's implementable half plus one status line
and this is a 9.

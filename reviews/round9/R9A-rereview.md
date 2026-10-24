# R9-A re-review — LLM/agent consumability (round 9 fixes, commit 64e746c)

**Method:** live curl of https://willboyden.github.io/portfolio/ (home, /about, /now, /contact,
/writing, /writing/mcp-production-lessons/, /ai-engineering, /projects, /projects/ds-core/,
/projects/code-quality-dashboard/, robots.txt, llms.txt, llms-full.txt, sitemap.xml), 2026-10-24.
Original: `reviews/round9/R9A-llm-consumability.md` (score 6/10).

## Verdicts

| ID | Finding | Verdict | Live evidence |
|----|---------|---------|---------------|
| R9A-1 | Person binding + knowsAbout | **FIXED** | Every deep page JSON-LD now carries `about: {@type Person, @id "https://willboyden.github.io/portfolio/#person"}` (curl-verified on /about, /now, /contact, /projects/ds-core, /projects/code-quality-dashboard). Home `knowsAbout` = `["python","llm","testing","duckdb","mcp","agents","dashboards","analytics"]` — content-derived from the tag corpus, not 3 hardcoded strings. `sameAs` still absent — correct until the owner sets socials (hide-don't-fabricate). |
| R9A-2 | Headline chrome + boilerplate descriptions | **FIXED** | Article headline = `"MCP in production: what the spec doesn't tell you"` — no " — Writing" chrome. CollectionPage names chrome-free (`"ds_core Data Science Toolkit"`, `"Code Quality Metrics MCP"`). All six section pages ship distinct per-section meta descriptions (about/writing/ai-engineering/now/projects/contact) — no more site-wide boilerplate outside home. |
| R9A-3 | /now freshness | **FIXED** | h1 = `Last updated <time dateTime="2026-10-16">October 2026</time>`; JSON-LD `dateModified: 2026-10-16`. Machine freshness computable. |
| R9A-4 | Project dates/tags machine-exposed | **PARTIAL** (as dispositioned) | llms.txt carries per-project `(date; status)` and per-post `(date; tags: …)` — freshness for projects is now answerable. Cards unchanged (accepted, R2-D surface). **BUT: 0 of 11 project lines in live llms.txt carry tags** — the disposition's "dates+tags per project" claim is half-inaccurate; project topics remain prose-only (see R9A-10). |
| R9A-5 | Article keywords | **FIXED** | `keywords: ["mcp","agents","python","duckdb","architecture"]` in Article JSON-LD, straight from frontmatter. |
| R9A-6 | llms.txt | **FIXED** | /llms.txt live (40 lines): correct canonical origin line, honest contact line ("email is not published yet (being wired up)"), Sections (7 routes), 10 projects (dated+status), 9 posts (dated+tagged), 5 capability briefs. `llms-full.txt` still 404 — optional variant, backlog. |
| R9A-7 | ContactPage | **FIXED** | /contact JSON-LD `@type: ContactPage` + Person binding + real description ("How to reach William Boyden, what working together looks like…"). `contactPoint` correctly withheld while email is unset. |
| R9A-8 | robots comment | **FIXED** | robots.txt line 1: `# robots.txt — everything is crawlable, AI crawlers included (deliberate: a public portfolio wants discovery).` Sitemap origin correct. |
| R9A-9 | LOW items | **FIXED** (one trivial residual) | og:title chrome gone (`"MCP in production: what the spec doesn't… — William Boyden"`); `mainEntityOfPage.@id` and canonical now both slash-less and identical — mismatch closed. Residual: writing index still 0 `<article>` wrappers (8 `<time dateTime>` are present; extraction unaffected in practice). |

## New findings (this re-review)

- **R9A-10 LOW** — llms.txt project entries carry `(date; status)` but **no tags** (0/11 lines), while writing entries do. An agent doing topic-based project shortlisting must still read full prose for projects. Fix: one-line change to the llms.txt generator (project frontmatter already has `tags:`). File: `scripts/` llms generator; evidence: `/llms.txt` project section.
- **R9A-11 LOW** — sitemap `/now` lastmod = `2026-10-24` (global git-derived) while the page's own `dateModified` = `2026-10-16`. An agent cross-checking sees a 8-day disagreement. Fix: include `/now` in the per-URL content-date group (R8A-3 mechanism already exists).
- **R9A-12 LOW** — the 404 page emits `CollectionPage` JSON-LD with an **empty `name`/`headline`** (found via a wrong-path probe `/posts/…` → 404). A machine hitting a stale URL gets a nameless entity. Fix: give the 404 JSON-LD `name: "Not found"` or omit JSON-LD on 404 entirely.
- **R9A-13 LOW (backlog)** — `llms-full.txt` still 404. llms.txt alone satisfies the convention; full-text variant only if agents start requesting it.

## Machine-answer re-test (agent's five questions, from prerendered HTML + llms.txt alone)

| Question | Before | After |
|----------|--------|-------|
| Who is this person? | Home-only Person; deep links unbound | **YES** — Person node reachable from every page via `about.@id …/#person`; llms.txt Owner line |
| Top 3 skills with evidence? | 3 hardcoded strings | **YES** — 8 content-derived `knowsAbout` tags + 5 dated capability briefs in llms.txt with proof pointers |
| Are they available? | Prose-only, undated | **YES (honest)** — dated as-of (`dateTime` + `dateModified`), "Available for" list, explicit "email being wired up" expectation line |
| How to contact? | Dead end | **PARTIAL (owner-gated)** — ContactPage + llms.txt contact line are honest about the unset email; an actual address remains owner action |
| Most recent work? | Posts only | **YES** — per-project dates+status in llms.txt (newest 2026-10-16), per-post dates+tags, `/now` dateModified |

## Score

**9/10** (was 6/10). Every implementable HIGH/MEDIUM from R9-A is fixed and verified live; the
machine-answer matrix went from 1/5 solid to 4 solid + 1 owner-gated. The remaining half-point is
R9A-10 (project tags invisible to machines — the one dispositioned claim that doesn't hold live)
plus the LOW residuals; email/sameAs/availability-statement stay owner-gated by design.

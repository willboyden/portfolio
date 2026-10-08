# Content plan — what to publish, in what order

Ground rule inherited from CONTRACT.md: **nothing fabricated.** Every project
entry must trace to a real repo (paths listed below); every post to something
the author actually built or measured. Placeholders are flagged `DRAFT` and
must be replaced or deleted before launch.

Positioning line (drives every piece): *technical consultant who ships
AI-enabled systems end-to-end — data layer to UI to deployment — with the
data-science rigor to prove they work.*

## 1. Projects (the portfolio core)

Target 6–8 entries. Schema lives in `src/content/schema.ts`; write
`content/projects/<slug>.md`. Statuses are honest: `shipped` only for things
with a working artifact.

| Priority | Slug | Real source | Angle for an AI-engineering job search |
|---|---|---|---|
| P0 | `model-quality-harness` | `model-quality-harness/` | **Lead with this.** Eval harnesses are the #1 hiring signal right now. Show metrics, methodology, before/after. |
| P0 | `langfuse-dashboard` | `langfuse-dashboard/` | LLM observability: traces, cost, latency dashboards. Full-stack + AI ops. |
| P0 | `duckdb-mcp` | `duckdb-mcp/` | MCP server + DuckDB analytics: agent-tooling fluency, the hottest integration surface. |
| P0 | `orchestrator` | `orchestrator/` | Multi-MCP orchestration from Python — architecture story with diagrams. |
| P1 | `ds-core` | `ds_core/` | Zero-dependency DS toolkit — algorithm depth, API design taste. |
| P1 | `gov-payroll-workbench` | `gov-payroll-workbench/` | Real messy-domain data engineering (ClickHouse, ETL correctness). |
| P2 | `system-monitor` | `projects/system-monitor/` | MCP + dashboards + ops empathy; also the project's own review-loop story. |
| P2 | `code-quality-dashboard` | `projects/code-quality-dashboard/` | Static-analysis platform; quality gates as a product. |

Each entry needs: 2–3 sentence summary, 4–6 highlights with **numbers where
they exist** (test counts, benchmarks, rows/s — pull from repo READMEs/CHANGELOGs),
stack list, architecture diagram (use `scripts/gen_media.py --title` style or
excalidraw exports in `public/img/<slug>/`), and links (source; demo/paper
only if real).

## 2. Writing (signal > volume; 12–16 posts/year beats 50 listicles)

First 6 posts (the launch set), each anchored in work already done:

1. **"Building an eval harness that catches silent model regressions"** —
   from `model-quality-harness`. Methodology, false-negative war story,
   the metric you trust.
2. **"MCP in production: what the spec doesn't tell you"** — from
   `duckdb-mcp` + `orchestrator`: schema drift, stdio lifecycle, auth gaps.
3. **"DuckDB is the analytics database your agent workflows needed"** —
   benchmarks from `benchmark_framework` + `duckdb-mcp`; real numbers.
4. **"Pragmatic LLM observability with Langfuse"** — cost/latency/quality
   triangle; what dashboards you actually check daily.
5. **"Agent-proof your data layer"** — lessons from gov payroll ETL: lineage,
   checkpoints, idempotency; why agents amplify bad data hygiene.
6. **"Testing when half your system is a prompt"** — deterministic boundaries,
   golden files, statistical assertions. (Contract tests + e2e for THIS site
   make a credible prop.)

Then monthly cadence; every consulting engagement yields 1 post. Formats that
perform in this niche: architecture teardowns, benchmark write-ups,
"what broke and why." Add a **series** field for multi-parts.

## 3. Videos

Realistic seeding:
- **Record 2 Loom-style walkthroughs first** (5–8 min): model-quality-harness
  end-to-end; orchestrator wiring two MCP servers. Unlisted YouTube →
  `provider: youtube` + `embedId`.
- Conference/meetup talks once accepted; until then the page carries the
  walkthroughs — an empty-but-honest page beats a thin one.
- Every post above is a recorded-lecture candidate for the same 20-min slot.

## 4. Talks

- Submit to 3–5 meetups/confs with post #1 and #2 as abstracts (strategist
  agent already drafted abstracts in `content/talks/` drafts).
- Until accepted: list internal brown-bags/lunch-and-learns only if
  they really happened; otherwise the Talks page announces "speaking soon"
  with the two proposed abstracts as previews.

## 5. About / Now / Contact

- About: three acts — consultant now (outcomes), full-stack track record,
  data-science foundations (BS + where it still shows up). One paragraph of
  human, one of how-you-work, close with what you want next.
- Now: refreshed monthly; it's the "is this person active?" check recruiters do.
- Contact: real email + calendar link (Cal.com/Calendly) once chosen; no
  fake form backend.

## 6. Media to generate (scripts/gen_media.py)

- `og-default.png` ✅ generated + vision-checked.
- Per-project hero images: 1200×630, one idea each — run
  `python3 scripts/gen_media.py --title "<project>" --subtitle "<one-liner>" --kicker project --out public/og/<slug>.png`
  then set `heroImage` in the frontmatter.
- Diagram exports (architecture) under `public/img/<slug>/` — keep SVG where
  possible (crisp, tiny).

## 7. Launch checklist

- [ ] 4+ projects filled from the P0 rows above, all facts repo-traceable
- [ ] 6 launch posts drafted, proofread, frontmatter validated (build fails otherwise)
- [ ] 2 walkthrough videos uploaded unlisted, durations real
- [ ] OG images per post (`og-image` frontmatter) + vision-check each
- [ ] Real email/calendar; twitter handle in `src/lib/seo.ts` (currently DRAFT-marked)
- [ ] `npm run verify` green, `npm run test:e2e` green, `audit:site` green
- [ ] Ask a human to read About/Contact for tone before the first application goes out

## 8. Anti-fabrication notes

Placeholders found during the build (grep `DRAFT` to re-find):
- `src/lib/seo.ts` twitter handle placeholder
- contact email placeholder (if the Contact agent used the fallback)
`siteMeta` domain (`alexrivera.dev`) must become the real domain in
`src/lib/seo.ts` + `SITE_URL` at build time.

# Recommended content — what to add, what to swap, what only you can provide

Companion to `CONTENT_PLAN.md` (the strategy). This file is the **current
inventory + next actions**, kept honest: everything marked LIVE is on the built
site today; everything else is a decision or an input only you can make.

## LIVE today (verified in `dist/`, 23 pages)

### Projects (8 — every fact traces to a real repo)
| Slug | Source repo | Status shown | Notes |
|---|---|---|---|
| model-quality-harness | `model-quality-harness/` | shipped | Lead entry — eval methodology + honest zero-metric disclosure |
| duckdb-mcp | `duckdb-mcp/` | shipped | Benchmarks cited with machine disclosure |
| orchestrator | `orchestrator/` | shipped | Six verified MCP modules, ten subcommands |
| langfuse-dashboard | `langfuse-dashboard/` | shipped | Air-gapped observability angle |
| ds-core | `ds_core/` | shipped | Zero-dependency DS toolkit |
| gov-payroll-workbench | `gov-payroll-workbench/` | shipped | Messy-domain ETL correctness story |
| system-monitor | `projects/system-monitor/` | shipped | Ops empathy + MCP dashboards |
| code-quality-dashboard | `projects/code-quality-dashboard/` | shipped | Quality gates as a product |

**Swap-in available:** `static-site-gen`, `wiki-search`, `animated-explainer`
also have real repos if you want to rotate entries per application (e.g. lead
with `wiki-search` for RAG-adjacent roles). Drop-in format: copy any
`content/projects/*.md` as the template, run `node scripts/build-content.mjs`.

### Writing (6 — the full launch set from the plan)
1. eval-harness-silent-regressions — HTTP-200 failures, verified numbers
2. mcp-production-lessons — return-shape folklore, `_tool_manager`, lifecycle
3. duckdb-for-agent-workflows — ATTACH/IDENTITY/SERIAL failure classes, v1.5.4
4. langfuse-observability-pragmatic — cost/latency/quality triangle
5. agent-proof-your-data-layer — payroll ETL: lineage, checkpoints, idempotency
6. testing-half-your-system-is-a-prompt — deterministic boundaries (this site's
   own 492-test/49-e2e battery is the prop)

All six passed a dedicated fact-check pass (claims re-verified against the
repos, retry sets re-read from source, latency triples recomputed,
`reasoning_burn=0` disclosed honestly). Cadence plan: 1 post per engagement +
monthly; formats that work in this niche are teardowns, benchmarks, post-mortems.

### Videos / Talks — deliberately empty
Both pages render an honest empty state and the nav hides both sections until
real items exist (reviewer R2-A: an empty section with fake rows reads worse
than none). The plan to fill them (from CONTENT_PLAN §3–4):
- Record 2 Loom walkthroughs (5–8 min): harness end-to-end; orchestrator
  wiring two servers. Upload unlisted → add `provider: youtube` + `embedId` +
  real duration to `content/videos/*.md` frontmatter. Nav + OG pick them up.
- Submit posts #1/#2 as meetup abstracts (drafts in `content/talks/`); when
  accepted, add talks with dates/venues. No placeholder events in the meantime.

## Only-you inputs (grep `DRAFT` to find every slot)
1. **Real email** → `src/lib/seo.ts` `SITE.email` — the Contact page shows an
   honest "email not configured" state until set (never a fake address).
2. **Social handles** → `SOCIAL_LINKS` in `src/components/layout/Footer.tsx`
   (github/linkedin/x) — unconfigured handles stay hidden.
3. **Domain** → `SITE.url` in `src/lib/seo.ts` — currently the placeholder
   origin; sitemap/robots/canonicals all derive from it automatically, and the
   build REFUSES to write discovery docs without a real https origin.
4. **Hiring status + resume** → `SITE.hiring` / `SITE.resumeUrl` (both unset =
   hidden): when you start applying, set `hiring: { status: 'open', window:
   '<when>', modes: [...] }` and the hero shows the recruiter strip.
5. **About/Now personal voice** — the three-act About exists; ask one human to
   read About + Contact for tone before the first application (plan §7).
6. **OG images per post** — run `npm run media:gen -- --title ...` per post and
   set `og-image` frontmatter; vision-check each (pipeline proven on the default).

## What I would add next (priority order)
1. Two walkthrough videos (unblocks the Videos section — 15 min of your time,
   biggest credibility jump per hour).
2. One architecture-diagram image per P0 project (the `gen_media.py` style or
   excalidraw exports into `public/img/<slug>/`, `heroImage` frontmatter).
3. Post #7 as the site's own teardown: "How this portfolio's review loop
   worked: 12 reviewer personas, 4 rounds, 90+ findings, 492 tests" — meta,
   verifiable from `REVIEW_LOG.md`, and exactly the story a hiring manager
   wants to hear from a consultant.
4. Then: one post per consulting engagement, monthly minimum.

## Anti-fabrication ledger (what was REMOVED and why)
- Fake `hello@example.com` / `@your-handle` chrome → hidden states + DRAFT slots.
- Fabricated GitHub source links → `links` optional; projects show no button
  rather than a 404-baiting URL. (If you publish repos, add real `source:` URLs
  to each frontmatter — the buttons reappear automatically.)
- Inflated orchestrator server count → 6 verified modules, named.
- `reasoning_burn_turns` narrative → honest "zero in shipped run" disclosure.
- Benchmark absolutes → ratios + single-machine disclosure line.
- Pre-paint wrong-theme flash (light users) → fixed with CSS-var palettes;
  verified frame-one light resolution in real Chromium.

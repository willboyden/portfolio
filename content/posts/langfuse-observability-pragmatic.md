---
# DRAFT-REVIEW: human review before publishing. All facts trace to
# /opt/data/workspace/langfuse-dashboard (README + fetch_traces.py +
# build_dashboard.py + data/).
title: Pragmatic LLM observability with Langfuse
slug: langfuse-observability-pragmatic
summary: >-
  An air-gapped Langfuse dashboard needs three daily numbers, a fetch
  pipeline that survives a hostile broker, and an empty state that tells
  the truth about a 403.
tags: [llm, observability, langfuse, python, dashboards]
date: 2026-10-02
series: AI engineering notes
relatedProject: langfuse-dashboard
---

Every LLM observability demo opens on a gorgeous trace explorer with data in
it. Nobody demos the part where the dashboard is the deliverable and the data
plane refuses to cooperate. I built that dashboard for the traces of project
`mesh` (org `local-ai-lab`) on a Langfuse 3.200.0 instance, and it taught me
more about observability than any panel layout did.

The shape: two scripts. `fetch_traces.py` pulls traces, observations,
sessions and scores into local JSON; `build_dashboard.py` compiles them into
a single dark-theme `index.html`: vanilla JS/CSS, no CDN, zero network
requests once built. Both use the SDK client (Langfuse SDK 4.14.3) from the
same code path as the `langfuse` MCP server, so the fetch layer is the one
piece I'd reuse verbatim under different infrastructure.

## The triangle you actually check daily

Cost, latency, quality, but checked in that order, because that's the order
things catch you flat-footed. My KPI header is deliberately small: total
cost, total tokens split in/out, average trace latency, error count, plus
session and trace counts over the date range. Then exactly three drill-downs:

- **Time series** — per-day trace count as bars, average latency as a line,
  inline SVG with hover tooltips. Latency drift shows up here first.
- **Model breakdown** — per-model calls, tokens, cost, and average latency
  as a table. This is where a cheap-looking model turns into your most
  expensive one once you multiply by its call volume.
- **Trace explorer** — searchable by name, id, user, tags and model, with a
  click-through panel showing each trace's observations as a parent/child
  tree linked by `parentObservationId`, each node carrying level, latency,
  usage and expandable input/output previews.

Everything the dashboard renders comes from those four collections. Nothing
is synthesized at build time; KPIs are computed from the fetched rows.

## The broker said no

Verified on 2026-08-16 (`data/step1_verification.txt`): the instance answers
`GET /api/public/health` with `{'version': '3.200.0', 'status': 'OK'}` and
`GET /api/public/projects` with the `lab-project` / `mesh` / `local-ai-lab`
metadata. That's control plane. For data plane:

| endpoint | result |
|---|---|
| `/api/public/traces` | 403 — `path not allowed by hermes-local langfuse ingestion broker` |
| `/api/public/v2/observations` | 403 (same) |
| `/api/public/sessions` | 403 (same) |
| `/api/public/scores` | 403 (same) |

An ingestion broker fronting the instance whitelists only a few public API
paths, and the SDK's read calls hit exactly the blocked ones. Zero traces,
zero observations, zero sessions, zero scores at build time.

The interesting decision is what a dashboard does with that. The lazy answer
is a spinner that never ends. The dishonest answer is demo data. This one
ships in a clean "no data — data-plane read blocked at broker" state: a red
banner quoting the 403, zeroed KPIs, and empty states in all four views.
Each `data/*.json` records the broker's error verbatim in its `error` field,
and `fetch_report.json` records the whole per-collection picture.

## A fetch pipeline built to be re-run

Observability pipelines fail in boring ways, so the boring parts are
explicit:

- **Idempotent and atomic.** Every run rewrites each JSON file wholesale via
  a temp-file-and-replace. Re-running is always safe; partial writes aren't.
- **Capped pagination.** Page-based collections (traces, sessions, scores)
  walk `page`/`limit` with `limit=100` and honor `meta.total_pages`;
  observations use the v2 cursor endpoint with `limit=1000`; the scores API
  hard-caps `limit` at 100, so the fetcher doesn't fight it. Each collection
  is capped at 5000 items: enough for a dashboard, small enough that the
  embedding step never chokes.
- **Field groups requested explicitly.** The observations call names its
  field groups (`core,basic,time,io,metadata,model,usage,metrics,trace_context`)
  instead of accepting whatever default the API guesses for you.
- **Credentials from the environment only.** Base URL, public/secret keys and
  env come from the environment; no secret is ever printed or written to
  disk, and the JSON files are safe to commit.

## Rendering for a world without `fetch()`

The dashboard must open from `file://`, which means it cannot fetch its own
data — the data is embedded as a JS constant in the HTML. Embedding author-
uncontrolled JSON inside `<script>` needs one guard most people forget:
`</` is escaped to `<\/` during serialization, so a trace name containing
`</script>` cannot end the script tag early. Prose fields are additionally
escaped on render (`& < > "` to entities), and the shipped artifact makes
zero external requests.

How do you test all that with no data? A throwaway synthetic dataset: charts,
KPIs, model table, tree nesting, error badges all validated against fake
rows, then the synthetic data was deleted. The shipped `index.html` contains
only the real (empty) collections. That ordering matters — validate the
rendering logic while the fake data is obviously fake and quarantined, not
after it has been quietly promoted to "sample data."

The payoff of this design is that the blocked state is temporary by
construction. The moment the broker allows the read paths, re-running
`fetch_traces.py` populates the JSON files, `build_dashboard.py` re-renders,
and real KPIs appear with no code changes. Observability infrastructure that
needs surgery to become useful is just a screenshot with extra steps.

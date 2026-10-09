---
# DRAFT-REVIEW: human review before publishing. All facts trace to
# /opt/data/workspace/gov-payroll-workbench (README + probe.py + data/*.json).
title: Agent-proof your data layer
slug: agent-proof-your-data-layer
summary: >-
  Lessons from a 279M-row payroll ETL that an agent could query safely: the
  aggregation traps that overstate numbers 9x and 12x, why every dataset
  carries its own SQL, and what idempotency buys you when the re-run is free.
tags: [data-engineering, clickhouse, etl, agents, python]
date: 2026-10-04
series: AI engineering notes
relatedProject: gov-payroll-workbench
---

A human analyst learns the hard way that a table's grain is not what its name
suggests. An agent never learns it — it queries whatever you give it,
confidently, every time. I built an analytics pipeline over the `gov_payroll`
ClickHouse database (23 tables, ~279M rows) in the local-ai-lab sandbox, and
the process of making it safe to point an agent at it taught me more about
data hygiene than any governance framework deck.

The pipeline is three stages: a query layer, a probe script that materializes
14 datasets as JSON, and a build step that compiles them into a single
self-contained dashboard. Python 3.13 stdlib only, no pip, no CDN, and a
read-only ClickHouse MCP server as the only data path. The read-only part is
load-bearing: DDL and DML are refused at the server, so the probe script is
aggregate-only by construction, not by discipline.

## The traps hide in the grain

Three ClickHouse quirks broke naive queries first (all verified against
24.3.18): `arbitrary()` does not exist (error 46, even on literals — use
`any()`); aliasing `sum(x) AS x` then writing `avg(x)` triggers error 184
because the parser resolves the second `x` to the alias; and column names
drift per table — `irs_soi_zip.tax_year` instead of `year`, and
`federal_spending_awards.fiscal_year` is the string `'FY2026'`, so `int()`
throws and a regex parse is mandatory. These fail loudly, which is the good
category of failure.

The dangerous ones distort silently. `bls_qcew_ma` stores nine `agglvl_code`
aggregation levels per county; summing all levels overstates employment
roughly 9x. The fix is a one-token predicate, `agglvl_code = '70'`, on every
QCEW query. `federal_spending_awards` stores cumulative modifications per
`award_id`, so a raw `SUM(total_obligated_amount)` overstates spending about
12x; the two federal datasets dedupe to `max(total_obligated_amount)` per
award before summing. And `municipal_payroll` only ever covers one to four
cities per fiscal year (FY2027: one city, FY2026: two): a "top cities"
chart built on a partial year ranks a rounding error. The city ranking
therefore runs on 2025, the best-coverage year, and the trend view carries a
`cities` column so the reader cannot forget the grain.

None of these raise an exception. A capable agent will write the
reasonable-looking query, get a number, and cite it. That is the definition
of an unagent-proofed data layer: correctness depends on tribal knowledge
that lives outside the schema.

## Lineage lives in the schema

Every dataset file embeds its own provenance in `meta`: the exact SQL used,
per-attempt timings, row count, notes, and a `failed` flag. The dashboard
carries a provenance section rendering the SQL behind every dataset. When a
number looks wrong, the audit path is: open the JSON, read the SQL, re-run
it. No archaeology.

This costs nothing if you generate the files programmatically, and it turns
the dataset itself into the documentation. When an agent (or a new human)
wants to know why the federal totals look small, the dedupe CTE is right
there in `meta.sql` — the tribal knowledge moved inside the artifact.

## Checkpoints where the fan-out starts

`00_ranges` is the first query: min/max year per core table, one row. It is
cached, and every subsequent query derives its year filters from it rather
than hardcoding 2024 or guessing. That makes the whole 14-query fan-out
date-correct without anyone editing files when new years land, and it gives
the probe one natural checkpoint: if ranges look wrong, nothing downstream is
trusted.

The rest is boring in the right way. `probe.py` is idempotent — rewrites
`data/*.json` on every run, server-side aggregation keeps every query under
0.3 s (the shipped run's slowest query: 0.21 s), and re-running is cheap
enough that refresh becomes a habit. The FEC tables, 216M rows of
them, were deliberately excluded under the performance rules; a dataset that
does not fit the budget gets cut. KPIs on the dashboard are
recomputed from the embedded rows at build time, never hardcoded, so the
headline numbers and the drill-downs cannot drift apart.

## The transport is part of the data layer

The ClickHouse HTTP endpoint is not reachable directly from the sandbox; the
only working path is the clickhouse-mcp JSON-RPC server over HTTP plus
Server-Sent-Events. Four handshakes, one per-session token: send
`Accept: application/json, text/event-stream` with *both* media types or the
server rejects you with 406; capture `Mcp-Session-Id` from the *response
headers* and replay it on every later request; post
`notifications/initialized` and expect 202; then `tools/call run_query` and
parse the SSE `data:` line. The query wrapper hides timeout handling, one
retry, and a stale-session re-handshake, plus normalization of the
`{columns, rows}` result shape into dicts.

That is an unglamorous 279-line module (`ch_client.py`), and it is why the
agent-facing interface is one function — `query(sql) -> list[dict]` —
instead of a protocol the model would have to get right at generation time.
Wrap the transport; do not prompt for it.

## Why agents raise the stakes

A junior analyst who sums nine aggregation levels gets corrected in code
review. An agent doing the same thing produces a dashboard, a summary of the
dashboard, and three confident sentences about it before anyone asks. The
mitigations are old data-engineering virtues with new urgency: filters that
encode grain go *in* the query templates; provenance travels with the data;
refresh is idempotent so stale numbers never accumulate; and the server says
read-only even when the prompt says otherwise. None of it is glamorous. All
of it is what "the agent can be trusted with this data" actually means.

---
# DRAFT: no links — the repo is local only (/opt/data/workspace/gov-payroll-
# DRAFT: workbench). date = last verified data refresh (data/*.json generated
# DRAFT: 2026-08-16); dashboard/index.html rebuilt the same day.
title: Gov Payroll Analytics Workbench
slug: gov-payroll-workbench
summary: >-
  End-to-end analytics pipeline over a 23-table, ~279M-row ClickHouse database
  of government payroll, PPP loans and federal spending: a JSON-RPC/SSE query
  client, 14 re-runnable probe datasets that embed their own SQL and timings,
  and a single self-contained dark-theme dashboard with a 51-tile US map,
  dual-axis SVG trends and a full SQL provenance section.
tags: [data-viz, clickhouse, python, analytics, dashboards]
date: 2026-08-16
role: Design and implementation (solo)
status: shipped
period: "2026-08"
featured: false
relatedPost: agent-proof-your-data-layer
stack: [Python 3.13 stdlib, ClickHouse 24.3, MCP JSON-RPC + SSE, vanilla JS/CSS]
highlights:
  - "The sandbox cannot reach the ClickHouse HTTP port directly — the query layer drives the clickhouse-mcp server over JSON-RPC with SSE responses, session-id handshakes, retry and stale-session re-handshake"
  - "Every dataset is self-documenting — each data/*.json embeds the exact SQL, per-attempt elapsed time and row count, and the dashboard ships a provenance section exposing all of it"
  - "Three real ClickHouse quirks diagnosed and worked around — missing arbitrary() (error 46), alias-shadowing ILLEGAL_AGGREGATION (error 184), and non-uniform column names like fiscal_year stored as the string FY2026"
  - "Two coverage traps caught before they lied — QCEW carries 9 aggregation levels per county (~9x overstate unless filtered to agglvl_code 70) and federal awards store cumulative modifications (~12x overstate until deduped to final obligation per award)"
  - "KPIs are recomputed from the rows at build time, never hardcoded; the single index.html embeds data as a JSON island and opens over file:// with zero network requests"
metrics:
  - database = 23 tables, ~279M rows
  - probe datasets = 14, each under 0.3 s server-side
  - dashboard = 1 self-contained HTML file
---

---
# DRAFT-REVIEW: human review before publishing. Every finding traced to
# /opt/data/workspace/gov-payroll-workbench/data/*.json (verified 2026-10-12).
slug: data-analytics
title: Data analytics on a 279M-row ClickHouse cluster
summary: >-
  Fourteen probe datasets over government payroll, PPP loans, federal
  spending, property values and IRS income data — 23 tables, ~279M rows in
  ClickHouse, every query under 0.3 s server-side, all findings traced to
  re-runnable SQL with embedded timings.
capability: Data analytics
oneLiner: >-
  23 tables, ~279M rows, 14 probe datasets, every query under 0.3 s —
  government payroll, PPP loans, federal spending, QCEW employment, property
  values, and IRS income data in ClickHouse.
tags: [clickhouse, analytics, sql, data-engineering, dashboards, payroll]
date: 2026-10-12
status: shipped
stack: [ClickHouse 24.3, SQL, Python stdlib, DuckDB, JSON-RPC + SSE, vanilla JS/CSS]
howItWorks:
  - Model the domain across 23 tables — state payroll, municipal payroll, BLS QCEW employment, SBA PPP loans, federal awards, property parcels, IRS SOI income — with explicit grain and coverage rules per table.
  - Write self-documenting probe datasets: each data/*.json embeds the exact SQL, per-attempt elapsed time and row count, so findings are re-runnable and auditable.
  - Drive ClickHouse through a JSON-RPC/SSE MCP server — the sandbox cannot reach the HTTP port directly, so the query layer handles session-id handshakes, retry, and stale-session re-handshake.
  - Surface three real ClickHouse quirks: missing arbitrary() (error 46), alias-shadowing ILLEGAL_AGGREGATION (error 184), and fiscal_year stored as the string FY2026 — each diagnosed and worked around.
  - Catch coverage traps before they lie: QCEW carries 9 aggregation levels per county (~9x overstate unless filtered to agglvl_code 70), and federal awards store cumulative modifications (~12x overstate until deduped to final obligation per award).
proof:
  - 14 self-documenting probe datasets with embedded SQL and timings = /opt/data/workspace/gov-payroll-workbench/data
  - Single self-contained dashboard — 51-tile US map, dual-axis SVG trends, SQL provenance section = /opt/data/workspace/gov-payroll-workbench/dashboard
  - Query client with JSON-RPC/SSE, session-id handshake, retry, re-handshake = /opt/data/workspace/gov-payroll-workbench/ch_client.py
  - Three ClickHouse quirks diagnosed and worked around = /opt/data/workspace/gov-payroll-workbench/probe_run.log
  - Coverage traps documented — QCEW agglvl_code filtering, federal award dedup = /opt/data/workspace/gov-payroll-workbench/README.md
limits:
  - The sandbox cannot reach the ClickHouse HTTP port directly — all queries go through the MCP server over JSON-RPC/SSE.
  - QCEW data covers 2021-2024 only; state payroll covers 2009-2026; municipal covers FY2011-FY2027.
  - Federal awards are deduped to final obligation per award — raw counts overstate by ~12x if not deduped.
  - The dashboard opens over file:// with zero network requests — no live ClickHouse connection in the artifact.
relatedPosts: [agent-proof-your-data-layer, duckdb-for-agent-workflows]
relatedProjects: [gov-payroll-workbench, duckdb-mcp]
---

A 23-table, ~279M-row ClickHouse database covering Massachusetts government
payroll, SBA PPP loans, federal spending, QCEW employment, property values,
and IRS income data. The interesting problems are not the queries — they are
the coverage traps, the alias-shadowing errors, and the grain mismatches that
make naive analysis lie.

## What the data covers

The cluster holds **23 tables** across **~279M rows** spanning six data
domains:

| Domain | Tables | Coverage | Rows |
|---|---|---|---|
| MA state payroll | `ma_state_payroll` | 2009–2026 | ~137K employees/year |
| MA municipal payroll | `municipal_payroll` | FY2011–FY2027 | 4 cities, growing |
| BLS QCEW employment | `bls_qcew_ma` | 2021–2024 | 14 counties |
| SBA PPP loans | `sba_ppp_loans` | 2020–2021 | 11.5M loans, $797B |
| Federal awards | `usaspending` | FY2025–FY2026 | Deduped to final obligation |
| Property parcels | `property_data` | All years | 1.59M parcels, $1.57T |
| IRS SOI income | `irs_soi_zip` | 2018–2022 | 6.9M returns/year |

## Findings

Each finding is traced to its probe dataset (re-runnable SQL with embedded
timings in `/opt/data/workspace/gov-payroll-workbench/data/`).

### State payroll (2009–2026)

Latest year (2026): **136,415 employees** across **158 departments**, total
wages **$5.59B**, average wage **$40,994**. The 2009 data has only 1
department (partial coverage) vs 155+ in later years — coverage varies
significantly across the time series.

Top departments by headcount (latest year): University of Massachusetts
System (23,399 employees, $918M wages), MBTA (8,796 employees, $506M wages).

### SBA PPP loans (2020–2021)

**11.5M loans** totaling **$797B** across 60 states/territories. California
leads with 1.27M loans ($104B), Texas second with 939K loans ($63B).

### Property values (all years)

**1.59M parcels** totaling **$1.57T** in assessed value. Boston leads with
180K parcels ($265B), Cambridge second with 29K parcels ($93B) — Cambridge's
per-parcel value ($3.2M) is more than double Boston's ($1.5M).

### BLS QCEW employment (2021–2024)

Middlesex County leads with **930K employed** and **$26.3B** in Q4 wages.
Suffolk County second with **717K employed** and **$24.2B** in wages.

### The coverage traps

Two traps that would make naive analysis lie:

1. **QCEW aggregation levels**: the raw table carries **9 aggregation levels
   per county**. Without filtering to `agglvl_code = 70` (the county level),
   employment is overstated ~9x. Diagnosed by noticing the numbers didn't
   match known county populations.

2. **Federal award modifications**: `usaspending` stores **cumulative
   modifications** per award — each amendment adds a new row with the FULL
   obligated amount, not a delta. Without deduplicating to the final
   obligation per award_id, spending is overstated ~12x. Diagnosed by
   cross-checking against published USASpending totals.

## The pipeline

The sandbox cannot reach the ClickHouse HTTP port directly. The query layer
drives the `clickhouse-mcp` server over **JSON-RPC with SSE responses**,
handling session-id handshakes, retry with backoff, and stale-session
re-handshake. Three real ClickHouse quirks were diagnosed and worked around:

- Missing `arbitrary()` aggregate (error 46) — replaced with `any()`
- Alias-shadowing `ILLEGAL_AGGREGATION` (error 184) — CTE restructure
- `fiscal_year` stored as string `FY2026` — parsed to integer in SQL

The dashboard is a single self-contained HTML file — 51-tile US map, dual-axis
SVG trends, and a full SQL provenance section exposing every query, elapsed
time, and row count. Opens over `file://` with zero network requests.

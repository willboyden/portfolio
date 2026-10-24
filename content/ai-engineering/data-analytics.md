---
slug: data-analytics
title: Data analytics on a 279M-row ClickHouse database
summary: >-
  Fourteen re-runnable probe datasets over Massachusetts payroll, PPP loans,
  federal spending, employment, property and income data in ClickHouse. Each
  embeds its own SQL and timings, and two traps that inflate totals 9–12× were
  caught before they reached a chart.
capability: Data analytics
oneLiner: >-
  23 tables and ~279M rows in ClickHouse, reached by an agent only through an
  MCP server; 14 self-documenting datasets, every query under 0.3 s, and one
  dashboard file that needs no network.
tags: [clickhouse, analytics, sql, data-engineering, dashboards, payroll]
date: 2026-10-12
status: shipped
stack: [ClickHouse 24.3, SQL, Python stdlib, MCP (JSON-RPC + SSE), vanilla JS/CSS]
howItWorks:
  - Map each table's grain and coverage before querying — state payroll, municipal payroll, BLS QCEW employment, SBA PPP loans, federal awards, property parcels and IRS income by ZIP code.
  - Write self-documenting probe datasets — each output file embeds the exact SQL, the elapsed time of every attempt and the row count, so any number can be re-run and audited.
  - Reach the database only through an MCP server, by design — the agent doing the analysis has no database port, so the query layer handles the session handshake, retries and a fresh session when one goes stale.
  - Diagnose ClickHouse quirks instead of guessing — a missing arbitrary() aggregate (error 46), alias shadowing that raises ILLEGAL_AGGREGATION (error 184), and fiscal years stored as the string "FY2026".
  - Check totals against known figures before charting — QCEW and federal awards both overstated by an order of magnitude until filtered and deduplicated.
proof:
  - 14 probe datasets, each with its SQL, per-attempt timing and row count embedded
  - A single self-contained dashboard — a 51-tile US map, dual-axis trends and a provenance section listing every query
  - A query client for the MCP server with session handshake, retry and re-handshake
  - Two coverage traps documented with their fixes (QCEW aggregation levels and federal award modifications)
limits:
  - The agent never touches the database directly; every query goes through the MCP server, which adds a hop.
  - Coverage is uneven — QCEW covers 2021–2024, state payroll 2009–2026, municipal payroll FY2011–FY2027 for at most four cities.
  - About 216M of the 279M rows are FEC campaign-finance tables that this work deliberately left out.
  - The dashboard is a snapshot (data embedded in one HTML file), not a live connection.
relatedPosts: [agent-proof-your-data-layer, duckdb-for-agent-workflows]
relatedProjects: [gov-payroll-workbench, duckdb-mcp]
---

A 23-table ClickHouse database covering Massachusetts government payroll, SBA
PPP loans, federal spending, QCEW employment, property values and IRS income
data. The interesting problems are not the queries — they are the coverage
traps, the alias-shadowing errors and the grain mismatches that make naive
analysis lie.

### What the data covers

| Domain | Table | Coverage | Scale |
|---|---|---|---|
| MA state payroll | `ma_state_payroll` | 2009–2026 | ~137K employees a year |
| MA municipal payroll | `municipal_payroll` | FY2011–FY2027 | at most 4 cities |
| BLS QCEW employment | `bls_qcew_ma` | 2021–2024 | 14 counties |
| SBA PPP loans | `sba_ppp_loans` | 2020–2021 | 11.5M loans, $797B |
| Federal awards | `usaspending` | FY2025–FY2026 | deduplicated to the final obligation |
| Property parcels | `ma_property_parcels` | — | 2.56M rows |
| IRS income | `irs_soi_zip` | 2018–2022 | by ZIP code |

### Findings

Each figure comes from one probe dataset with its SQL embedded.

- **State payroll, 2026:** 136,415 employees in 158 departments, $5.59B in
  wages. The 2009 data has a single department, so coverage varies a lot
  across the series. Largest employers: the University of Massachusetts system
  (23,399 employees, $918M) and the MBTA (8,796 employees, $506M).
- **PPP loans:** 11.5M loans totalling $797B across 60 states and territories.
  California leads with 1.27M loans ($104B), Texas follows with 939K ($63B).
- **Property:** the 100 highest-value towns hold 1.59M parcels worth $1.57T.
  Boston has 180K parcels ($265B); Cambridge has 29K ($93B), so its value per
  parcel ($3.2M) is more than double Boston's ($1.5M).
- **Employment (QCEW, Q4 of the latest year):** Middlesex County employs 930K
  people with $26.3B in quarterly wages; Suffolk follows with 717K and $24.2B.

### The two traps

1. **QCEW aggregation levels.** The raw table carries nine aggregation levels
   per county. Without filtering to `agglvl_code = 70` (county totals),
   employment comes out about nine times too high. It showed up because the
   numbers did not match known county populations.
2. **Federal award modifications.** `usaspending` adds a row for every
   amendment with the full obligated amount, not the change. Without keeping
   only the final obligation per award, spending comes out about twelve times
   too high. It showed up when cross-checked against published totals.

### The pipeline

The query layer drives a `clickhouse-mcp` server over JSON-RPC with
server-sent-event responses. The dashboard is one HTML file with the data
embedded — a 51-tile US map, dual-axis trends and a provenance section that
lists every query, its elapsed time and its row count. It makes no network
requests.

---
# DRAFT: links.source is a plausible GitHub URL, not a verified remote (real
# DRAFT: path: /opt/data/workspace/duckdb-mcp). date/period are last-known
# DRAFT: activity estimates — confirm from git history before launch.
title: DuckDB MCP Server
slug: duckdb-mcp
summary: >-
  MCP server exposing 15 DuckDB tools — query, schema, import/export,
  profiling, cross-database — over stdio JSON-RPC. It drives the DuckDB
  CLI binary via subprocess and encodes 9 benchmark-proven best practices.
tags: [mcp, duckdb, analytics, python, agents]
date: 2026-07-15
role: Design and implementation (solo)
status: shipped
period: "2026"
featured: true
relatedPost: duckdb-for-agent-workflows
stack: [Python 3.11+, mcp SDK, DuckDB CLI 1.5.4+, stdio JSON-RPC, pytest]
highlights:
  - "15 tools spanning query, DDL/DML, CSV/Parquet import-export, profiling, ATTACH-based cross-DB joins"
  - "CLI subprocess over the Python binding: no version drift, -json output parsed with recursive type coercion to int/float/bool/None"
  - "Multi-statement SQL via temp files and duckdb -f, dodging argument-length limits"
  - "9 benchmark-proven best practices as code (bulk insert via generate_series: 100K users in 27 ms; 3x100K cross-DB join in 8 ms; Parquet at ~27% of CSV size), each pinned by an integration test"
  - "Pitfall guard for the real DuckDB failure mode: IDENTITY/SERIAL fails, so auto-increment goes through CREATE SEQUENCE + nextval()"
metrics:
  - tools exposed = 15
  - benchmark suite = 14 benchmarks
  - 100K bulk insert = 27 ms
---

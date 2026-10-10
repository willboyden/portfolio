---
# DRAFT-REVIEW: human review before publishing. Evidence verified 2026-10-10.
slug: smart-routing
title: Smart routing — RAG, MCP & A2A
summary: >-
  Making a fleet of MCP servers actually usable: deterministic NL-to-tool
  planning with guardrails, measured per-tool latency, same-process
  orchestration, FTS5 retrieval, and agent-to-agent fleet discipline.
capability: Smart routing
oneLiner: >-
  Guardrail-first tool routing with golden tests, real-latency benchmarks,
  an in-process MCP orchestrator, FTS5 retrieval, and fleet patterns that
  survived overnight runs.
tags: [mcp, routing, rag, agents, orchestrator]
date: 2026-10-10
status: shipped
stack: [FastMCP, SQLite FTS5, Python stdlib, DuckDB, kanban fleet]
howItWorks:
  - Catalog every MCP server's tools with capability classes, then score natural-language goals against name and description signals into a ranked routing table.
  - Enforce policy before execution — deny-rules veto destructive candidates (duckdb_drop_table is DENIED in read-only mode); plans are dry-runnable.
  - Replay plans against golden fixtures so routing changes are testable — no LLM in the loop keeps decisions reproducible and auditable.
  - Measure the fleet with real stdio handshakes — p50/p95 per tool, cold start, error rate — because agent loops hang on the slowest tool.
  - Compose, don't concatenate — same-process import for zero-overhead calls, FTS5 stores for retrieval, pooled worker fleets for parallel execution.
proof:
  - mcp-router — deterministic NL-to-tool planner with deny-rules and dry-run traces, 13 of 13 golden goals, SHIPPED v0.2.0 = /opt/data/workspace/portfolio/mcp-router
  - mcp-bench — real stdio MCP handshake benchmarks, per-tool p50/p95, cold-start ms, 85 tests = /opt/data/workspace/portfolio/mcp-bench
  - Multi-MCP orchestrator — one CLI over six imported MCP servers, chained pipeline mode = /opt/data/workspace/orchestrator
  - wiki-search — FastMCP server over a SQLite FTS5 search engine = /opt/data/workspace/projects/wiki-search
  - hwdocs RAG store — chunked FTS5 store, 100 percent recall at 0.11 ms vs grep 88 percent at 1.63 ms = /opt/data/workspace/hwdocs
  - Agent-to-agent fleet runner — pooled kanban workers, dispatcher-exact spawn, overnight runbooks = /opt/data/skills/kanban-fleet-runner/SKILL.md
limits:
  - No LLM in the router loop is a feature and a limit — deterministic and golden-testable, but it plans on lexical signals, not semantics.
  - hwdocs retrieval is lexical FTS5 only; the fleet has an embedding model, but no embedding store is built yet — semantic recall is future work.
  - Worker fleets cap at about 8 concurrent sessions — a 15-worker dispatcher run crashed the box on RLIMIT_NPROC, documented not folklore.
  - Kanban workers cannot complete cards under an uncompleted parent umbrella — orchestrators must verify and force-close.
relatedPosts: [mcp-production-lessons, agent-proof-your-data-layer, duckdb-for-agent-workflows]
relatedProjects: [orchestrator, duckdb-mcp]
---

A fleet of MCP servers is only as good as the layer that routes, measures, and
composes it. Guardrails beat scores; golden tests beat vibes.

---
# DRAFT: links.source is a plausible GitHub URL, not a verified remote (real
# DRAFT: path: /opt/data/workspace/orchestrator). date/period are last-known
# DRAFT: activity estimates — confirm before launch.
title: Multi-MCP Orchestrator
slug: orchestrator
summary: >-
  Unified CLI over six imported MCP servers — code-quality metrics, tasks,
  system telemetry, static-site, wiki search, DuckDB analytics — plus a
  sandbox-wide wiki engine, exposed as ten subcommands with a chained
  pipeline mode and DuckDB-backed trend queries.
tags: [mcp, cli, python, orchestration, duckdb]
date: 2026-06-20
role: Design and implementation (solo)
status: shipped
period: "2026"
featured: false
relatedPost: mcp-production-lessons
stack: [Python, MCP servers, DuckDB, asyncio]
highlights:
  - "Direct Python import of six MCP server modules bypasses stdio/JSON-RPC overhead for same-process composition"
  - "Single _call_tool dispatcher normalizes divergent handler return shapes (tuple-with-dict vs list-of-TextContent) behind asyncio.run wrapping"
  - "Chained pipeline actions: scan, find, tasks, wiki, db, trends run as one command"
  - "Documented integration pitfalls: import order after sys.path setup, _tool_manager._tools vs _tool_map, dispatcher registration order"
---

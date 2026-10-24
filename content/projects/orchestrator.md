---
title: Multi-MCP Orchestrator
slug: orchestrator
summary: >-
  One CLI over six imported MCP servers — telemetry, tasks, wiki search,
  DuckDB analytics — as ten subcommands with chained pipelines and
  DuckDB trend queries. Plus a sandbox-wide wiki engine.
tags: [mcp, cli, python, orchestration, duckdb]
date: 2026-06-20
role: Design and implementation
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

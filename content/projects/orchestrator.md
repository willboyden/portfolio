---
# DRAFT: links.source is a plausible GitHub URL, not a verified remote (real
# DRAFT: path: /opt/data/workspace/orchestrator). date/period are last-known
# DRAFT: activity estimates — confirm before launch.
title: Multi-MCP Orchestrator
slug: orchestrator
summary: >-
  Unified CLI frontend over six MCP servers — audit, site, wiki, sandbox-wiki,
  tasks, sys, dashboard, run, db — wired together by direct Python imports
  instead of JSON-RPC, with a chained pipeline mode and DuckDB-backed trend
  queries.
tags: [mcp, cli, python, orchestration, duckdb]
date: 2026-06-20
role: Design and implementation (solo)
status: shipped
period: "2026"
featured: false
stack: [Python, MCP servers, DuckDB, asyncio]
highlights:
  - "Direct Python import of six MCP server modules bypasses stdio/JSON-RPC overhead for same-process composition"
  - "Single _call_tool dispatcher normalizes divergent handler return shapes (tuple-with-dict vs list-of-TextContent) behind asyncio.run wrapping"
  - "Chained pipeline actions: scan, find, tasks, wiki, db, trends run as one command"
  - "Documented integration pitfalls: import order after sys.path setup, _tool_manager._tools vs _tool_map, dispatcher registration order"
links:
  source: https://github.com/alexrivera/orchestrator
---

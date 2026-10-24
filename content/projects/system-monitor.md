---
# DRAFT: no links — the repo is local only (/opt/data/workspace/projects/
# DRAFT: system-monitor). Metrics verified by a fresh pytest run on 2026-10-08
# DRAFT: (61 passed). date = last commit touching the project (2026-10-07).
title: System Monitor MCP Fleet
slug: system-monitor
summary: >-
  Three monitoring services, zero runtime dependencies — an MCP query server,
  an alerting server, and a dashboard, all built on Python's standard library.
tags: [mcp, fastapi, python, monitoring, testing]
date: 2026-10-07
role: Design and implementation (solo)
status: shipped
period: "2026"
featured: false
stack: [Python 3.13, mcp SDK (FastMCP), FastAPI + Jinja2, sqlite3, /proc]
highlights:
  - "8 MCP tools for CPU, memory, disk, network, processes, uptime, health verdicts and a full snapshot — exact integer bytes from /proc and statvfs, CPU% from a two-sample /proc/stat delta"
  - "Every reading flows through a keyword-free module-level seam the tests monkeypatch with fixture files, so known-answer assertions (exact CPU%, exact memory bytes, exactly 2 violations on a breach fixture) pass identically under any machine load"
  - "Alert rules persist in a private sqlite db via ALERT_MCP_DB; the server refuses to open kanban.db/tasks.db and never writes outside /tmp, and the CLI exits 2 when any rule fires"
  - "The dashboard imports the two MCP modules read-only — neither file modified — and mounts HTML, /metrics, /tasks and /alerts routes; its tests use starlette TestClient with tmp dbs only"
  - "Hardened 2026-10-07 under mypy strict after an initial 2026-07-10 FastMCP build"
metrics:
  - tests = 61 passed (verified 2026-10-08)
  - MCP query tools = 8
  - dashboard routes = 4
---

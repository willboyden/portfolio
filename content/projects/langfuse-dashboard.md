---
# DRAFT: links.source is a plausible GitHub URL, not a verified remote (real
# DRAFT: path: /opt/data/workspace/langfuse-dashboard). Status is honest:
# DRAFT: shipped code, blocked data plane — see summary.
title: Langfuse Observability Dashboard
slug: langfuse-dashboard
summary: >-
  Air-gapped dashboard for Langfuse traces: a re-runnable fetch pipeline,
  KPIs and a trace drill-down. Its broker blocks data reads (403), so it
  ships an honest empty state with the 403 recorded verbatim.
tags: [llm, observability, langfuse, python, dashboards]
date: 2026-08-16
role: Design and implementation (solo)
status: active
period: "2026-08"
featured: false
relatedPost: langfuse-observability-pragmatic
stack: [Python, Langfuse SDK v4.14.3, Langfuse 3.200.0, vanilla JS/CSS]
highlights:
  - "Idempotent fetch pipeline: atomic rewrites, page- and cursor-based pagination, ~5000-item caps per collection"
  - "Credentials from environment only; no secret ever printed or written to disk"
  - "Single-file dashboard, zero network requests, data embedded as a JS const so it opens over file://"
  - "Trace explorer drills into the observations parent/child tree with latency, usage and I/O previews"
  - "Verified broker behaviour endpoint by endpoint: health/projects OK, traces/observations/sessions/scores all 403 — failure recorded, nothing fabricated"
---

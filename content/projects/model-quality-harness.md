---
# DRAFT: links.source is a plausible GitHub URL, not a verified remote — the
# DRAFT: repos live at /opt/data/workspace/<repo>. Confirm the real org/repo
# DRAFT: before launch. period/date = last verified run (2026-08-16 re-run).
title: Model Quality Harness
slug: model-quality-harness
summary: >-
  Deterministic tool-calling reliability benchmark for local LLMs behind an
  OpenAI-compatible LiteLLM broker: a fixed 8-scenario suite, simulated tool
  execution, rule-by-rule scoring with no LLM judge, and a standalone HTML
  dashboard rendered from the real results JSON.
tags: [evals, llm, testing, python, dashboards]
date: 2026-08-16
role: Design and implementation (solo)
status: shipped
period: "2026-08"
featured: true
stack: [Python 3.13, stdlib only, LiteLLM broker, OpenAI-compatible API, vanilla JS/CSS]
highlights:
  - "8-scenario fixed suite: single-tool lookups, multi-constraint calls, two-step dependencies, and a retry scenario where the simulator rejects the first call"
  - "Deterministic judge only — schema-valid tool-call JSON, parameter accuracy under normalization, and success criteria like call_made / params_exact / param_absent / answer_contains"
  - "Tracks silent failures HTTP 200 hides: empty_content_turns, reasoning_burn_turns (finish_reason=length with content null), finish_reason per turn"
  - "Proved the broker response-cached identical request bodies (~0.01 s replays); cache-busting user stamps restored real latency distributions (min 0.83 s / med 1.31 s / max 3.72 s)"
  - "Broker outages are recorded as failures with the real HTTP error body, never papered over"
metrics:
  - scenarios x models x reps = 8 x 3 x 2
  - best model run (cache-bust re-run) = 16/16 completed, 100% valid calls
links:
  source: https://github.com/alexrivera/model-quality-harness
---

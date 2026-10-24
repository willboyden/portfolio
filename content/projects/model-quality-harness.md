---
title: Model Quality Harness
slug: model-quality-harness
summary: >-
  Deterministic tool-calling reliability benchmark for local LLMs behind an
  OpenAI-compatible LiteLLM broker. Eight fixed scenarios, simulated tool
  execution, rule-by-rule scoring with no LLM judge — and a dashboard from
  real results.
tags: [evals, llm, testing, python, dashboards]
date: 2026-08-16
role: Design and implementation
status: shipped
period: "2026-08"
featured: false
relatedPost: eval-harness-silent-regressions
stack: [Python 3.13, stdlib only, LiteLLM broker, OpenAI-compatible API, vanilla JS/CSS]
highlights:
  - "8-scenario fixed suite: single-tool lookups, multi-constraint calls, two-step dependencies, and a retry scenario where the simulator rejects the first call"
  - "Deterministic judge only — schema-valid tool-call JSON, parameter accuracy under normalization, and success criteria like call_made / params_exact / param_absent / answer_contains"
  - "Tracks silent failures HTTP 200 hides: empty_content_turns, reasoning_burn_turns (finish_reason=length with content null), finish_reason per turn"
  - "Proved the broker response-cached identical request bodies (~0.01 s replays); cache-busting user stamps restored real latency distributions (min 0.83 s / median 1.29 s / max 3.72 s)"
  - "Broker outages are recorded as failures with the real HTTP error body, never papered over"
metrics:
  - scenarios x models x reps = 8 x 3 x 2
  - best model run (cache-bust re-run) = 16/16 completed, 100% valid calls
---

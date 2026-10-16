---
# DRAFT: no links — the repo is local only (/opt/data/workspace/portfolio/jobpilot).
# DRAFT: date = last verified git state (v1.5 SHIPPED 2026-10-10; v1.6–v1.8
# DRAFT: backend landed 2026-10-16 with 322 pytest green per commit 618c494 and
# DRAFT: 217 vitest per commit 1604f81).
title: Jobpilot — AI Job-Hunting Copilot
slug: jobpilot
summary: >-
  An agentic job-search copilot that treats the hunt itself as a managed
  pipeline — postings ingested from multiple sources pass a security-first
  screen (sanitize → allow/redact/block, raw bytes vaulted, 40+-payload
  adversarial matrix), a deterministic 0–100 matcher explains every score
  factor-by-factor, and plan-act agents turn matches into tailored resumes,
  cover letters and interview prep as version-controlled artifacts with a full
  application-tracking backend behind them.
tags: [ai-agents, llm, security, python, react]
date: 2026-10-16
role: Design and implementation (solo)
status: active
period: "2026-10"
featured: false
stack: [Python 3.13 stdlib, FastAPI + SSE, SQLite (WAL), React 19 + vendored Emotion, vitest + CDP e2e]
highlights:
  - "Security-first ingest as a first-class threat model — untrusted posting content is attacker input flowing into LLM prompts, so ingest always vaults raw bytes (never rendered or model-sent), sanitizes HTML, screens for prompt-injection / secret-leak / exfiltration and routes allow/redact/block with every decision logged to security_events plus a JSONL mirror"
  - "Explainable deterministic scoring, not LLM-scored — reproducible 0–100 fit over 4 factors (skills/keywords/seniority/location) with per-factor reasons and hand-computed known-answer tests; preference learning folds 👍/👎 rankings back into scores, clamped ±15"
  - "Git-for-your-resume artifacts — every tailor/cover-letter/interview-prep run produces a new artifact version (parent chain, seq numbers) with a rendered diff view, grounded in top-3 prior material and reusing existing artifacts when inputs are unchanged"
  - "Dual-model runtime with audit on every call — separate interactive and background lanes with per-call override in a ModelRouter, deterministic MockModelClient by default (golden-replay agent tests), any OpenAI-compatible endpoint behind JOBPILOT_LIVE=1, and llm_usage logging model/lane/task/tokens/latency/status"
  - "Full application-tracking backend (v1.7–v1.8) — one application per posting with stage/applied_at/notes/follow_up_at (schema v5), a followups-due route, CoverLetterAgent + InterviewPrepAgent on a threaded executor, and a v1.6 TalentScout sweep (ingest → evaluate → gate-shortlist → digest) on user search-parameter gates"
  - "Test discipline across the stack — 322 pytest green (v1.6–v1.8 backend, per commit 618c494), 217 vitest (v16 UI, per commit 1604f81), CDP e2e specs in real headless chrome, ruff clean and mypy --strict zero errors; make verify is the single gate"
metrics:
  - backend tests = 322 pytest green (v1.6–v1.8, 2026-10-16)
  - security tests = 78, including a 40+-payload adversarial matrix
  - frontend = 217 vitest + 11/11 CDP e2e specs
  - live feed = 300+ jobs/night from a GitHub-hosted source
---

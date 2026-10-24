---
title: Jobpilot — AI job-search copilot
slug: jobpilot
summary: >-
  A local job-search copilot: postings are screened for prompt injection,
  scored by an explainable matcher, and turned into tailored resumes and cover
  letters that fail the run if they invent a year or a number.
tags: [ai-agents, llm, security, python, react]
date: 2026-10-17
role: Design and implementation
status: active
period: "2026-10"
featured: false
relatedPost: security-first-ingest-prompt-injection
stack: [Python 3.13, FastAPI + SSE, SQLite (WAL), React 19 + Emotion, vitest + CDP e2e, local models through the lab's LiteLLM router]
highlights:
  - "Security-first ingest — posting text is attacker input on its way into a prompt, so raw bytes are vaulted (never rendered or sent to a model), HTML is sanitized, and every posting is screened for prompt injection, secret leaks and exfiltration, then allowed, redacted or blocked with the decision logged"
  - "Explainable deterministic scoring, not LLM scoring — a reproducible 0–100 fit over skills, keywords, seniority and location with a reason per factor; 👍/👎 rankings adjust scores by at most ±15"
  - "Grounded tailoring — resumes and cover letters are written from your own saved resume under a no-new-facts prompt, then checked: a year or number that is not in your material fails the run after one correction pass, and new names are listed for review"
  - "Git for your resume — every tailoring run produces a new version with a parent chain and a rendered diff"
  - "Application tracking — stages, notes, follow-up dates and an overdue banner, plus interview prep from your resume and documents"
  - "Runs on the lab's local models through the router under its own key; a deterministic mock model is the default for tests"
  - "1.9.0 security pass — loopback-only API (DNS-rebinding guard), CSRF refusal, strict CSP, upload size caps and generic error pages"
metrics:
  - backend tests = 438 passed (v1.9.0, run 2026-10-24)
  - adversarial ingest payloads = 40+
  - latest version = 1.9.0 (2026-10-17)
---

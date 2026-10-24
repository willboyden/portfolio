---
# Facts from the public README and release v0.2.0 (2026-10-17),
# github.com/willboyden/nemo-console. Checked 2026-10-24.
title: Nemo Console — a console for NVIDIA's routing and agent stack
slug: nemo-console
summary: >-
  One local page to monitor, configure and test NeMo Switchyard, NeMo Relay,
  Dynamo and SkillEvaluator. Config edits are validated, backed up and rolled
  back automatically if the service comes up unhealthy.
tags: [llm-routing, nemo-switchyard, observability, fastapi, security, open-source]
date: 2026-10-17
role: Design and implementation
status: active
period: "Sep–Oct 2026"
featured: true
relatedPost: routing-coding-agent-two-local-models
links:
  source: "https://github.com/willboyden/nemo-console"
stack: [Python 3.13, FastAPI, SQLite (WAL), SSE, Docker, systemd, ES modules + web components (no npm)]
highlights:
  - "One adapter per system plugs into a system-agnostic core; the UI renders from descriptors (status, metrics, config files, parameters, actions, playground), so SkillEvaluator was added as a single adapter file"
  - "A Switchyard routes.toml editor that validates, diffs, asks for confirmation, backs up, writes atomically, recreates the container, health-checks it and rolls back on its own if the new config is unhealthy"
  - "A routing summary by route, model, tier, tokens and errors, built from Switchyard's routing log, with 15-minute, 1-hour and 24-hour history"
  - "Actions carry danger levels (safe, disruptive, destructive) with mandatory confirmation; Dynamo start has a preflight that names what else is using the GPU"
  - "Security middleware on every call: loopback bind, Host allowlist, same-origin checks, CSRF header, hashed bearer keys with admin and viewer roles, strict CSP, and an argv-only process runner limited to five binaries"
  - "Every claim in the docs is labelled implemented, verified-live or unverified, and known gaps are listed in the README"
metrics:
  - backend tests = 467 passed from a clean copy (v0.2.0, 2026-10-17)
  - frontend tests = 96 passed
  - systems covered = 4 released + Data Designer (unreleased)
---

The routing layer in my lab is NVIDIA's NeMo Switchyard (tier routing with an
LLM judge) plus NeMo Relay (an agent gateway that traces every call). Both are
configured by editing TOML and restarting a container or a systemd unit, and a
bad edit takes routing down for every agent at once. Nemo Console wraps that
loop: see what each system is doing, change its config with a diff and an
automatic rollback, and send a test request through it, all from one page.

It was written against one deployment (pinned Switchyard 0.3.0, Relay 0.9.2,
Dynamo 1.5.0, SkillEvaluator 0.5.0), and the README says so: container names
and paths are constants in the adapters, and only the parts marked
verified-live were exercised against the real systems.

The write-up linked below covers what this console was watching: routing a
coding agent between a fast model and a large one, and the three bugs that
hid behind healthy-looking counters.

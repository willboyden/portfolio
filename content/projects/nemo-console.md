---
# Facts from the public README, CHANGELOG, RELEASE-NOTES and releases v0.3.1 (2026-10-24) and v0.4.0 (2026-10-28),
# github.com/willboyden/nemo-console. Checked 2026-10-24.
title: Nemo Console — one page for ten NVIDIA AI systems
slug: nemo-console
summary: >-
  A local console that monitors, configures and tests ten NVIDIA systems, from
  routing and serving to GPU telemetry, sandboxes, guardrails and evals.
  Config edits are validated, backed up and rolled back if the system comes up
  unhealthy.
tags: [llm-routing, nemo-switchyard, observability, security, rust, open-source]
date: 2026-10-24
role: Design and implementation
status: active
period: "Sep–Oct 2026"
featured: true
relatedPost: building-nemo-console
links:
  source: "https://github.com/willboyden/nemo-console"
stack: [Rust (axum, hyper, tokio), SQLite (WAL), SSE, Docker, systemd, Prometheus, ES modules + web components (no npm)]
highlights:
  - "0.4.0 rewrites the backend in Rust as a drop-in: same API, settings, database and launcher; all 936 Python tests mapped to Rust tests, and 1,392 of 1,393 side-by-side cases against the last Python backend identical (the one difference documented)"
  - "Ten systems in v0.3.0, grouped as routing (NeMo Switchyard, NeMo Relay), engines and load (Dynamo, DCGM, AIPerf), safety and sandboxing (NeMo Guardrails, OpenShell) and evaluation and data (SkillEvaluator, NeMo Evaluator, Data Designer)"
  - "One adapter per system behind a system-agnostic core; the UI renders from descriptors (status, metrics, config files, parameters, actions, playground), so each new system was one adapter file plus a small view"
  - "Config edits validate, diff, back up, write atomically, restart the system and roll back on their own if it comes up unhealthy — Switchyard and Relay routes, the DCGM exporter's field list, NeMo Guardrails rails and the AIPerf and Evaluator presets"
  - "Security checks surface as problems with one exact fix: a DCGM exporter older than 4.8.3 (CVE-2026-47483) or an open /debug/pprof, an OpenShell sandbox network that is not internal, a Guardrails server that can reach the internet"
  - "Trust files stay read-only (OpenShell's sandbox policy, Relay's plugin policy); NeMo Guardrails rails are editable, but a change that removes a rail needs an explicit marker line that lands in the diff and the audit log"
  - "Disruptive actions need confirmation: GPU diagnostics in a hardened throwaway container, AIPerf load tests, Evaluator benchmark runs, gateway start/stop"
  - "Security middleware on every call: loopback bind, Host allowlist, same-origin checks, CSRF header, hashed bearer keys with admin and viewer roles, strict CSP, and one argv-only process runner with a bare-name binary allowlist"
  - "Every claim in the docs is labelled implemented, verified-live or unverified; an independent security review of the 0.3.0 additions found no high-severity issue and every finding was fixed"
  - "A browser end-to-end test (the real backend and a headless Chrome, every page and tab) runs in CI and in a pre-push hook that refuses code it has not passed"
metrics:
  - systems managed = 10 (since v0.3.0)
  - backend tests = 837 passed from a clean clone (878 in the deployment checkout)
  - frontend tests = 121 passed
  - browser end-to-end = every page and tab (46 views) in headless Chrome, gating every push
  - latest release = v0.4.0 (2026-10-28), backend in Rust
---

My lab runs NVIDIA's routing layer (NeMo Switchyard and NeMo Relay), Dynamo, a
DCGM exporter on six machines, an OpenShell sandbox gateway, a NeMo Guardrails
server and four NVIDIA command-line tools (SkillEvaluator, Data Designer, AIPerf,
NeMo Evaluator). Each is configured differently — TOML,
YAML, CSV, compose files, systemd units — and a bad edit to a routing file takes
routing down for every agent at once. Nemo Console puts them on one page: see
what each system is doing, change its config with a diff and an automatic
rollback, run its checks, and send a test request through it.

## What 0.3.1 fixed

After the 0.3.0 update, the five newest pages showed "Something went wrong" in a
browser that had used an older version. The console served its files with no
caching instructions, so the browser kept an old shared module and paired it
with the new pages; one missing function was enough to stop all five from
loading. Every file is now checked with the server on each load.

Unit tests could not have seen that, so 0.3.1 adds a browser test: it starts the
real backend, signs in with a fresh key, and opens every page and tab in a
headless Chrome, failing on any error screen, script error, server error or
file served without that header. It runs in CI and in a pre-push hook that
refuses to push code it has not passed. Its first run from a fresh clone, with
no lab next to it, found two more bugs: a Dynamo parameter preview that crashed
with a server error and Config tabs that reported "Something went wrong" for
systems that are simply not deployed.

## What 0.3.0 added

Six systems joined the original four: Data Designer, OpenShell, DCGM, AIPerf,
NeMo Guardrails and NeMo Evaluator. The release also fixed three bugs found
along the way: `nemo-console stop` hung while a browser held a live event
stream, three status caches skipped their check for the first minute after a
reboot (a fresh CI runner caught it), and per-GPU charts were empty because a
label held spaces.

It was written against one deployment, and the README says so: container names
and paths are settings or constants, and only the parts marked verified-live were
exercised against the real systems.

The write-up linked below covers what this console was first built to watch:
routing a coding agent between a fast model and a large one.

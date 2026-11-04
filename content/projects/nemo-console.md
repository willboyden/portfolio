---
# Facts from the public README, CHANGELOG, RELEASE-NOTES and releases v0.3.1 (2026-10-24), v0.4.0 (2026-10-28),
# v0.5.0 (2026-11-03) and v0.6.0 (2026-11-04), github.com/willboyden/nemo-console. Checked 2026-11-04.
title: Nemo Console — one page for twelve NVIDIA AI systems
slug: nemo-console
summary: >-
  A local console that monitors, configures and tests twelve NVIDIA systems,
  from routing and serving to GPU telemetry, sandboxes, guardrails, evals,
  model compression and RL rollouts. Config edits are validated, backed up and
  rolled back if the system comes up unhealthy, and every page has its own
  getting-started guide and FAQ.
tags: [llm-routing, nemo-switchyard, observability, security, rust, open-source]
date: 2026-10-24
role: Design and implementation
status: active
period: "Sep–Nov 2026"
featured: true
relatedPost: building-nemo-console
links:
  source: "https://github.com/willboyden/nemo-console"
stack: [Rust (axum, hyper, tokio), SQLite (WAL), SSE, Docker, systemd, Prometheus, ES modules + web components (no npm)]
highlights:
  - "0.6.0 adds a Getting started tab and a FAQ tab to every system page: numbered steps from install to first use, the system's problem codes and refusals explained, commands with a Copy button and links to the tab each step needs"
  - "0.5.0 adds the eleventh and twelfth systems: NVIDIA Model Optimizer (offline checkpoint compression, started as a background job whose verdict and size the console reads) and NVIDIA NeMo Gym (RL rollouts in a client whose only way out is a router broker; a network that is not internal blocks a run)"
  - "0.4.0 rewrites the backend in Rust as a drop-in: same API, settings, database and launcher; all 936 Python tests mapped to Rust tests, and 1,392 of 1,393 side-by-side cases against the last Python backend identical (the one difference documented)"
  - "Twelve systems since v0.5.0, grouped as routing (NeMo Switchyard, NeMo Relay), engines and load (Dynamo, DCGM, AIPerf, Model Optimizer), safety and sandboxing (NeMo Guardrails, OpenShell) and evaluation and data (SkillEvaluator, NeMo Evaluator, NeMo Gym, Data Designer)"
  - "One adapter per system behind a system-agnostic core; the UI renders from descriptors (status, metrics, config files, parameters, actions, playground), so each new system was one adapter file plus a small view"
  - "Config edits validate, diff, back up, write atomically, restart the system and roll back on their own if it comes up unhealthy — Switchyard and Relay routes, the DCGM exporter's field list, NeMo Guardrails rails and the AIPerf and Evaluator presets"
  - "Security checks surface as problems with one exact fix: a DCGM exporter older than 4.8.3 (CVE-2026-47483) or an open /debug/pprof, an OpenShell sandbox network that is not internal, a Guardrails server that can reach the internet"
  - "Trust files stay read-only (OpenShell's sandbox policy, Relay's plugin policy); NeMo Guardrails rails are editable, but a change that removes a rail needs an explicit marker line that lands in the diff and the audit log"
  - "Disruptive actions need confirmation: GPU diagnostics in a hardened throwaway container, AIPerf load tests, Evaluator benchmark runs, gateway start/stop"
  - "Security middleware on every call: loopback bind, Host allowlist, same-origin checks, CSRF header, hashed bearer keys with admin and viewer roles, strict CSP, and one argv-only process runner with a bare-name binary allowlist"
  - "Every claim in the docs is labelled implemented, verified-live or unverified; an independent security review of the 0.3.0 additions found no high-severity issue and every finding was fixed"
  - "A browser end-to-end test (the real backend and a headless Chrome, every page and tab) runs in CI and in a pre-push hook that refuses code it has not passed"
metrics:
  - systems managed = 12 (since v0.5.0)
  - backend tests = 862 passed from a clean clone
  - frontend tests = 128 passed
  - browser end-to-end = every page and tab (77 views) in headless Chrome, gating every push
  - latest release = v0.6.0 (2026-11-04), backend in Rust
---

My lab runs NVIDIA's routing layer (NeMo Switchyard and NeMo Relay), Dynamo, a
DCGM exporter on six machines, an OpenShell sandbox gateway, a NeMo Guardrails
server and six NVIDIA command-line tools (SkillEvaluator, Data Designer, AIPerf,
NeMo Evaluator, Model Optimizer, NeMo Gym). Each is configured differently — TOML,
YAML, CSV, compose files, systemd units — and a bad edit to a routing file takes
routing down for every agent at once. Nemo Console puts them on one page: see
what each system is doing, change its config with a diff and an automatic
rollback, run its checks, and send a test request through it.

## What 0.6.0 added

Twelve systems means twelve sets of rules to remember: which actions spend
tokens, why a start is refused, what a problem code means. Each system page now
ends with two tabs that answer that on the page itself. Getting started says
what the system is and walks from install to first use in numbered steps; a
step that needs a command shows it with a Copy button (the console never runs
it) and a button that opens the tab the step talks about.

![The Getting started tab of the Dynamo page: what the system is, then numbered steps, each with a button that opens the tab it needs. Rendered from the repository's mock server, so the data is a canned demo](/posts/nemo-console/getting-started.png)

The FAQ tab collects the system's common questions, mostly the problem codes
and refusals its status and actions can show, and below them the questions
that apply on every page. A filter narrows the list and opens what matches.

![The FAQ tab of the NeMo Guardrails page: the system's own questions, then the questions about the console, with a filter and Expand all. Rendered from the mock server](/posts/nemo-console/faq.png)

The text is one plain-text file shown as text only, and the tabs are added once
in the shared page frame, so a future system gets them too. A test checks that
every system has a guide and an FAQ and that every link points at a tab or page
that exists; the browser test now opens 77 pages and tabs instead of 53. The
answers were written from the console's operations guide and feature matrix,
not re-checked against every live system.

## What 0.5.0 added

Two more systems, both driven through a lab wrapper and both running their
work in the background so a closed tab never stops it. Model Optimizer
compresses a pinned checkpoint offline: the console validates the recipe file,
starts a job that takes a GPU for hours, then reads its verdict, output size and
compression ratio; it never stops a running job. NeMo Gym runs reinforcement
learning rollouts in a client whose only way out is a router broker: the console
checks that containment, runs a small scored smoke rollout and keeps the
rewards. A client network that is not internal marks the system down and blocks
a run.

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

---
# Facts from the public README, CHANGELOG and RELEASE-NOTES, github.com/willboyden/nemo-console: releases v0.3.1
# (2026-10-24) to v0.10.0 (2026-11-05), and the Unreleased section of the CHANGELOG on main. Checked 2026-11-16.
title: Nemo Console — one page for thirteen NVIDIA AI systems
slug: nemo-console
summary: >-
  A local console that monitors, configures and tests thirteen NVIDIA systems,
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
stack: ["Rust (axum, hyper, tokio)", SQLite (WAL), SSE, Docker, systemd, Prometheus, ES modules + web components (no runtime dependencies)]
highlights:
  - "On main since 0.10.0, not yet in a tagged release: a trace explorer for NeMo Relay (five tabs read from the files Relay writes: traces as a waterfall, an icicle and a span table, whole agent sessions with their context growth, analytics, trajectories and capture levels), run history with an A/B compare on the eight run-based pages, and charts on every system page"
  - "0.10.0 adds a thirteenth system, NVIDIA Flare, NVIDIA's research-prototype inference server: its targets, starts that are refused while a target's GPUs look busy, probes and read-only lane files; the changelog labels it unverified on hardware, since no package had been served yet"
  - "0.8.0 and 0.9.0 add a config editor: a Form view with a typed control and an info button per setting, where an edit rewrites only that value's characters so comments and layout survive, a Text view, and an Edit checks panel that updates as you type; the server's validator still decides"
  - "0.6.0 adds a Getting started tab and a FAQ tab to every system page, and 0.7.0 to the console's own pages: numbered steps from install to first use, the system's problem codes and refusals explained, commands with a Copy button and links to the tab each step needs"
  - "0.5.0 adds the eleventh and twelfth systems: NVIDIA Model Optimizer (offline checkpoint compression, started as a background job whose verdict and size the console reads) and NVIDIA NeMo Gym (RL rollouts in a client whose only way out is a router broker; a network that is not internal blocks a run)"
  - "0.4.0 rewrites the backend in Rust as a drop-in: same API, settings, database and launcher; all 936 Python tests mapped to Rust tests, and 1,392 of 1,393 side-by-side cases against the last Python backend identical (the one difference documented)"
  - "Thirteen systems since v0.10.0, grouped as routing (NeMo Switchyard, NeMo Relay), engines and load (Dynamo, Flare, DCGM, AIPerf, Model Optimizer), safety and sandboxing (NeMo Guardrails, OpenShell) and evaluation and data (SkillEvaluator, NeMo Evaluator, NeMo Gym, Data Designer)"
  - "One adapter per system behind a system-agnostic core; the UI renders from descriptors (status, metrics, config files, parameters, actions, playground), so each new system was one adapter file plus a small view"
  - "Config edits validate, diff, back up, write atomically, restart the system and roll back on their own if it comes up unhealthy — Switchyard and Relay routes, the DCGM exporter's field list, NeMo Guardrails rails and the AIPerf and Evaluator presets"
  - "Security checks surface as problems with one exact fix: a DCGM exporter older than 4.8.3 (CVE-2026-47483) or an open /debug/pprof, an OpenShell sandbox network that is not internal, a Guardrails server that can reach the internet"
  - "Trust files stay read-only (OpenShell's sandbox policy, Relay's plugin policy); NeMo Guardrails rails are editable, but a change that removes a rail needs an explicit marker line that lands in the diff and the audit log"
  - "Disruptive actions need confirmation: GPU diagnostics in a hardened throwaway container, AIPerf load tests, Evaluator benchmark runs, gateway start/stop"
  - "Security middleware on every call: loopback bind, Host allowlist, same-origin checks, CSRF header, hashed bearer keys with admin and viewer roles, strict CSP, and one argv-only process runner with a bare-name binary allowlist"
  - "Every claim in the docs is labelled implemented, verified-live or unverified; an independent security review of the 0.3.0 additions found no high-severity issue and every finding was fixed"
  - "A browser end-to-end test (the real backend and a headless Chrome, every page and tab) runs in CI and in a pre-push hook that refuses code it has not passed"
metrics:
  - systems managed = 13 (since v0.10.0)
  - backend tests = 883 passed from a clean clone (v0.10.0)
  - frontend tests = 160 passed (v0.10.0)
  - browser end-to-end = every page and tab (92 views at v0.10.0) in headless Chrome, gating every push
  - latest release = v0.10.0 (2026-11-05), backend in Rust
---

My lab runs NVIDIA's routing layer (NeMo Switchyard and NeMo Relay), Dynamo, a
DCGM exporter on six machines, an OpenShell sandbox gateway, a NeMo Guardrails
server and six NVIDIA command-line tools (SkillEvaluator, Data Designer, AIPerf,
NeMo Evaluator, Model Optimizer, NeMo Gym). Each is configured differently — TOML,
YAML, CSV, compose files, systemd units — and a bad edit to a routing file takes
routing down for every agent at once. Nemo Console puts them on one page: see
what each system is doing, change its config with a diff and an automatic
rollback, run its checks, and send a test request through it. The thirteenth
system, NVIDIA Flare, has its page and its launcher but has not served a model
here yet.

## On main since 0.10.0

Three things are merged and running in my lab, and wait for the next tagged
release.

**A trace explorer for NeMo Relay.** Relay writes what agents did through it
to files on the machine. Five new tabs on the Relay page read them: a trace as
a waterfall, an icicle and a span table that share one selection; every trace
of an agent session on one timeline, with the context growing call by call;
analytics; trajectories step by step; and a Capture tab that says which of
Relay's capture levels are on and what a reader of the traces is missing.
Viewers get metadata only. Prompts and completions are a separate admin view
with secrets scrubbed, and it can be switched off. The charts are
dependency-free SVG, so the Content-Security-Policy did not change. The story
is in
[Turning up NeMo Relay's tracing, and building a place to read it](/writing/nemo-relay-tracing-and-trace-views).

![A trace in Nemo Console: an agent run with its turns, model calls, tool calls and a subagent as a waterfall. Rendered from the repository's mock server, so the data is a canned demo](/posts/nemo-relay-traces/trace-waterfall.png)

**Run history.** The eight pages that run something (AIPerf, NeMo Evaluator,
NeMo Gym, Model Optimizer, SkillEvaluator, Data Designer, GPU diagnostics and
Guardrails checks) keep their runs: a verdict timeline, the trend of any
recorded number across runs, and an A/B compare of two runs that marks each
difference better or worse.

**Charts on every system page.** One route returns up to twelve metrics for 15
minutes, an hour, a day or a week, each bucket's maximum beside its average.
On top of it: a heatmap of every GPU on every machine, a decisions-and-models
tab for Switchyard, latency split into queue, prefill and decode for Dynamo,
percentile curves for load tests, and a summary of the audit log.

## What 0.10.0 added

NVIDIA Flare, a thirteenth system: NVIDIA's research-prototype inference
server, on workstation GPUs and on DGX Sparks. Everything goes through a lab
launcher that defines the targets, refuses to start while a target's GPUs look
busy and never stops another engine. The page shows each target and whether its
GPUs are free, Flare's own counters while it serves, and actions to check a
start, start, stop and probe. The changelog says plainly what is unverified: no
Flare package had been prepared or served on any target yet, so the start paths
are written against upstream's documentation.

## What 0.8.0 and 0.9.0 added

A config editor. TOML and YAML files open in a Form view with one section per
table and a typed control per value: switches, drop-downs for fixed choices,
number fields that refuse anything else. An edit rewrites only that value's
characters, so comments and layout survive and the diff shows exactly what
changed. A Text view sits beside it, and an Edit checks panel updates as you
type: syntax errors with their line, each file's schema rules, cross-references
between routes, and secret-looking values the backend would refuse. The
server's validator still decides on Check and before every Apply. Since 0.9.0
every setting has an info button that says what it is, what changing it does,
the values it accepts and when a change takes effect.

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
not re-checked against every live system. 0.7.0 gave the console's own pages
(Overview, Audit and Settings) the same two tabs; by 0.10.0 the browser test
opens 92 pages and tabs.

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

---
# Facts from the public repository github.com/willboyden/harness2-workbench (README feature
# matrix, docs/, CHANGELOG, CI) as of 2026-10-24, and from harness2's own README for the method.
title: Harness² Workbench — a contained GUI, REST API and MCP server for harness2
slug: harness2-workbench
summary: >-
  An unofficial, open-source workbench around Google Research's harness2: one
  Rust server with roles, a job queue, an audit trail and container isolation,
  a WebAssembly UI for everything harness2 writes, and an MCP server so AI
  agents can run and analyse sweeps under the same rules as people.
tags: [agents, evals, mcp, rust, webassembly, security, open-source]
date: 2026-10-24
role: Design and implementation
status: active
period: "Oct 2026"
featured: true
relatedPost: building-harness2-workbench
links:
  source: "https://github.com/willboyden/harness2-workbench"
stack: [Rust, Axum and Tokio, Leptos (WebAssembly), rmcp (MCP), SQLite (WAL), OpenTelemetry, Prometheus, Docker or Podman, GitHub Actions]
highlights:
  - "Every harness2 operation as a queued job with live logs, cancellation, a timeout and, for runs, an optional spend guard: install at the tested commit, the offline demo, benchmark setup and checks, previews, sweeps in both recursion modes, judging, reports, splits, pipelines and the Codex bridge"
  - "Everything harness2 writes, browsable: task scores, the eight-component harness of every candidate, the diff to the adopted harness, rollouts, experience libraries, the improver's own audit trail, sign-test comparisons, and exports to an OpenCode or Codex project"
  - "One Rust server owns jobs, state and access: API tokens and browser sessions with viewer, operator and admin roles, single sign-on behind a trusted proxy, write-only secrets, a hash-chained audit log, Prometheus metrics and OpenTelemetry traces"
  - "An MCP server with 42 tools that forwards each caller's own token, holds no power of its own, and refuses to let a model accept host-execution risk on a person's behalf"
  - "Container isolation for untrusted work: each step in a runner image with every capability dropped, no new privileges and an internal network whose only exit is an allowlisting egress proxy"
  - "Defensive reading of what jobs write: files opened without blocking or following links, per-request byte and sweep budgets with cancellation, a 64 MiB response cap and about 1 MiB log pages"
  - "Two independent security reviews (27 findings, most with a working reproduction) and a documentation pass; each fixed, or narrowed and recorded in a STRIDE threat model"
  - "Supply chain held to a 14-day cooldown checked on every push, SHA-pinned Actions, cargo-deny, gitleaks, CodeQL and Scorecard, an SBOM and provenance in the release workflow, and the licence texts of every crate compiled in"
  - "A feature matrix that labels every feature verified live, fakes only or unverified, including that no model-backed sweep has been run through it yet"
metrics:
  - REST API = 49 operations, OpenAPI 3.1
  - MCP = 42 tools, 3 resource forms, 3 prompts
  - tests = 641 unit and integration, plus 7 end-to-end against a real server and the real harness2 demo
  - security reviews = 2 independent reviews, 27 findings
  - documentation = about 72,000 words and 8 decision records
  - harness2 tested against = commit 1cfe254
  - release = 0.1.0 (24 October 2026), x86_64 and aarch64 Linux
---

[harness2](https://github.com/google-research/harness2) is Google Research's
framework for **recursive agent harnessing**: it improves the system around a
model (its prompts, guardrails, memory, tool guidance, subagents, skills,
scripts and plugins) task by task, without touching the model's weights. It is
a research framework, driven from a terminal with environment variables, long
runs and results as files.

Harness² Workbench is what goes around it when more than one person, or an AI
agent, needs to use it safely. It drives harness2 through its own command line
and reads what it writes, never modifying it. It is unofficial and not
affiliated with Google; the method belongs to the paper's authors.

![The Workbench dashboard on a real server: harness2 installed at the tested commit, environment checks with their fixes, and the finished demo jobs](/posts/harness2-workbench/dashboard.png)

## What makes it more than a UI

- **One enforcement point.** The web UI, the REST API and the MCP server all
  go through the same server, which checks roles on every call and writes the
  audit log. An AI agent never has more than the rights of its token.
- **Honest isolation.** Host mode runs executors as the Workbench's own user,
  which makes a hostile executor an administrator, and the README says so in
  bold. Container mode exists for exactly that case.
- **Hostile-input reading.** A job controls the files the Workbench reads
  back, so the readers have limits on type, size, total, time and
  concurrency. The security reviews showed why each one is needed.
- **Proof over claims.** Every feature is labelled verified live, fakes only or
  unverified, and the limits are written down: only harness2's free offline
  demo has been run end to end; model-backed sweeps are parsed against
  recorded output.

## Try it

[Version 0.1.0](https://github.com/willboyden/harness2-workbench/releases/tag/v0.1.0)
has archives for x86_64 and aarch64 Linux, with checksums, an SBOM and build
provenance. The README's first quick start goes from a harness2 checkout to
the free offline demo, which needs no credentials and no network.

![What changed in a harness: the diff between a task's base harness and the one harness2 adopted, from a real demo run](/posts/harness2-workbench/task-diff.png)

## The series

The full story is in six posts: the
[architecture](/writing/building-harness2-workbench), the
[MCP server](/writing/mcp-server-for-an-agent-harness), the
[two security reviews](/writing/security-reviews-of-a-localhost-control-plane),
the [dependency cooldown and Dependabot](/writing/dependency-cooldown-and-dependabot),
[four flaky tests](/writing/flaky-tests-a-fast-machine-hides) and
[taking the repository public](/writing/taking-a-repository-public).

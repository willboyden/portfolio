---
# Facts from the public repository github.com/willboyden/harness2-workbench (README feature
# matrix, docs/, CHANGELOG and release notes 0.1.0 to 0.2.0) as of 2026-11-16, and from harness2's
# own README for the method.
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
period: "Oct–Nov 2026"
featured: true
relatedPost: building-harness2-workbench
links:
  source: "https://github.com/willboyden/harness2-workbench"
stack: [Rust, Axum and Tokio, Leptos (WebAssembly), rmcp (MCP), SQLite (WAL), OpenTelemetry, Prometheus, Docker or Podman, GitHub Actions]
highlights:
  - "Every harness2 operation as a queued job with live logs, cancellation, a timeout and, for runs, an optional spend guard: install at the tested commit, the offline demo, benchmark setup and checks, previews, sweeps in both recursion modes, judging, reports, splits, pipelines and the Codex bridge"
  - "Everything harness2 writes, browsable: task scores, the eight-component harness of every candidate, the diff to the adopted harness, rollouts, experience libraries, the improver's own audit trail, sign-test comparisons, and exports to an OpenCode or Codex project, a Hermes Agent home or a Turnstone bundle"
  - "One Rust server owns jobs, state and access: API tokens and browser sessions with viewer, operator and admin roles, single sign-on behind a trusted proxy, write-only secrets, a hash-chained audit log, Prometheus metrics and OpenTelemetry traces"
  - "An MCP server with 43 tools that forwards each caller's own token, holds no power of its own, and refuses to let a model accept host-execution risk on a person's behalf"
  - "Container isolation for untrusted work: each step in a runner image with every capability dropped, no new privileges and an internal network whose only exit is an allowlisting egress proxy"
  - "Defensive reading of what jobs write: files opened without blocking or following links, per-request byte and sweep budgets with cancellation, a 64 MiB response cap and about 1 MiB log pages"
  - "Two independent security reviews (27 findings, most with a working reproduction) and a documentation pass; each fixed, or narrowed and recorded in a STRIDE threat model"
  - "Supply chain held to a 14-day cooldown checked on every push, SHA-pinned Actions, cargo-deny, gitleaks, CodeQL and Scorecard, an SBOM and provenance in the release workflow, and the licence texts of every crate compiled in"
  - "A feature matrix that labels every feature verified live, fakes only or unverified, including how little is proven on real models: the README records one model-backed sweep, a single LAB task on self-hosted open-weight models, which proves the pipeline, not a result"
  - "0.1.3 makes LAB measurements fair under container isolation and compares a refinement with the harness it started from, beside a measured noise floor: in one ten-task rerun the same starting harness moved 3.9 points per task on average"
  - "0.1.4 adds cloud judges behind a confirmation that the data is synthetic, Hermes Agent and Turnstone as LAB executors when the installed harness2 ships them, and exports that convert a harness between the OpenCode, Codex, Hermes Agent and Turnstone layouts"
  - "0.1.1 adds offline install bundles (export, verify, import) for a host whose Workbench and jobs must not reach the internet; 0.2.0 adds Getting started and a FAQ on every page, an (i) explanation on form fields and a read-only server configuration editor for administrators"
metrics:
  - REST API = 52 operations, OpenAPI 3.1
  - MCP = 43 tools, 3 resource forms, 3 prompts
  - tests = 776 unit and integration, plus 8 end-to-end against a real server and the real harness2 demo
  - security reviews = 2 independent reviews, 27 findings
  - documentation = about 82,000 words and 9 decision records
  - harness2 tested against = commit 1cfe254
  - release = 0.2.0 (5 November 2026), x86_64 and aarch64 Linux
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
  unverified, and the limits are written down. Besides harness2's free offline
  demo, the README records one model-backed sweep run end to end: one LAB task,
  in container isolation, behind an egress allowlist that held only a gateway
  to self-hosted open-weight models. In its own words, one task proves the
  pipeline, not a result.

## Try it

[Version 0.2.0](https://github.com/willboyden/harness2-workbench/releases/tag/v0.2.0)
has archives for x86_64 and aarch64 Linux, with checksums, an SBOM and build
provenance. The README's first quick start goes from a harness2 checkout to
the free offline demo, which needs no credentials and no network.

![What changed in a harness: the diff between a task's base harness and the one harness2 adopted, from a real demo run](/posts/harness2-workbench/task-diff.png)

## What 0.1.1 to 0.2.0 added

**The first model-backed run, and what it broke (0.1.1).** The first sweep on
real models ended with every rollout at zero turns: the executor fetched a
model catalogue at start-up and crashed on the egress proxy's refusal. The
server now switches those downloads off for OpenAI-compatible profiles, and the
same task then ran end to end: preview, run, judging of the refined and the
starting harness, and the report. The release also added offline install
bundles, so a host with no internet can receive a complete harness2
installation with a checksum.

**Fair measurements (0.1.3).** Under container isolation, LAB's document reader
could not start its own container, so every read of a .docx, .pdf, .pptx or
.xlsx file failed until the agent found a way around it. Refined harnesses had
learned the workaround and starting harnesses had not, so refinement got credit
for fixing the environment. The runner image now carries a stand-in that runs
only LAB's own parser. A comparison can also take a sweep's starting harness as
one side, and it shows a noise floor: how far the same starting harness moves
between runs on the compared tasks.

**More executors and judges (0.1.4).** A profile's judge can be a cloud model,
and judging then asks for confirmation that the experiment's data is generated
or synthetic, because a cloud judge sees every task and every output it
grades. When the installed harness2 ships them, Hermes Agent and Turnstone are
offered as LAB executors beside OpenCode and Codex. Export turns any harness
into an OpenCode project, a Codex project, a Hermes Agent home or a Turnstone
bundle, and refuses what a framework has no counterpart for.

**Help on the page (0.2.0).** Every page has a Getting started and FAQ panel,
form fields explain themselves through an (i) button, and administrators get a
server configuration editor that validates a draft with the server's own
loader and never writes the file.

## The series

The full story is in six posts: the
[architecture](/writing/building-harness2-workbench), the
[MCP server](/writing/mcp-server-for-an-agent-harness), the
[two security reviews](/writing/security-reviews-of-a-localhost-control-plane),
the [dependency cooldown and Dependabot](/writing/dependency-cooldown-and-dependabot),
[four flaky tests](/writing/flaky-tests-a-fast-machine-hides) and
[taking the repository public](/writing/taking-a-repository-public).

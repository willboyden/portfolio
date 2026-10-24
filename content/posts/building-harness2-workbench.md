---
title: "Building Harness² Workbench around Google's harness2"
slug: building-harness2-workbench
summary: >-
  harness2 improves an AI agent's harness task by task, from a terminal. The
  Workbench wraps it, unmodified, in one Rust server with roles, a job queue,
  an audit trail, container isolation and an MCP server, so a team and its AI
  agents can use it under the same rules.
tags: [agents, evals, mcp, rust, webassembly, security, open-source]
date: 2026-10-24
series: Harness² Workbench
relatedProject: harness2-workbench
relatedPosts: [mcp-server-for-an-agent-harness, security-reviews-of-a-localhost-control-plane]
---

In October 2026 Google Research released
[harness2](https://github.com/google-research/harness2), the code behind the
paper *Harness²: Recursive Agent Harnessing for an Open World*. A **harness**
is everything around a model that lets it act as an agent: the system prompt,
guardrails, memory, tool guidance, subagents, skills, scripts and plugins.
harness2 improves that harness one task at a time without touching the model's
weights. For each task it **proposes** edits, **probes** them by running the
task again, and **composes** a refined harness from how the runs behaved
differently. A second, slower loop keeps an *improvement harness* with the
harnesses it adopted and the lessons it drew, and uses them on the next task.
On three professional benchmarks the authors report that a single step
improves two models over their base harnesses: by up to 11.5 points on
WorkBuddy-Bench, 4.5 points on JobBench and 11.8 percentage points on LAB's
partial pass rate.

It is a research framework, and it feels like one. You install it into a
Python 3.12 virtualenv, export a handful of environment variables, start a
long run by hand, watch it scroll and then read the results as files: one
directory per task, eight harness components per candidate, rollouts,
trajectories and judge verdicts. That works for one researcher at one
terminal. It does not work when several people share a machine, when the run
spends real money on cloud models, or when you want an AI coding agent to
start and analyse sweeps without handing it a shell.

[Harness² Workbench](https://github.com/willboyden/harness2-workbench) is what
I designed and shipped around it: an unofficial, Apache-2.0 GUI, REST API and MCP server that
drives harness2 through its own command line and reads what it writes. It does
not modify harness2, and it is not affiliated with Google; the method and its
credit belong to the paper's authors. Version 0.1.0 is pinned to, and tested
against, harness2 commit `1cfe254`.

This post is the overview: what the Workbench does, how it is put together,
and where its limits are. The other posts in the series go deep on the MCP
server, the two security reviews, the supply-chain rules, four flaky tests and
taking the repository public.

![The Workbench dashboard on a real server: harness2 0.1.0 installed at the tested commit, environment checks with exact fixes, two finished demo jobs and the demo experiment](/posts/harness2-workbench/dashboard.png)

## What it does

Every harness2 operation becomes a **job**: installing harness2 at the tested
commit, the free offline demo, benchmark setup and readiness checks, dry-run
previews, refinement sweeps in either recursion mode with every flag, judging,
reports, train/test splits, multi-step pipelines and the Codex bridge. Jobs
queue, stream their logs live, can be cancelled, stop on a timeout, and a run
can carry an optional spend limit.

Everything harness2 writes can be browsed instead of opened by hand: the
tasks of a sweep with their scores, the harness tree of every candidate (the
eight components, from `c1` system prompt to `c8` plugins), the diff between
the base harness and the one harness2 adopted, the rollouts and their
trajectories, the experience library the improver builds, the improver's own
audit trail, and reports. Two results can be compared task by task with a
sign test that says, in plain words, whether a difference is more than chance.
An adopted harness can be exported as raw files or as an OpenCode or Codex
project, ready to use outside harness2.

![The harness viewer on a real demo run: every candidate harness of a task, the adopted one marked, its files grouped by the eight components with the always-on budget, and the selected file's contents](/posts/harness2-workbench/task-harnesses.png)

Around that sit the things a shared tool needs: API tokens with three roles
(viewer, operator, admin), browser sessions and single sign-on behind a
trusted proxy; write-only secrets with best-effort redaction from logs; model
profiles for Vertex AI and OpenAI-compatible endpoints; a cost estimate before
a run; an environment doctor that names the fix for each problem it finds; a
hash-chained audit log; Prometheus metrics and OpenTelemetry traces; and a
guided tour for someone who has never heard of harness2.

![What changed in a harness: the diff between a task's base harness and the one harness2 adopted, from a real demo run](/posts/harness2-workbench/task-diff.png)

## How it is built

![Harness² Workbench architecture: browsers and MCP agents reach one Rust server, which owns authentication, roles, the audit log and SQLite, reads plain harness2 experiment directories, and starts harness2 jobs on the host or in a hardened container behind an egress allowlist](/posts/harness2-workbench/architecture.svg)

The Workbench is a Rust workspace of six crates: `h2w-api` (the wire types),
`h2w-core` (the domain logic: harness2's command lines, its file layouts, the
results readers), `h2w-daemon` (the server), `h2w-web` (the UI, compiled to
WebAssembly), `h2w-mcp` (the MCP server) and an end-to-end test crate, plus a
mock API for UI work and a build tool. Eight architecture decision records
explain the choices; the ones that shaped everything else:

- **Wrap the CLI, never import the Python.** harness2 has no library API; its
  command line and its on-disk layout are its contract. Running it as a
  separate process, with an explicit argument vector and no shell, keeps its
  crashes out of the server and lets an existing checkout keep working
  unchanged.
- **One server owns everything.** Jobs, state, authentication, roles and the
  audit log live in one process. The MCP server is a thin client that forwards
  the caller's token to the REST API, so an agent never has more than the
  rights of its token, and roles, limits and the audit log live in one place.
- **SQLite for state, plain directories for results.** A single-node tool does
  not need Postgres. Each experiment is an ordinary harness2 run directory, so
  harness2's own tools still work on it.
- **One language end to end.** The UI is [Leptos](https://leptos.dev),
  rendered in the browser and compiled to WebAssembly, sharing its types with
  the server. It loads under a strict Content-Security-Policy with no inline
  script or style at all, because this is an admin page that can start
  processes.
- **Two isolation modes.** `host`, the default, runs executors the way
  upstream does, as the server's own user, and a host-mode run or pipeline has
  to acknowledge that risk explicitly; `container` runs each step in a hardened
  runner image whose only way out is an allowlisting egress proxy.

The interfaces were written down before any of the implementation:
`docs/ARCHITECTURE.md` is a build contract with the wire types locked, and
apart from the project's own rename before its first push, every later
change to it was additive and versioned (four addenda, v1.1 to v1.4). The REST API is generated from those types as an OpenAPI 3.1 document
with 49 operations, and the MCP server exposes 42 tools on top of it.

## Running jobs safely

A harness2 sweep starts executors (OpenCode or Codex) that read and write
files, call models and run code. The job engine treats that seriously:

- **Every step gets its own process group**, so a cancel reaches everything
  the step started: SIGTERM, then SIGKILL after a grace period.
- **Restart recovery identifies before it signals.** If the server crashes
  with jobs running, the next start fails those jobs and stops their
  processes, but only after a positive identification: the same boot, the
  recorded leader's start time, and a `H2W_JOB_ID` marker that every step
  carries in its environment. A process group that cannot be identified is
  left alone. One CI run caught that check misreading a process in the middle
  of an `exec`; the [flaky-tests post](/writing/flaky-tests-a-fast-machine-hides)
  tells that story.
- **Limits are on by default:** a cap on each job's stored log (256 MiB), a
  free-disk floor that stops running jobs and a timeout. A run or pipeline can
  also carry a budget; its guard watches the improver spend harness2 records
  (executor spend is not recorded there, which the model guide says).
- **Container isolation** runs each step with every Linux capability dropped,
  `no-new-privileges`, a process limit and an internal network, as the server's
  own unprivileged user (on a rootless runtime that is container root, which
  maps to it).
  Job variables reach the container through a 0600 environment file, not
  through the container runtime's own environment. The egress proxy allows
  only listed hostnames and ports: an IP literal never matches, and a name
  that resolves to a private address is refused unless its entry allows it.

The honest part is written into the README in bold: **host isolation is not a
sandbox.** An executor in host mode runs as the Workbench's own user, so a
malicious or prompt-injected one can read the Workbench's database and rewrite
its files. It is, in effect, an administrator. Container isolation exists for
exactly that reason, and the docs say which mode each deployment gives you.

![A live job (fictional mock data): progress, steps, and the log streaming over server-sent events with stdout, stderr and server lines](/posts/harness2-workbench/mock-job-live.png)

## Reading what a job wrote, without trusting it

Everything a job writes is untrusted: a prompt-injected executor controls the
files the Workbench later reads to show results. Two independent security
reviews spent much of their effort here, and the
[security post](/writing/security-reviews-of-a-localhost-control-plane) has the
details. The result is a reader that opens files without following symlinks
and without blocking (a FIFO swapped in for `summary.json` used to hang a
worker thread forever), refuses anything over its size cap, charges every
request against a budget of bytes and sweeps, stops when the client goes away,
and caps a response at 64 MiB and a log page at about 1 MiB.

## The interface

The web UI is a single-page application that the server embeds and serves
itself. It has a dashboard, an experiment and sweep browser, a task view with
harness trees, diffs, rollouts and exports, a run wizard with a cost estimate,
live job pages, the comparison view, settings for profiles, secrets, tokens
and the audit log, a command palette and keyboard shortcuts, a dark theme and
a phone layout. Each role sees only what it may use, and the docs list which
pages were exercised against a real server and which only against the mock
API.

![Comparing two results task by task with a sign test (fictional mock data)](/posts/harness2-workbench/mock-compare.png)

## What is proven, and what is not

The README's feature matrix gives every feature two labels: whether it is
implemented, and whether it was **verified live**, covered by tests with
**fakes only**, or **unverified**. That table is the most useful thing in the
repository, because it is also the most honest:

- 641 unit and integration tests and 7 end-to-end tests run on every push. The
  end-to-end suite starts the real server and the real harness2 demo, drives the
  UI in headless Firefox and runs the demo through an MCP client.
- The REST API, sign-in, most of the job engine, container isolation, the
  egress proxy, the MCP server and most of the UI were verified live against a
  real server and the free demo. Cancelling a running job, the timeout and the
  budget guard are covered by tests with stand-ins only.
- **No model-backed sweep has been run through the Workbench.** The only real
  harness2 workflow exercised end to end is the offline demo. Benchmark
  sweeps are parsed against recorded harness2 output, and WorkBuddy-Bench is
  partial because upstream supports it only on Vertex AI.
- Two independent security reviews found 27 issues between them, and a final
  documentation pass found three more in the code. Each one was fixed, or
  narrowed and recorded in the threat model as a residual risk. No human
  penetration test has been done.

The documentation runs to about 72,000 words: a user guide with screenshots, an
administrator's guide with the full configuration reference, REST API and MCP
guides, a model-profile guide, a STRIDE threat model, troubleshooting indexed
by exact error message, the eight decision records and a supply-chain policy.
A link checker fails the build on any broken relative link or anchor.

## Shipping it

[Version 0.1.0](https://github.com/willboyden/harness2-workbench/releases/tag/v0.1.0)
came out on 24 October 2026. The release workflow built archives for x86_64
and aarch64 Linux with checksums, a CycloneDX SBOM, GitHub build-provenance
attestations and the licence texts of every crate compiled in, as a draft. It
was published only after a downloaded archive matched its checksum and the
binary ran the demo. A runner image and an all-in-one
image build from the repository, and a reference Compose deployment puts the
Workbench on an internal network with the egress proxy and TLS in front.

What I would do next is the obvious gap: run real, model-backed sweeps through
it on each benchmark and turn the "fakes only" rows of the feature matrix into
"verified live". The rest of the series covers what it took to get here:

- [An MCP server for an agent harness that will not let a model accept risk for you](/writing/mcp-server-for-an-agent-harness)
- [Two security reviews of a localhost control plane](/writing/security-reviews-of-a-localhost-control-plane)
- [A 14-day dependency cooldown, and three ways Dependabot slipped past it](/writing/dependency-cooldown-and-dependabot)
- [Four flaky tests a fast machine hid](/writing/flaky-tests-a-fast-machine-hides)
- [Taking a repository public: the checklist I actually ran](/writing/taking-a-repository-public)

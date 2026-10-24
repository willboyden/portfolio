---
slug: agent-harness-engineering
title: Agent harness engineering — improving agents without touching their weights
summary: >-
  Improving an agent by changing its harness, not its model: Google Research's
  harness2 run through a contained workbench that people and AI agents share
  under the same rules, with every candidate harness, diff and rollout on screen.
capability: Agent harness engineering
oneLiner: >-
  Google Research's harness2 refines an agent's prompts, tools, memory and
  skills task by task; my open-source Harness² Workbench runs it for teams and
  AI agents with roles, budgets, container isolation and an MCP server.
tags: [agents, evals, mcp, security, open-source]
date: 2026-10-24
status: in-progress
stack: [harness2 (Google Research), Harness² Workbench, Rust, Leptos (WebAssembly), MCP, OpenCode, Codex, Docker or Podman]
howItWorks:
  - harness2 treats the harness as the thing to optimise (system prompt, guardrails, memory, tool guidance, subagents, skills, scripts and plugins) and keeps the model's weights fixed.
  - For each task it proposes edits, probes them by running the task again, and composes a refined harness from how the runs behaved differently; a slower loop carries the adopted harnesses and lessons forward to later tasks.
  - The Workbench runs every harness2 step as a job with roles, a cost estimate, a spend guard, live logs and optional container isolation behind an egress allowlist.
  - Every candidate harness, the diff to the adopted one, the rollouts and the improver's reasoning can be browsed, and two results compare task by task with a sign test.
  - AI agents drive the same lifecycle through 42 MCP tools (plan, estimate, run, wait, analyse, export), each with the least-privilege token you give it, and the winning harness exports as an OpenCode or Codex project.
proof:
  - Harness² Workbench, open source under Apache-2.0 — the GUI, REST API and MCP server around harness2 = https://github.com/willboyden/harness2-workbench
  - A feature matrix that labels every feature verified live, fakes only or unverified = https://github.com/willboyden/harness2-workbench#status-and-how-to-read-it
  - A STRIDE threat model, written with two independent security reviews and their 27 findings = https://github.com/willboyden/harness2-workbench/blob/main/docs/THREAT-MODEL.md
  - The MCP guide — 42 tools, the safety rules for agents, and what was verified live = https://github.com/willboyden/harness2-workbench/blob/main/docs/MCP.md
  - harness2's ideas in five minutes, as the Workbench explains them to new users = https://github.com/willboyden/harness2-workbench/blob/main/docs/CONCEPTS.md
  - Release 0.1.0 — archives for x86_64 and aarch64 Linux with checksums, an SBOM and build provenance = https://github.com/willboyden/harness2-workbench/releases/tag/v0.1.0
limits:
  - No model-backed sweep has been run through the Workbench yet. The only real harness2 workflow exercised end to end is its free offline demo; benchmark results are parsed against recorded harness2 output.
  - Host isolation is not a sandbox. A host-mode executor runs as the Workbench's own user and can read its data; container isolation is the answer, verified on rootless Docker only.
  - WorkBuddy-Bench is partial, because upstream supports it only on Vertex AI.
  - Single node and SQLite by design; the audit chain shows edits by anyone who cannot rewrite the data directory, but it is not tamper-proof.
  - The method is Google Research's. The Workbench is unofficial, not affiliated with Google, and pinned to one tested harness2 commit.
relatedPosts: [building-harness2-workbench, mcp-server-for-an-agent-harness, security-reviews-of-a-localhost-control-plane]
relatedProjects: [harness2-workbench]
comparisonTitle: harness2 at a terminal, and through the Workbench
comparisonRows:
  - ["Task", "harness2 at a terminal", "Through Harness² Workbench"]
  - ["Starting a run", "environment variables and a long command", "a run wizard with a cost estimate, a budget and a dry-run preview"]
  - ["Watching it", "a scrolling terminal", "live logs, task progress, cancel, timeout and a spend guard"]
  - ["Reading results", "directories of JSON and Markdown", "scores, harness trees, diffs, rollouts, libraries and sign-test comparisons"]
  - ["Sharing", "one user's shell", "tokens and sessions with three roles, single sign-on, write-only secrets and an audit log"]
  - ["AI agents", "a shell, with every permission it has", "42 MCP tools, each agent with its own token (viewer recommended)"]
  - ["Isolation", "the executor runs as you", "optional containers whose only way out is an egress allowlist"]
---

### Why the harness, not the model

Most of what makes an agent good at a job lives outside the model: what the
system prompt says, which tools it is told about and how, what it remembers
between tasks, which skills and scripts it can call. harness2 makes that
explicit as eight editable components and improves them per task, with the
model fixed. The paper reports that a single step improves two models on three
professional benchmarks, by up to 11.5 points on WorkBuddy-Bench and 11.8
percentage points on LAB's partial pass rate, without changing a single
weight.

### What the Workbench adds

Running that safely is its own engineering problem. A sweep starts executors
that read files, call cloud models and run code, and the results it writes are
model output that can contain instructions. The Workbench puts one server in
front of all of it, enforces roles on every call from people and agents alike,
reads job output as hostile input, and says plainly in its documentation which
parts were verified against a real run and which were not.

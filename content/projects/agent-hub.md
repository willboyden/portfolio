---
# Facts from the public README, github.com/willboyden/agent-hub (main,
# pushed 2026-10-18). Checked 2026-10-24.
title: Agent Hub — one place for what your coding agents know and may do
slug: agent-hub
summary: >-
  Shared instructions, skills, subagents, MCP servers, permissions and egress
  for Claude Code, opencode, Hermes Agent and Turnstone. Edit, commit, plan,
  apply — with a policy floor content can only make stricter.
tags: [ai-agents, mcp, security, developer-tools, rust, open-source]
date: 2026-10-18
role: Design and implementation
status: active
period: "2026-10"
featured: true
relatedPost: building-agent-hub
links:
  source: "https://github.com/willboyden/agent-hub"
stack: [Rust (axum, hyper, tokio), git, SQLite, LanceDB + Qdrant (knowledge plane), ES modules + web components (no npm)]
highlights:
  - "0.3.0 rewrites the hub, hubctl and the knowledge service in Rust as a drop-in: the same bytes written into every client's files (PyYAML-exact YAML), 0 differences in 545 side-by-side cases against the last Python code, and three security fixes published as GHSA-7j23-gq83-5j4w"
  - "A git repository of declarative files is the source of truth; the hub compiles it into each client's native format (.claude/skills, .opencode/agent, AGENTS.md, Hermes and Turnstone stages) instead of being a service the agents query"
  - "Edit, commit, plan, apply: a plan renders the committed tree per client and shows the diff; apply writes only from that plan, only after confirmation, and refuses if anything moved since"
  - "A policy floor outside the content repo — credential paths denied, egress deny-by-default, no unscanned MCP server, no catch-all shell allow — that content can only tighten"
  - "Import first: it reads what each client already has, and a file edited outside the hub becomes a conflict that is skipped, never silently overwritten; every overwritten file is backed up and rollback restores the last apply"
  - "Optional skill evaluation before import with NVIDIA SkillEvaluator, and an import gate that can require a clean static security scan"
  - "New clients without code: a declarative YAML spec validated live in the add-client wizard"
metrics:
  - client adapters = 5 + a generic YAML adapter (DeepSeek Harness added in 0.3.0)
  - latest release = v0.3.0 (2026-10-28), backend in Rust
  - loopback trust = off by default (bearer key everywhere)
---

Each coding agent keeps its instructions, skills, subagents, MCP servers and
permissions in a different format and place. In my lab that is Claude Code,
opencode, Hermes Agent and Turnstone, and shared content drifted between them
with nothing showing what any one of them was allowed to do. Agent Hub treats
that configuration like infrastructure code: reviewed in git, planned, applied
with a diff, and checked against a floor of rules that content cannot loosen.

The README names the limit plainly: the hub cannot protect you from an
unsandboxed client that runs as your own user. `hubctl doctor` reports what is
exposed on the host.

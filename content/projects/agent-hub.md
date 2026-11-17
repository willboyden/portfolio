---
# Facts from the public README and CHANGELOG (0.3.0 to 0.5.0), github.com/willboyden/agent-hub
# (main at v0.5.0, 2026-11-14). Checked 2026-11-16.
title: Agent Hub — one place for what your coding agents know and may do
slug: agent-hub
summary: >-
  Shared instructions, skills, subagents, MCP servers, permissions and egress
  for Claude Code, opencode, Hermes Agent, Turnstone and DeepSeek Harness.
  Edit, commit, plan, apply — with a policy floor content can only make
  stricter.
tags: [ai-agents, mcp, security, developer-tools, rust, open-source]
date: 2026-10-18
role: Design and implementation
status: active
period: "Oct–Nov 2026"
featured: true
relatedPost: building-agent-hub
links:
  source: "https://github.com/willboyden/agent-hub"
stack: ["Rust (axum, hyper, tokio)", "WebAssembly (the hub's own checks, in the browser)", git, SQLite, LanceDB + Qdrant (knowledge plane), ES modules + web components (no runtime dependencies)]
highlights:
  - "0.5.0 runs the hub's own checks in the browser: its Rust config, YAML and item-model checks compile to a WebAssembly module (about 430 KB gzipped), so the editor reports the server's own rules as you type, and a draft of the hub's env file is checked in the tab and never sent"
  - "0.4.0 adds Getting started and FAQ tabs to every page and a config-file editor: draft, check with the hub's real loaders and export, with an (i) explanation per value; the hub writes no config file itself"
  - "0.3.0 rewrites the hub, hubctl and the knowledge service in Rust as a drop-in: the same bytes written into every client's files (PyYAML-exact YAML), 0 differences in 545 side-by-side cases against the last Python code, and three security fixes published as GHSA-7j23-gq83-5j4w"
  - "A git repository of declarative files is the source of truth; the hub compiles it into each client's native format (.claude/skills, .opencode/agent, AGENTS.md, and staged trees for Hermes, Turnstone and DeepSeek Harness) instead of being a service the agents query"
  - "Edit, commit, plan, apply: a plan renders the committed tree per client and shows the diff; apply writes only from that plan, only after confirmation, and refuses if anything moved since"
  - "A policy floor outside the content repo — credential paths denied, egress deny-by-default, no unscanned MCP server, no catch-all shell allow — that content can only tighten"
  - "Import first: it reads what each client already has, and a file edited outside the hub becomes a conflict that is skipped, never silently overwritten; every overwritten file is backed up and rollback restores the last apply"
  - "Optional skill evaluation before import with NVIDIA SkillEvaluator, and an import gate that can require a clean static security scan"
  - "New clients without code: a declarative YAML spec validated live in the add-client wizard"
metrics:
  - client adapters = 5 + a generic YAML adapter (DeepSeek Harness added in 0.3.0)
  - latest release = v0.5.0 (2026-11-14), backend in Rust
  - loopback trust = off by default (bearer key everywhere)
---

Each coding agent keeps its instructions, skills, subagents, MCP servers and
permissions in a different format and place. In my lab that is Claude Code,
opencode, Hermes Agent, Turnstone and DeepSeek Harness, and shared content
drifted between them with nothing showing what any one of them was allowed to
do. Agent Hub treats
that configuration like infrastructure code: reviewed in git, planned, applied
with a diff, and checked against a floor of rules that content cannot loosen.

The README names the limit plainly: the hub cannot protect you from an
unsandboxed client that runs as your own user. `hubctl doctor` reports what is
exposed on the host.

## Since the Rust rewrite

**0.4.0** put help on the page. Every page has Getting started and FAQ tabs,
and Settings has a config-file editor: draft the hub's env file, the knowledge
service config or a client spec in a form or as text, check the draft with the
hub's real loaders, and export it with a diff and the commands to install it.
The hub writes no config file and runs no command for this.

**0.5.0** moved those checks into the browser. The hub's own config, YAML and
item-model checks are compiled from the same Rust code to a WebAssembly module,
so the editor's blocking errors are the server's rules instead of a JavaScript
copy that can drift, and a draft of the env file never leaves the tab. If the
module does not load, the pages say so and the hub checks every save as before.

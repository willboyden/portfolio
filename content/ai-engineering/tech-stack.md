---
# DRAFT-REVIEW: human review before publishing. Every proof path verified
# on-disk 2026-10-16. Proof lines use the claim = path expansion rule.
slug: tech-stack
title: The stack underneath the work
summary: >-
  Every capability on this site runs on one physical stack — a Threadripper Pro
  head node with dual RTX Pro 6000s, four DGX Spark (GB10) nodes, an RTX 5090
  workstation, ConnectX-7 fabric — under a dual-broker LiteLLM/switchyard
  topology with vLLM and SGLang serving open-weight models.
capability: Infrastructure stack
oneLiner: >-
  The hardware and software inventory behind every capability here — six GPU
  nodes on ConnectX-7 fabric, a LiteLLM broker with a switchyard second group,
  vLLM/SGLang engines, MCP orchestration, FTS5 retrieval, and a zero-dependency
  CDP harness — with the reasoning for each choice.
tags: [infrastructure, litellm, switchyard, vllm, sglang, dgx, threadripper, connectx-7, mcp, duckdb]
date: 2026-10-16
status: shipped
stack: [LiteLLM 1.100.1, switchyard, vLLM, SGLang, MCP orchestrator, SQLite FTS5, DuckDB, React 19, Vite, TypeScript, GitHub Actions, Threadripper Pro, RTX Pro 6000, DGX Spark (GB10), RTX 5090, ConnectX-7, MikroTik CRS804]
howItWorks:
  - One OpenAI-compatible entry point — LiteLLM proxy 1.100.1 at :4000 brokers all LLM traffic across 16 model groups with per-group routing, so no client code knows where the GPUs are.
  - A second broker group, switchyard at :4010 (declared 262144 in / 32768 out), handles specialized routing patterns alongside the primary broker — a deliberate dual-broker topology.
  - Serving engines are vLLM and SGLang behind the broker; engine identity is verified by response forensics (system_fingerprint, weight-version metadata), never by the model name string.
  - Orchestration is direct Python imports — nine MCP servers composed in one process instead of subprocess-per-tool, because call overhead shows up in agent loops.
  - Retrieval is SQLite FTS5 inside DuckDB-attached storage — 100 percent recall at 0.11 ms — with real stdio handshake benchmarks keeping per-tool latency honest.
  - The fabric is ConnectX-7 NICs into a MikroTik CRS804 switch — one inter-node network that model placement and failover both assume.
comparisonTitle: 'LiteLLM vs Switchyard'
comparisonRows:
  - [Dimension, LiteLLM, Switchyard]
  - [Role, Primary broker — routes all LLM traffic, Second group — specialized routing subset]
  - [Port, ':4000', ':4010']
  - [Version, Proxy 1.100.1 (x-litellm-version header), Not version-probed through the /v1 allowlist]
  - [Models served, 16 model groups (qwen, glm, deepseek, gpt-oss, llama, switchyard...), Specialized subset — one group in the same broker listing]
  - [Declared limits, Per-group (e.g. 262144 in / 32768 out), 262144 in / 32768 out]
  - [Caching, Full-body response cache (~0.02s replay, cache-lab 50-probe experiment), Not evaluated]
  - [Failover, Engine-level with per-group routing, Per-group routing rules — own ENGINE-DOWN signature in the repair runbook]
  - [Used because, Battle-tested OpenAI-compatible proxy with broad model support, Complements LiteLLM for specific routing patterns]
  - [Proof, /opt/data/workspace/broker-tools/nvfp4-findings.md, /opt/data/workspace/broker-tools/repair-runbook.md]
proof:
  - Broker forensics — LiteLLM 1.100.1 version header, 16-group model listing with per-group limits = /opt/data/workspace/broker-tools/nvfp4-findings.md
  - Fleet health tooling — pulse, bench, repair runbook with ENGINE-DOWN signatures (switchyard included) = /opt/data/workspace/broker-tools
  - Controlled 50-probe experiment proving full-body response caching at ~0.02 s replay = /opt/data/workspace/cache-lab
  - mcp-bench — real stdio MCP handshake benchmarks, per-tool p50/p95 = /opt/data/workspace/portfolio/mcp-bench
  - Multi-MCP orchestrator — one CLI composing servers via direct Python import = /opt/data/workspace/orchestrator
limits:
  - Single-tenant, one operator — no multi-user auth story on the broker beyond the /v1-only allowlist.
  - Model placement across the six nodes is manual; one large model resident per GPU at a time, nothing schedules it.
  - The tooling container is offline from the GPU host — engine restarts are operator work by runbook.
  - No auto-scaling anywhere — the fleet is a fixed inventory; capacity planning is done by benchmark.
relatedPosts: [eval-harness-silent-regressions, mcp-production-lessons]
relatedProjects: [model-quality-harness, orchestrator]
---

Every capability page on this site describes work done on one physical stack.
This page is the inventory underneath all of them — and the reasoning for why
each piece is there.

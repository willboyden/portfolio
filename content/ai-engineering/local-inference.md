---
# DRAFT-REVIEW: human review before publishing. Every proof path verified
# on-disk 2026-10-10. Proof lines use the claim = path expansion rule.
slug: local-inference
title: Local LLM inference
summary: >-
  Serve, probe, and benchmark open-weight models across a multi-node GPU
  cluster — Threadripper Pro head node with dual RTX Pro 6000s, four DGX
  Spark (GB10) nodes, and an RTX 5090 workstation — through an
  OpenAI-compatible broker with a failure taxonomy that refuses to call a
  listed model healthy.
capability: Local LLM inference
oneLiner: >-
  A heterogeneous GPU cluster — Threadripper Pro head node, dual RTX Pro
  6000s, four DGX Spark (GB10) nodes, and an RTX 5090 workstation — serving
  open-weight models through an OpenAI-compatible broker with probes,
  benchmarks, and runbooks that keep the fleet honest.
tags: [llm, vllm, sglang, benchmark, litellm, multi-node, dgx]
date: 2026-10-10
status: shipped
stack: [LiteLLM broker, vLLM, SGLang, DGX Spark (GB10), RTX Pro 6000, RTX 5090, ConnectX-7, MikroTik CRS804, Python stdlib, DuckDB]
howItWorks:
  - List model groups from GET /models, then health-probe each one — a listed group is not a healthy group.
  - Classify every failure by latency and response body (engine down vs bad upstream name vs GPU contention) before calling anything dead.
  - Benchmark sequentially with cache-busting (unique user field plus prompt nonce), logging finish_reason and reasoning burn per turn.
  - Re-test any surprising throughput claim adversarially (ascending and descending concurrency ladder) before believing it.
  - Convert persistent DOWN groups into an operator-ready repair runbook instead of narrating failures.
proof:
  - Broker playbook — failure taxonomy, probe scripts, engine forensics = /opt/data/skills/mlops/local-llm-broker/SKILL.md
  - Tested fleet tooling — pulse, bench, runbook generator, 18-test suite = /opt/data/workspace/broker-tools
  - Controlled 50-probe cache experiment proving full-body response caching = /opt/data/workspace/cache-lab
  - Adversarial replay ruling out order-drift in a throughput-collapse claim = /opt/data/workspace/adversarial
  - Deterministic tool-call scoring harness with dashboard = /opt/data/workspace/model-quality-harness
limits:
  - One large model is resident per GPU at a time; model placement across the cluster is manual, not scheduled.
  - Engines can only be restarted by the operator — the tooling container has no GPU access and a /v1-only broker allowlist.
  - Identical request bodies hit the broker cache in ~0.02 s; latency numbers without cache busting are fiction.
  - GET /models 200 does not mean inference works — probe a chat completion before relying on a group.
relatedPosts: [eval-harness-silent-regressions, langfuse-observability-pragmatic]
relatedProjects: [model-quality-harness]
---

Serving open-weight models across a heterogeneous GPU cluster is the easy
part. Knowing what is actually up, how fast, and why something failed is the
work.

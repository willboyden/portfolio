---
slug: tech-stack
title: The stack underneath the work
summary: >-
  Every capability on this site runs on one lab: six GPU machines on a
  ConnectX-7 fabric, one model router, and observability and containment
  around every agent. This page is the inventory and the reasons.
capability: Infrastructure stack
oneLiner: >-
  The hardware and software behind every capability here — GPUs, engines, the
  routing layer, tracing and the sandboxes the agents run in — with the
  reasoning for each choice.
tags: [infrastructure, litellm, nemo-switchyard, vllm, sglang, observability, security]
date: 2026-10-24
status: shipped
stack: [2× RTX PRO 6000 Blackwell, 4× DGX Spark (GB10), RTX 5090, ConnectX-7 + MikroTik CRS804, rootless Docker, vLLM, SGLang, NVIDIA Dynamo, LiteLLM, NeMo Switchyard, NeMo Relay, NeMo Guardrails, NVIDIA OpenShell, NVIDIA DCGM, OpenTelemetry, Prometheus, Grafana, Loki, Tempo, Langfuse, Phoenix, Matrix (Synapse)]
howItWorks:
  - One door for models. Every client calls a LiteLLM router; it holds the per-client keys, the output PII guardrail and the tracing, so moving a model between machines changes no client.
  - A routing layer in front of the models. NVIDIA NeMo Switchyard decides which tier serves a conversation, and the NeMo Relay gateway counts and traces each routed call from the coding agents.
  - Engines chosen per model and card. vLLM, SGLang and Dynamo on the workstation and the Sparks, llama.cpp and Ollama for experiments — pinned images, rootless Docker, engines on internal networks.
  - Observability before anything else. OpenTelemetry traces go to Tempo, Langfuse and Phoenix; Prometheus and Loki feed Grafana; alerts land in a private chat room.
  - Containment by default. Egress is denied unless a host is on an allowlist, each MCP server runs in its own sandbox, untrusted scripts run in NVIDIA OpenShell sandboxes, a NeMo Guardrails server checks prompts and answers, agents get scoped keys from brokers instead of real ones, and secrets are encrypted before they touch disk.
comparisonTitle: 'LiteLLM vs Switchyard vs Relay — who does what'
comparisonRows:
  - [Dimension, LiteLLM router, NeMo Switchyard server, NeMo Relay gateway]
  - [Role, The one door for every model call, Tier routing with an LLM judge, Agent gateway; its Switchyard plugin routes the coding agents]
  - [Version, 1.102.1, 0.3.0, 0.9.2]
  - [Runs as, Container on the shared lab network, Container, Host binary as a systemd user unit]
  - [Called by, Every client and both routing layers, Clients that only speak to the router, Coding agents (opencode and others) by route id]
  - [Decides, Which engine an alias points at, Fast tier or capable tier per conversation, Same tiers; counts and traces every routed call]
  - [Observability, Per-key spend and OTel traces, Prometheus metrics and a routing log, OTLP metrics and traces plus ATIF trajectories]
proof:
  - Engine Console — the open-source control plane for the engines = https://github.com/willboyden/engine-console
  - GPU Tuner — the open-source power, fan and clock tool for the GPUs = https://github.com/willboyden/gpu-tuner
  - Nemo Console 0.3.1 — the open-source console for ten of these NVIDIA systems (Switchyard, Relay, Dynamo, DCGM, AIPerf, NeMo Guardrails, OpenShell, SkillEvaluator, NeMo Evaluator, Data Designer) = https://github.com/willboyden/nemo-console
  - Agent Hub — the open-source control plane for what each agent knows and may do = https://github.com/willboyden/agent-hub
  - This site — React 19, Vite and TypeScript, prerendered to static HTML and deployed by GitHub Actions = https://github.com/willboyden/portfolio
limits:
  - Single operator, single tenant — built for my agents and apps, not a team.
  - Model placement is manual — one big model on the workstation at a time and one lane on the Sparks at a time.
  - Rootless Docker cannot reach host-published ports from a container, so services talk over a shared Docker network, and tools that need real root (GPU power limits) run on the host.
  - No autoscaling or high availability anywhere.
  - Host-level security templates (auditd, AppArmor, nftables) are opt-in and applied by hand, never automatically.
relatedPosts: [private-chat-server-for-ai-agents, routing-coding-agent-two-local-models]
relatedProjects: [engine-console, gpu-tuner, nemo-console, agent-hub]
---

Every capability page on this site describes work done on one physical lab.
This page is the inventory underneath all of them.

### Agents that use the lab

Claude Code (also in a bubblewrap-sandboxed variant that runs on local
models), opencode, Codex, Hermes Agent, Turnstone and Open WebUI all reach the
models through the router with their own keys. Agent Hub keeps their skills,
instructions and permissions in one reviewed git repository, and lab-chat — a
private Matrix server — is how they notify me, ask for approval and hand work
to each other.

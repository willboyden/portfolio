---
# Facts from the public README and release v0.4.0 (2026-10-15),
# github.com/willboyden/engine-console. Checked 2026-10-24.
title: Engine Console — one page for GPU inference engines
slug: engine-console
summary: >-
  A control plane for vLLM, SGLang, TensorRT-LLM, llama.cpp and Ollama across
  one or several machines. Each machine's own policy file decides whether the
  console may only watch it or also change it.
tags: [llm-inference, vllm, sglang, gpu, fastapi, security, open-source]
date: 2026-10-15
role: Design and implementation
status: active
period: "Sep–Oct 2026"
featured: true
relatedPost: building-engine-console
links:
  source: "https://github.com/willboyden/engine-console"
stack: [Python 3.13, FastAPI, SQLite (WAL), SSE, Prometheus + OTLP, rootless Docker, NVML, ES modules + web components (no npm)]
highlights:
  - "A hub talks to a small agent on every machine (ecnode) over a restricted ssh key; the node does all Docker, GPU and file work and obeys a local policy file, so a bug in the hub can do at most what each machine's policy allows"
  - "Five engines behind one adapter port, each with a pinned image — vLLM 0.27.1, SGLang 0.5.20, TensorRT-LLM 1.2.1, llama.cpp b10156 by digest, Ollama 0.30.11 — and launch forms generated from each adapter's parameter catalog"
  - "Engines run on an internal Docker network with no ports and all capabilities dropped, reachable only through a per-instance loopback gateway"
  - "A cross-machine model library: Hugging Face search and download, copies between machines, and a VRAM fit estimate that says \"unknown\" instead of guessing"
  - "Engines started by your own scripts are discovered read-only and shown beside managed ones, so the console never bypasses an existing start-up script"
  - "Learn mode: every setting carries a plain-language explanation, with a beginner wizard and a glossary"
  - "Honest status: the README lists what was verified live (one workstation, two GPUs) and what has only run against fakes (remote machines, launches of engines other than vLLM)"
metrics:
  - engines = 5
  - architecture decisions recorded = 21 ADRs
  - latest release = v0.4.0 (2026-10-15)
---

I run several inference engines on a workstation with two RTX PRO 6000s,
next to a second GPU machine and four DGX Sparks. Every engine had its
own start script, its own flags and its own way of reporting memory. Engine
Console puts them on one page without taking over: it watches by default, and
each machine decides for itself, in a root-owned policy file, whether the
console may start, stop, download or delete anything there.

## How it is built

- **Hub and node.** The hub is a FastAPI app on loopback with a zero-build
  browser UI. It never runs Docker or reads `/proc` itself. Every machine,
  including its own, is reached through `ecnode`, a standard-library Python
  agent, over stdio locally and over ssh with a key restricted to that one
  command elsewhere.
- **Policy as the hard boundary.** `monitor` or `manage` mode, allowed images,
  model roots and scripts are set per machine. The node re-reads its policy
  within seconds; the hub cannot edit it.
- **Engine isolation.** Engines are labelled sibling containers on an
  `--internal` network with `--cap-drop ALL`, `no-new-privileges` and a pids
  limit. The hub reaches an engine's API only through its node.
- **Security posture.** Loopback is not trusted (API key, Host, Origin and
  CSRF checks on every call), secrets are stored as `[set]` markers or 0600
  files, and model files are confined to the policy's roots.

## What is not done yet

The README is explicit: remote machines over ssh, copies between real
machines, multi-GPU launches and launches of any engine but vLLM have run only
against fakes. No penetration test or independent review has been done.

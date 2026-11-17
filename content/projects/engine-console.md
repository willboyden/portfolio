---
# Facts from the public README and CHANGELOG (0.4.0 to 0.7.1; latest release v0.7.1, 2026-11-15),
# github.com/willboyden/engine-console. Checked 2026-11-16.
title: Engine Console — one page for GPU inference engines
slug: engine-console
summary: >-
  A control plane for vLLM, SGLang, TensorRT-LLM, llama.cpp and Ollama across
  one or several machines. Each machine's own policy file decides whether the
  console may only watch it or also change it.
tags: [llm-inference, vllm, sglang, gpu, rust, security, open-source]
date: 2026-10-15
role: Design and implementation
status: active
period: "Sep–Nov 2026"
featured: true
relatedPost: building-engine-console
links:
  source: "https://github.com/willboyden/engine-console"
stack: ["Rust (axum, hyper, tokio)", "WebAssembly (the hub's own adapters and checks, in the browser)", SQLite (WAL), SSE, Prometheus + OTLP, rootless Docker, NVML, ES modules + web components (no runtime dependencies)]
highlights:
  - "0.7.0 shows the exact launch command: the preview is the hub's own engine adapter, compiled to WebAssembly and run in the page, with the adapter's cross-field validation listed before you launch; a draft of the env file is checked in the tab and never sent"
  - "0.6.0 adds a Config files page that drafts, validates and exports the machine list, the hub's env file and a node policy without ever writing a file, Getting started and FAQ tabs on every page, four more load suites and a tool-calling quality suite of twelve scenarios scored rule by rule, with no judge model"
  - "0.5.0 rewrites the hub and the node agent in Rust: one node binary per architecture (about 4.5 MB for x86_64 and 3.9 MB for aarch64) instead of a Python environment, the same wire protocol in both directions so machines move one at a time, and 0 differences in 674 side-by-side steps against the last Python code"
  - "A hub talks to a small agent on every machine (ecnode) over a restricted ssh key; the node does all Docker, GPU and file work and obeys a local policy file, so a bug in the hub can do at most what each machine's policy allows"
  - "Five engines behind one adapter port, each with a pinned image — vLLM 0.27.1, SGLang 0.5.20, TensorRT-LLM 1.2.1, llama.cpp b10156 by digest, Ollama 0.30.11 — and launch forms generated from each adapter's parameter catalog"
  - "Engines run on an internal Docker network with no ports and all capabilities dropped, reachable only through a per-instance loopback gateway"
  - "A cross-machine model library: Hugging Face search and download, copies between machines, and a VRAM fit estimate that says \"unknown\" instead of guessing"
  - "Engines started by your own scripts are discovered read-only and shown beside managed ones, so the console never bypasses an existing start-up script"
  - "Learn mode: every setting carries a plain-language explanation, with a beginner wizard and a glossary"
  - "Honest status: the README says what was verified live (with the Python 0.4.x line: one workstation, and five remote machines monitored over ssh) and what the Rust hub and node have so far proven only by parity runs and a browser suite against fake CLIs"
metrics:
  - engines = 5
  - architecture decisions recorded = 23 ADRs
  - browser end-to-end = every page in headless Chrome against the real hub and node, gating every push
  - latest release = v0.7.1 (2026-11-15), hub and node in Rust
---

I run several inference engines on a workstation with two RTX PRO 6000s,
next to a second GPU machine and four DGX Sparks. Every engine had its
own start script, its own flags and its own way of reporting memory. Engine
Console puts them on one page without taking over: it watches by default, and
each machine decides for itself, in a root-owned policy file, whether the
console may start, stop, download or delete anything there.

## How it is built

- **Hub and node.** The hub is a Rust service on loopback (a FastAPI app until
  0.5.0) with a browser UI of plain ES modules; its one build step, since 0.7.0,
  compiles the WebAssembly module. It never runs Docker or reads `/proc` itself. Every machine,
  including its own, is reached through `ecnode`, a single Rust binary (a
  standard-library Python agent until 0.5.0), over stdio locally and over ssh with a key restricted to that one
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

## What 0.6 and 0.7 added

**Help and config files (0.6.0).** Every page sits in one frame with Getting
started and FAQ tabs. A Config files page drafts, validates and exports the
three files an operator edits by hand: the machine list, the hub's env file and
a node policy. A draft is checked with the same rules the hub and the node
apply, and the page shows the commands to install the result; it never writes a
file. The Benchmark page
gained four load suites and a quality suite: twelve tool-calling scenarios run
against each scenario's own constant tools and scored rule by rule, so a score
needs no judge model.

**The hub's own checks in the browser (0.7.0).** The launch form's command
preview used to be an approximation written in JavaScript. It is now the output
of the hub's own engine adapter, built from the same Rust code as a WebAssembly
module: the engine's exact arguments and environment, with the adapter's
validation listed under it before you launch. Two things the old preview got
wrong are fixed by construction: a vLLM switch set to off shows as its
`--no-` form, and TensorRT-LLM's options-file settings are no longer shown as
command-line flags. Env-file drafts are checked in the tab and never sent.

**0.7.1** fixes one thing: a request body over the limit now always gets its
413 answer, instead of a connection reset on a busy machine.

## What is not done yet

The README is explicit. What it calls verified live was seen with the Python
0.4.x line: one workstation, mostly in monitor mode, and five remote machines
monitored over ssh. Managing a remote machine was never verified. The Rust hub
and node are proven against that Python release (674 side-by-side HTTP steps,
665 the same and 9 with allowed differences in headers only, and each of its
2,487 tests mapped to a Rust test or marked not applicable) and by a browser
suite that opens every page against the real hub and node before every push,
not yet by a launch on real GPUs. The security reviews so far were done by AI
auditors reading the code, with probes and protocol fuzzing; no human review
or penetration test has been done.

---
slug: local-inference
title: Local LLM inference on a six-machine GPU lab
summary: >-
  Open-weight models served on my own hardware: two RTX PRO 6000s, four DGX
  Sparks and an RTX 5090. Every model sits behind one router, and every engine
  is measured before it is trusted.
capability: Local LLM inference
oneLiner: >-
  GLM-5.3-Flash, DeepSeek-V4.1-Flash, Qwen and Nemotron models on vLLM, SGLang
  and Dynamo across a heterogeneous GPU lab — with the operator tools I needed
  released as open source.
tags: [llm-inference, vllm, sglang, dgx-spark, blackwell, observability]
date: 2026-10-24
status: shipped
stack: [vLLM 0.27 and 0.32, SGLang 0.5.20, NVIDIA Dynamo 1.5.0, llama.cpp, Ollama, LiteLLM, 2× RTX PRO 6000 Blackwell, 4× DGX Spark (GB10), RTX 5090, ConnectX-7, NVIDIA DCGM, NVIDIA AIPerf, NeMo Evaluator, Prometheus + Grafana, rootless Docker]
howItWorks:
  - A workstation with two 96 GB RTX PRO 6000s runs the big local model across both cards (GLM-5.3-Flash with tensor parallelism over PCIe, about a 1M-token window), picked with one script that stops whatever else is loaded and starts engines in a safe order.
  - DeepSeek-V4.1-Flash runs as one vLLM engine across five machines. The parts every token needs and the most-read experts sit on the two RTX PRO 6000s; the other experts sit on the four DGX Sparks, which serve them layer by layer over ConnectX-7. Experts move between the two tiers as the running sessions read them, and from five parallel requests on, a step verifies only the drafts worth their cost. Other models too big for one box run tensor parallel across the four Sparks, with weights read from the workstation over NFS.
  - An RTX 5090 in a second machine serves the fast Nemotron Lightning model that answers first and judges routing.
  - Every engine sits behind the LiteLLM router as an alias, so switching models changes no client; Prometheus scrapes every engine and every machine's DCGM exporter, Grafana shows tokens, queues, KV cache and GPU temperature, and Nemo Console runs AIPerf load tests, NeMo Evaluator benchmarks and per-GPU DCGM diagnostics.
  - Kernels are checked per GPU architecture — the RTX PRO 6000s and the 5090 share sm_120, so one NVFP4 checkpoint and the same flags run on both, while the Sparks (sm_121) need their own builds.
proof:
  - Engine Console — open-source control plane for vLLM, SGLang, TensorRT-LLM, llama.cpp and Ollama across machines = https://github.com/willboyden/engine-console
  - GPU Tuner — open-source power caps, fan curves and clock caps for the lab's GPUs, with per-card safety limits = https://github.com/willboyden/gpu-tuner
  - DeepSeek-V4.1-Flash on one stream of code went from 67 tokens/s on four Sparks (October) to about 200 as one engine across all five machines (November), and about 1,000 tokens/s in total across 128 agent loops
  - Model share over NFS to three Sparks from about 9 to 15.3 GB/s by finding ZFS cache churn on the server, not the NIC that was first blamed
  - Nemo Console 0.6.0 — DCGM telemetry for all six machines, per-GPU diagnostics, AIPerf load tests and NeMo Evaluator benchmarks from one page = https://github.com/willboyden/nemo-console
  - A probe that sends a real completion before declaring an engine up — health endpoints stay 200 when one rank of a multi-node engine has died
limits:
  - One big model at a time on the workstation; switching takes minutes of loading, and nothing schedules it automatically.
  - The DeepSeek engine holds all four Sparks and both RTX PRO 6000s while it runs, so the other big models wait their turn; the Sparks run one lane at a time, and long benchmarks run under a thermal guard that pauses them on the hottest box.
  - Single-tenant — it serves my agents and apps, not a team, and there is no autoscaling or high availability.
  - There is no cloud fallback — when every engine a route can use is down, the route fails.
relatedPosts: [hot-experts-on-the-fast-cards, one-model-across-five-machines, broker-forensics-nvfp4, eval-harness-silent-regressions, routing-coding-agent-two-local-models]
relatedProjects: [engine-console, gpu-tuner, nemo-console, model-quality-harness]
---

Serving open-weight models is the easy part. Knowing what is actually up, how
fast, and why something failed is the work, and most of it is measurement:
counting bytes at the NIC instead of trusting client-reported rates, profiling
the NFS server under real multi-client load before blaming hardware, and
sending a real completion instead of trusting a health check.

### The machines

| Machine | GPUs | Role |
|---|---|---|
| Workstation (Threadripper PRO, 246 GB RAM) | 2× RTX PRO 6000 Blackwell, 96 GB each | the main local model (tensor parallel across both), or the fast tier of the five-machine DeepSeek engine; the router, observability, model storage over NFS |
| Four DGX Sparks | GB10, 128 GB unified memory each | one tensor-parallel engine across all four, or the cold experts of the five-machine DeepSeek engine |
| Second workstation | RTX 5090, 32 GB | the fast routing tier and judge; video rendering when idle |

The machines share a ConnectX-7 fabric. The workstation's two cards have no
NVLink, so tensor parallelism between them runs over PCIe peer-to-peer, which
needs `iommu=pt` on the kernel command line — a check script proves it after
every kernel or BIOS change.

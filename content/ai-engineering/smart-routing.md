---
slug: smart-routing
title: Smart routing — a fast model first, a judge, every call traced
summary: >-
  Every agent and app in my lab reaches models through one router. A fast
  model answers first, and an LLM judge sends the hard conversations to a
  bigger one.
capability: Smart routing
oneLiner: >-
  One router for every client, tier routing with an LLM judge (NVIDIA NeMo
  Switchyard), and a gateway that counts and traces each routed call — tuned
  by reading the answers, not the counters.
tags: [llm-routing, nemo-switchyard, litellm, agents, observability]
date: 2026-10-24
status: shipped
stack: [LiteLLM 1.102.1, NVIDIA NeMo Switchyard 0.3.0, NVIDIA NeMo Relay 0.9.2, Nemotron 3.5 Lightning (judge), Presidio, OpenTelemetry, Langfuse, Grafana Tempo, Prometheus]
howItWorks:
  - Every client — coding agents, the chat UI, the eval harness, the job-search app — calls only a LiteLLM router. It holds each client's own key, masks personal data in model output, and traces every call. Models are aliases, so no client knows which GPU serves it.
  - Tier routes put a fast model in front. Nemotron Lightning on an RTX 5090 answers first; GLM-5.3-Flash on two RTX PRO 6000s takes the conversations the judge scores as too hard. A second route escalates to DeepSeek-V4.1-Flash on four DGX Sparks.
  - The judge (Switchyard's classifier in capability mode) estimates the chance that the fast model can finish the task. Below 0.7 the conversation goes to the big model, and a verdict that fails to parse also goes to the big model.
  - It judges once per conversation, keyed on the first user message, so follow-up turns skip the judge — about ten times faster on repeated turns.
  - Coding agents name route ids on the NeMo Relay gateway instead of plain model names, so every routed call is counted and traced. Nemo Console and the Grafana boards show which tier served what.
proof:
  - Nemo Console, the open-source console that monitors Switchyard and Relay and edits their routes with validation and automatic rollback = https://github.com/willboyden/nemo-console
  - Five routing configurations benchmarked on the same 12 tasks; the live one keeps tasks the fast model answers correctly on the 5090 and sends the uncertain ones to GLM
  - Found why the fast tier answered empty — the Anthropic-format path dropped the "thinking off" flag — and moved it to the OpenAI format; its hard-task answers became complete and 2.5–4× faster than the big model's
  - Session affinity measured on the live route — repeat turns reused the first decision with zero judge calls (p50 82–3,887 ms down to 17–157 ms)
  - Per-client router keys, so spend and traffic are attributed to each agent in Grafana and Langfuse
limits:
  - The judge's packaged rubric does not describe this stack well — it sends some trivial one-liners ("What is 42?") to the big model. A custom rubric moves the profile, but crudely.
  - The judge is not fully deterministic; borderline verdicts flip between runs, so a difference of under about two tasks in twelve is noise.
  - Affinity keys on the first user message, so two conversations with the same opening share one routing decision.
  - On Switchyard 0.3.0 a judged route fails while its judge is down; it does not fall back to a single model.
  - Answers were checked by reading them, not by a graded quality score — 12 tasks are a sanity check, not an eval.
relatedPosts: [routing-coding-agent-two-local-models, broker-forensics-nvfp4]
relatedProjects: [nemo-console]
---

### Three layers, three jobs

| Layer | Job |
|---|---|
| **LiteLLM router** (`:4000`) | The one door. Per-client keys and spend, a PII guardrail on output, OpenTelemetry traces to Langfuse and Tempo. Every model is an alias here. |
| **Switchyard server** (`:4010`) | NVIDIA's routing server as a container: tier routes for clients that only speak to the router. |
| **NeMo Relay gateway** (`:4040`) | A host service whose built-in Switchyard plugin routes the coding agents. Naming a route id instead of a plain model is what makes it count and trace the call. |

### What I learned getting it right

- **Benchmark answers, not tier counters.** The counters said the fast tier was
  serving its share. The captured answers were empty: all 500 tokens went to
  hidden reasoning.
- **The wire format is behavior.** The same model with the same flags thought
  instead of answering when the request went through the Anthropic-format
  translation, because that path dropped the flag that turns thinking off.
- **The rubric is the product.** Swapping the judge for a much larger model
  kept the same backwards profile, and changing a two-sentence rubric moved it.
  The judge model is a commodity; the rubric is where the policy lives.
- **Judge once per conversation.** Judging every request of an agent loop
  re-judges the same task twenty times.

The full account, with the benchmark tables, is in the write-up below.

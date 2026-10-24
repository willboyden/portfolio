---
title: Routing a coding agent across two local models — what actually worked
slug: routing-coding-agent-two-local-models
summary: >-
  A fast model on an RTX 5090 answers first, GLM-5.3-Flash on two RTX PRO
  6000s takes the hard turns, and an LLM judge decides per conversation. Three
  bugs hid behind healthy-looking counters; here is how they were found.
tags: [llm-routing, nemo-switchyard, litellm, grafana, benchmarking, local-llm]
date: 2026-10-24
series: AI engineering notes
relatedProject: nemo-console
---

My workstation runs a coding agent (opencode) on local models: a fast
30B-class model — Nemotron Lightning on an RTX 5090 — answers first, and a
bigger GLM-5.3-Flash spanning two RTX PRO 6000s takes the turns the fast
model can't. Between the agent and the engines sits a routing layer that
decides, per request, which model serves. This post is the full account of
getting that layer right: the architecture, the three bugs it hid, the
experiments I ran to choose between five routing configurations, and the
benchmark numbers behind every claim.

## The three surfaces

The lab routes through three layers, each with a distinct job:

1. **LiteLLM** (`:4000`) — the mandatory chokepoint. Auth, per-key spend
   tracking, a PII guardrail on outputs, and telemetry. Every call from
   every client passes through it; every model is an alias in its config.
2. **Switchyard server** (`:4010`) — NVIDIA's routing server as a standalone
   container. It owns tier routing for clients that opt in via router-model
   aliases, and it exports rich Prometheus metrics.
3. **NeMo Relay gateway** (`:4040`) — a host service whose in-process
   Switchyard *plugin* does the routing for opencode. The plugin emits its
   own OTLP metrics and traces, and — the property that matters — **it can
   count and trace every call** if the client names a route id instead of a
   plain model name. A plain name passes through uncounted by design: "this
   cannot capture traffic it was not configured for."

The two tiers on the routing layer:

| tier | model | hardware | wire |
|---|---|---|---|
| weak / efficient | Nemotron Lightning 30B-A3B | RTX 5090 (second box) | OpenAI |
| strong / capable | GLM-5.3-Flash | 2× RTX PRO 6000, vLLM TP2 (this box) | Anthropic |

![Routing architecture: client → Relay gateway → capability judge → weak or strong tier → LiteLLM → engines](/posts/local-model-routing/routing-architecture.svg)

## What a routed request actually walks through

There are two shapes of route, and the difference is the whole story:

**A passthrough route** (`direct-glm-local`, `direct-aitop-lightning`, …)
maps a route id to one model. No decision is made. Cost: ~0.04 ms measured.
The only thing it buys is that the gateway counts and traces the call —
which is exactly why my agent's default model is `litellm/direct-glm-local`
rather than the plain alias.

**A capability route** (`llm_classifier`, `mode = "capability"`) runs an LLM
judge that estimates `p_solve` — the probability that the *weak* model
completes the task — plus a capability boundary (supported / uncertain /
unmatched). The policy is deterministic: `p_solve ≥ threshold` → weak tier;
otherwise strong. And it fails **closed**: an invalid or unparseable verdict
routes to the *strong* tier.

```
opencode ──> :4040 Relay plugin ──> capability judge (once per conversation)
                                     |  p_solve >= 0.7 -> Lightning
                                     |  else, or bad verdict -> GLM
                                     v
                    weak: Lightning (5090)   strong: GLM (2x PRO 6000)
                                     └──────────> LiteLLM :4000 ──> engine
```

The judge's frequency is itself configurable (`classify_trigger`): every
request, every user turn, or once per session. With `message_hash_fallback`
enabled, the session key is the *first user message's text* — so a normal
conversation gets exactly one judge call and one tier decision for its whole
lifetime, with no client-side session headers.

## Bug 1: the dashboard that lied by being old

The first symptom was cosmetic: the Switchyard Grafana board read
**"Escalations: 0"** while Prometheus clearly showed 100+ answers served by
the capable tier. Nothing was broken — the dashboard's JSON was *generated*
from the route config at generation time, and a route added that morning
(`auto-glm-aitop`) postdated the last generation. The per-route tier panels
read their tier pairs from `routes.toml` when the generator runs; a route
added without re-running the generator is invisible to them.

Lesson one, and it generalizes: **any artifact compiled from configuration
has a staleness clock.** The fix was mechanical (re-run the generator), but
the failure mode — a dashboard confidently reporting a wrong zero — is the
kind that gets built into decisions. The drift check now catches it.

## Bug 2: the efficient tier that answered empty

This one was expensive because everything *looked* healthy. Tier counters
said the efficient tier served its share of requests. Latency looked fine.
Then I captured the actual answers, and **every hard-task answer from
Lightning was empty** — all 500 completion tokens were thinking, zero
characters of content.

The root cause chain:

1. The gateway's answer targets spoke the **Anthropic wire**
   (`anthropic_messages`), because they were originally built for a
   Claude-Code-shaped client.
2. LiteLLM's `/v1/messages` translation **drops `chat_template_kwargs`** —
   so the `enable_thinking=false` flag never reached the vLLM engine.
3. Lightning thought with its default budget: ~220 tokens burned on "list
   three colors", the *entire* 500-token budget consumed on "write a
   fibonacci function" — thinking, no answer.

The fix was the same trick the routing judge already used: declare the same
model id on an **OpenAI-wire client** (where the thinking flag survives) and
point the route's weak tier at it. Before/after, measured on the same four
hard tasks:

![Wire bug: visible answer characters per hard task, before (0) vs after the OpenAI-wire target](/posts/local-model-routing/wire-fix-before-after.svg)

After the fix: 843–1960 characters of correct content per hard task
(the fibonacci answer is correct; the code review catches the same
`NameError` the big model catches), at 750–1100 ms — 2.5–4×
faster than the big model. The efficient tier went from "answers empty" to
"answers correctly, faster."

The general lesson: **the wire format is behavior.** The same model, same
prompt, same flags — routed through a different provider API — thinks
instead of answering. If you benchmark a tier, benchmark its *answers*,
not its counters.

## Bug 3: the judge with backwards polarity

With the wire fixed, the judge's conservative behavior stopped being
dangerous — but it was still weird. Across every configuration, the judge
escalated **trivial one-liners** ("What is 42?" went to GLM, deterministically,
in every run) and kept **all four hard tasks** on Lightning.

The docs explain why: the packaged judge is a *capability forecaster*, not a
difficulty scorer. It estimates whether the weak model can do the task,
guided by a packaged capability-card rubric. For my stack that rubric is
simply mismatched — and the proof is that swapping in a two-sentence custom
rubric moved the escalation profile from 3/12 tasks to 7/12. The rubric is
the product; the judge model is a commodity. (More on that in the
experiments below.)

## The experiment matrix

Once both bugs were fixed, I benchmarked five routing configurations on the
same 12-task set (8 trivial, 4 hard), each task scored for which tier served
it and how long it took. All non-live configurations ran on a throwaway
gateway with probe routes — the live config was never touched mid-experiment.

![Which tasks each configuration sent to the capable tier](/posts/local-model-routing/escalation-profiles.svg)

| configuration | capable / 12 | tasks escalated to GLM | p50 latency |
|---|---|---|---|
| **live**: capability, packaged rubric, threshold 0.7 | 5 | ok, 42, reply-ok, year, snippet review | 196 / 56 ms |
| escalation mode (answer-first, confirmations=1) | **0** | *none* | 318 ms |
| capability + strict-completeness rubric | 6 | ok, 42, haiku, reply-ok, **email, snippet** | 310 / 421 ms |
| capability + neutral-simple rubric | 8 | ok, 42, summarize, colors, year, **gpu-fib, bash**, snippet | 282 / 374 ms |
| capability + GLM as the judge | 2 | reply-ok, year | **1602** / 2974 ms |

![p50 latency by configuration](/posts/local-model-routing/latency-by-config.svg)

Four findings worth the price of admission:

**Escalation mode — answer-first — escalated nothing.** The trajectory judge
reads the *completed* weak answer and rules on whether the run is in
trouble. Lightning's post-fix answers are good, so it declined all twelve
turns. As routing that's a 200+ ms tax for zero tier changes — reject. As
*information* it's a free, independent quality audit: a second judge reading
actual outputs confirms the efficient tier's work.

**A stronger judge did not fix the inversion.** GLM-5.3-Flash as the judge
escalated *trivial* prompts and kept the code tasks — same backwards profile,
at 1.7 s per judge call. The defect is in the packaged rubric, not the judge
model's intelligence.

**The rubric moves the profile, crudely.** A strict-completeness rubric
("multi-part requests, code that must run correctly, long structured output
lower the estimate") was the first configuration to escalate hard tasks to
the capable tier — at the cost of three wasted trivial escalations. The
rubric is a *prompt*, so this knob is a prompt-engineering exercise with
measurable consequences.

**The judge is not deterministic run-to-run.** The baseline's escalated-task
set differed between morning and evening runs on borderline prompts. Any
A/B conclusion smaller than ~2 tasks of difference is noise.

## The thing I refused to believe — and the data that settled it

Every capability route I had seen judged **every request**. For an agentic
workload where tool continuations pour in, that means judging the same
opening task twenty times. I was sure this was wrong, and the v0.3.0 docs
agreed: `classify_trigger = "new_session"` judges once and reuses the
decision, and `message_hash_fallback` keys the session from the first user
message when the client sends no session identity.

Measured on the live configuration — same twelve tasks, same opening texts,
two repetitions:

![Rep 1 (judge fires) vs rep 2 (affinity, judge skipped)](/posts/local-model-routing/affinity-speedup.svg)

Rep 2 reused rep 1's tier decisions with **zero judge calls**: p50 dropped
from 82–3887 ms to 17–157 ms across the board (roughly 10×), with identical
outputs. One judge call per conversation. That number is the difference
between "routing as a feature" and "routing as a toll booth."

## What shipped

The live configuration after all of this:

- Route type `llm_classifier`, `mode = "capability"` — the judge estimates
  whether the fast model can do the task, with fail-closed semantics.
- `base_threshold = 0.7`, `threshold_step = 0.15` — **quality-optimal**:
  supported tasks need p_solve ≥ 0.7 to stay on the fast tier; uncertain
  tasks need ≥ 0.85; unmatched effectively always go to GLM. Concretely, the
  code-review-class task now escalates to GLM (its p_solve sits in the band
  the old 0.5 threshold let through), while the tasks Lightning provably
  answers correctly stay on the 5090.
- `message_hash_fallback = true` + `classify_trigger = "new_session"` —
  one judge call per conversation.
- The weak tier on the **OpenAI wire** — the fix that made its answers real.

End-to-end on the live route: once a conversation's decision is cached,
trivial prompts come back in 17–70 ms; hard tasks that stay on Lightning
complete in 1.0–1.5 s with full answers; the uncertain ones go to GLM. Every call counted, every call
traced, spend attributed per client key.

## The ledger I keep now

One more practice came out of this arc, and it is the least glamorous: a
**data-integrity ledger**. Two of the benchmark runs happened while bugs were
live, and their numbers had to be audited afterward — which measurements were
contaminated (latency absolutes from the empty-answer era), which survived
(judge decision profiles — the judge's own wire was healthy), and which
artifacts were re-labeled as *evidence* rather than data. The dirty runs were
deleted; the ledger in the notes says why, artifact by artifact. Debugging
archives are not benchmarks.

## What I would tell myself a week ago

1. **Generated artifacts have staleness clocks.** If a dashboard is compiled
   from config, a config change silently orphans it until regeneration.
2. **The wire format is behavior.** Thinking flags, reasoning budgets, and
   even whether the model answers at all depend on which provider API the
   proxy speaks upstream. Verify with real answers, not counters.
3. **Tier counters measure routing, not quality.** "Efficient tier served the
   request" is true even when the answer is empty. Capture and grade content.
4. **Fail-closed judges change your cost curve.** A judge that routes
   unparseable verdicts to the strong tier converts judge flakiness into
   spend. Bound it with `timeout_ms`.
5. **The rubric is the product.** The judge model is interchangeable; the
   packaged capability-card rubric is where the routing policy actually
   lives. Treat it like a prompt you own, with its own eval set.
6. **Per-request judging is a choice, not a law.** One judge call per
   conversation via session affinity — 10× on repeat turns — with a documented
   best-effort caveat: two sessions sharing an opening prompt share a
   decision.

The lab notes, the benchmark harness, the CSVs and the full data-integrity
ledger live in my private lab repository, and every number above comes from
those files. The console I watch this routing layer with is public:
[Nemo Console](https://github.com/willboyden/nemo-console).

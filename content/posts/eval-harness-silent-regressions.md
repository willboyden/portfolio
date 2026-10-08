---
# DRAFT-REVIEW: human review before publishing. All facts below trace to
# /opt/data/workspace/model-quality-harness (README + results/).
title: Building an eval harness that catches silent model regressions
slug: eval-harness-silent-regressions
summary: >-
  How a deterministic, no-LLM-judge harness for tool-calling reliability
  caught three classes of failure that HTTP 200 hides: empty content turns,
  reasoning burn, and a response cache that was lying about latency.
tags: [evals, llm, testing, python]
date: 2026-08-20
series: AI engineering notes
---

Every team that ships an LLM feature eventually builds an eval harness, and
every harness eventually answers the same question wrong: *did the model
succeed, or did the HTTP layer just return 200?* This post is the methodology
behind the harness I built for local models behind an OpenAI-compatible
LiteLLM broker — eight scenarios, three models, two repetitions, and a
scoring pass that never asks another model for its opinion.

## The scenario suite is fixed and adversarial

The suite ships as eight JSON files. Each scenario defines an OpenAI function
schema, a user prompt, simulated tool implementations, and success criteria.
The scenarios escalate deliberately:

- `weather_tokyo` — one tool call, final answer must cite the tool's value.
- `table_booking` — argument extraction: "eight people" and "7:30 PM" must
  arrive as `party_size: 8` and `19:30`.
- `pizza_distractor` — an expired coupon in context that must **not** appear
  in the call (`param_absent`).
- `inventory_then_reserve` — a two-step dependency: query the catalog, take
  the SKU from the tool result, reserve with it.
- `fx_conversion_retry` — the first call uses non-ISO currency names and the
  simulator *rejects* it; the model must retry with `EUR`/`USD`.

The retry scenario is the one that separates models. A single-shot accuracy
metric says nothing about whether a model can consume a tool error and
recover, which is most of what agent loops actually do.

## Deterministic judging, on purpose

There is no LLM-as-judge anywhere in the pipeline. Each emitted tool call is
validated against the scenario's function schema — no missing required keys,
no extras, no mistyped params — and parameter accuracy is checked under
normalization (numbers compared as floats, strings trimmed and
case-insensitive). The final answer is graded with criteria kinds like:

```json
{
  "kind": "params_exact_any",
  "tool": "convert_currency",
  "params": { "from": "EUR", "to": "USD" }
}
```

A fluent-but-wrong answer passes only if it actually states the expected
values (`answer_contains` matches case-insensitively and tolerates thousands
separators, so `1,301.04` matches `1301.04`). Yes, substring checks are
dull. They are also reproducible, which is the property an eval needs when
its whole job is telling you that Tuesday's deploy made Thursday worse.

## What HTTP 200 hides

Three real findings, all from logging one field deeper than the status code.

**Empty content turns.** A turn can return 200 with `content: null`. The
harness records `empty_content_turns` per scenario; a model that "completed"
without ever producing usable content now fails loudly instead of silently.

**Reasoning burn.** One of the tested models is a reasoning model served by
vLLM. With a small `max_tokens` the entire output budget disappears into
`reasoning_content` while `content` stays null and `finish_reason` reads
`length`. That combination — `finish_reason=length` plus empty content plus
non-zero reasoning — is scored as a distinct failure mode (`reasoning_burn_turns`),
and scoring calls get `max_tokens=2048` precisely to avoid measuring it as
model incompetence when it is really a sampling-budget artifact.

**The cache that flattered everyone.** The broker response-caches identical
request bodies. Sending the same JSON body twice returned the cached
completion in ~0.01 s with the same `id` — which made rep-to-rep variance
look near zero and latency look phenomenal. Proof: a repeated body came back
in 0.01 s versus ~1.4 s for a distinct one. The fix is one field: every
request gets a unique `user: mqh-<uuid>` stamp to bust the cache. After the
fix the same model's per-turn latency showed a real distribution — min
0.83 s, median 1.31 s, max 3.72 s — where before it showed a flat line that
was never real.

## Outages are data, not footnotes

During one re-run, two of the three models were down at the broker: one
returned a LiteLLM 404 (the upstream model does not exist), the other a 500
connection error. Both ran anyway and both were recorded as failures with
the real HTTP error bodies attached, and the dashboard shows that honestly
rather than silently shrinking the comparison to the one live model. 4xx
responses fail fast; only timeout/429/5xx get the single retry. A harness
that quietly drops unavailable models is not an eval, it is marketing.

The whole thing is Python 3.13 stdlib only — no pip, no framework, ~5–10
minutes for a full run, and a standalone vanilla-JS dashboard rendered from
the results JSON. The point of an eval harness is not sophistication. It is
that the same input gives you the same number twice, so the day the number
moves, you can believe it.

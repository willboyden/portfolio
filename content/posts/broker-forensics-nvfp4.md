---
title: "What the broker knows: forensics on a local LLM fleet from /v1 alone"
slug: broker-forensics-nvfp4
summary: >-
  Fingerprinting my own LiteLLM broker and vLLM fleet the way any client sees
  them — no admin access, /v1 only, by choice. Header archaeology, quantization
  evidence in deployment names, and a failure taxonomy turned into a runbook.
tags: [llm-inference, litellm, vllm, quantization, observability]
date: 2026-10-16
series: AI engineering notes
relatedPosts: [agent-proof-your-data-layer]
---

I wanted to know what was actually running on my own GPU fleet, and I gave
myself a constraint to make it interesting: no GPU access, no docker, no admin
API. Everything had to come from the one surface any client already has — the
broker's `http://litellm-broker:4000/v1` endpoints. On 2026-09-19 I spent a
session doing exactly that, and the answer to "how much can you learn from
/v1 alone" turned out to be: the serving stack's version, its quantization
naming convention, the topology of model-groups to upstream endpoints, and a
repair runbook — everything short of a look at the weights themselves.

## Header archaeology

The first probe is the cheapest: look at response headers. A plain
`curl -sv $B/chat/completions ...` on the broker returns
`x-litellm-version: 1.100.1`, an `x-litellm-call-id`, and
`server: uvicorn`. So within one request I know the broker is a LiteLLM proxy
at 1.100.1 running under uvicorn — no `/health`, no `/metrics` needed. Those
per-request call IDs are also a gift: they give you stable identifiers to
correlate across retries and logs, which matters the moment you start
comparing two groups' behavior on identical prompts.

The next check is what the allowlist permits. `bash nvfp4/admin_probe.sh`
against `/metrics`, `/server_info`, `/health`, `/model_info`,
`/get_server_info`, and `/launch_server` returned 403 on every one. Even
`curl -sI $B/models` (HEAD) is refused while a GET returns 200 — the allowlist
is method-aware. That is good hygiene on the operator's part, and it means
every finding below comes from the client-visible surface, the same one your
application code sees.

## Deployment names confess the quantization

Each response carries `x-litellm-model-name` and `x-litellm-model-api-base`,
and the probe `curl -s -D - -o /dev/null -X POST $B/chat/completions -d '{"model":"<M>",...,"max_tokens":8,"user":"nvfp4-<uuid>"}' | grep x-litellm-model-name`
shows the upstream deployment names for all three reachable upstream models:

- `qwen3.8-27b-1m` → `openai/unsloth/Qwen3.8-27B-NVFP4` at `http://vllm:8000/v1`
- `qwen3.8-flash-next` → `openai/Qwen3.8-Flash-Next-NVFP4` at `http://flashnext:8000/v1`
- `qwen3.8-flash-next-quick` → **the same deployment**, same api_base, different model-group

The literal `NVFP4` in every deployment name is evidence at the naming layer.
It is corroborated by a bonus artifact: a cached `fleet-pulse.json` whose 404
error text leaks "The model `poolside/Laguna-S-2.1-NVFP4` does not exist" —
so the operator names deployments after their quant format across the fleet,
not just for these two. But honesty demands the qualifier: that is a string in
a proxy config, not a measured property of the weights. A name could lie;
from this box the weights are uninspectable. I logged the claim as *confirmed
at the deployment-name layer, unverifiable at the weights layer* — and what
would settle it (docker inspect of the `flashnext` container's launch args,
or the upstream's `/metrics` quantization gauges) is precisely what the
/v1-only allowlist blocks.

## Two model-groups, one upstream endpoint

The flash-next pair is the most interesting topology finding. Both
`qwen3.8-flash-next` and `qwen3.8-flash-next-quick` resolve to the identical
`openai/Qwen3.8-Flash-Next-NVFP4` deployment at `http://flashnext:8000/v1` —
one GPU process behind two LiteLLM model-groups. Whatever differs between them
is routing config on the broker side, not a second engine.

A differential bench (identical prompts and token limits, N=1 through N=16
aggregate ladder) pinpoints the difference. At a 1024-token burn cap,
flash-next produced `reasoning_chars=4516, content_chars=0` while quick
produced `reasoning_chars=0, content_chars=4481`. Same token budget,
opposite output kind: thinking enabled versus thinking disabled. The
throughput numbers line up — 127.0 tok/s for flash-next at burn versus
169.7 for quick (quick's mean is dragged down by 2–3-token stops), and both
saturate around 250–330 aggregate tok/s on the ladder. Just as important is
what the data does *not* show: no consistent throughput gap that would suggest
quick is a smaller or more aggressively quantized checkpoint. The ~11% N=4
gap is within config-drift noise, and quick is actually *slower* in aggregate
at N=8 and N=16. Same engine, different reasoning toggle — that is the
load-bearing conclusion.

There's a lesson about trusting the wrong witness, too. I asked the models to
self-report their engine and quantization. Every run came back some variant of
"unknown": the 27b burned its entire 512-token budget planning the answer
without emitting it, flash-next did the same at 512 and 1024, and quick echoed
the template. Self-reports scored zero, as they should — models cannot see
their own serving stack. Headers and benches did all the work.

## The stub-fields quirk

One quirk worth knowing before you build tooling on top of `GET /v1/models`:
all 16 declared model groups carry `owned_by: "openai"` and
`created: 1677610602` — LiteLLM stub values, not real ownership or creation
timestamps. 1677610602 is February 2023, predating most of these models.
If your tooling branches on `owned_by` or model age, it will branch on
fiction. The per-group context limits, by contrast, are real and useful:

| model group | in | out |
|---|---|---|
| cluster/glm-5.3-flash(-next) | 1,048,576 | 32,768 |
| qwen3.8-flash-next (-quick), qwen3.8-27b-1m | 262,144 | 32,768 |
| switchyard | 262,144 | 32,768 |
| gpt-oss-120b | 131,072 | 16,384 |
| cluster/deepseek-v4-flash | 32,768 | 8,192 |
| llama-3.3-70b | 131,072 | 8,192 |
| hermes-4.3-36b | 65,536 | 8,192 |

That is a routing table you can plan against, obtained with one GET.

## From failure taxonomy to repair runbook

Forensics generalize, but operations need the boring version: what broke, what
it looked like, what to do. Over repeated fleet sessions I accumulated a
failure taxonomy that maps cleanly onto operator actions:

- **ENGINE-DOWN**: `500 Connection error` at ~0.06s — the fast-fail signature
  of a dead upstream, since the broker answers before doing any work. Repair:
  `docker compose up -d` on the GPU host, then re-probe.
- **BAD-UPSTREAM-NAME**: a 404 leaking the deployment name (the same class of
  error that handed me the Laguna NVFP4 naming convention). Repair: fix the
  broker's model list.
- **GPU-contention patterns**: throughput collapse across groups sharing one
  engine, visible in the ladder numbers before users complain.

Written down, that is an operator runbook: match the error signature to the
row, run the repair, re-run the probe. The probe itself is
`bash nvfp4/probe_up.sh` — HTTP 200 with `max_tokens=8` and a unique user per
model, three green lines when the fleet is up.

## The takeaway

Zero-admin-access forensics is not a party trick; it is what your monitoring
looks like when you only own the client side of a serving stack — which is
exactly the position most teams are in when they consume someone else's
inference endpoint. The `/v1` surface leaks more than most operators realize:
version headers, deployment names, api_base topology, declared limits. It also
leaks less than you want — the actual quantization of the weights stays behind
the allowlist, and the honest report says so rather than rounding "labeled
NVFP4" up to "is NVFP4". Fingerprint what you can, quote the command that
proved it, and mark the rest undetermined.

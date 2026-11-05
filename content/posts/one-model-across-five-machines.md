---
# Every number below was measured in my lab on 2026-11-03 and 2026-11-04 (source: my private lab notes).
# Host names, addresses, ports and file paths are left out on purpose.
title: "One model across five machines: a tensor-parallel size for each pipeline stage in vLLM"
slug: one-model-across-five-machines
summary: >-
  DeepSeek-V4.1-Flash now runs as one vLLM engine across four DGX Spark-class
  boxes and a two-GPU RTX PRO 6000 workstation, Arm and x86 in the same engine.
  A small patch gives each pipeline stage its own tensor-parallel size. Tuned,
  it decodes 174 tok/s on one stream and 786 tok/s across 128 requests, and an
  agentic coding loop runs 50% faster than on the best four-Spark setup I had.
tags: [vllm, deepseek, pipeline-parallelism, tensor-parallelism, dgx-spark, gb10, rtx-pro-6000, local-inference]
date: 2026-11-04
series: AI engineering notes
relatedPosts: [dgx-spark-busy-polling-heat, five-machine-engine-boot-time-and-minimax]
---

> **Update, 2026-11-05:** a boot now takes 3.6 minutes instead of 16. The slow part was the workstation's own weight load, not the GB10 boxes' NFS reads that "The page cache that would not stay warm" names as the cost of a restart; each rank now reads only the files that hold its layers. The same engine also runs a second model, MiniMax-M3.1-Flash. Both are in [The five-machine engine, a day later](/writing/five-machine-engine-boot-time-and-minimax).

My lab has seven GPUs of three kinds on six machines: two RTX PRO 6000 Blackwell cards in one x86 workstation, four
GB10 boxes (DGX Spark class: an Arm CPU and a Blackwell GPU sharing 128 GB of memory), and an RTX 5090 in another x86
box. They share a 200 Gb/s RoCE network. Until this week each model ran on one machine or on one group of identical
machines. I wanted a way to run **one model, as one engine, across whichever of these machines it takes**, and a way
to do it again for the next model.

The model I actually use for agentic coding is DeepSeek-V4.1-Flash-1017, DeepSeek's own checkpoint: 510 GB on disk,
too big for any single box here. It now runs as one vLLM engine across the four GB10 boxes and the two RTX PRO
6000s. Against the best setup I had before, SGLang on the four GB10 boxes alone with the same weights:

| | Four GB10 boxes alone (SGLang) | This engine (four GB10 + two RTX PRO 6000) |
|---|---|---|
| Single stream, "count to 100" | 116.9 tok/s | **174.5 tok/s** |
| Agentic coding loop, decode median | 88.7 tok/s | **132.7 tok/s** |
| Total at 16 concurrent requests | ~250 tok/s | about the same: 225–303 tok/s across runs |
| Most concurrent requests | 16 (it would not boot at 32) | **128 (786 tok/s total)** |
| Context window | 1M tokens | 1M tokens (a needle found at 1,012,167 tokens) |

This post is how it got there: the missing feature, the patch, the model-specific rules that only showed up one boot
at a time, the tuning that moved the numbers, and two bugs worth the detour.

![Layout of the engine: stage 0 is the four GB10 boxes at tensor parallel 4 with layers 0 to 19 and both Engram layers; stage 1 is the workstation's two RTX PRO 6000 cards at tensor parallel 2 with layers 20 to 39, the draft head and the output head. Hidden states flow forward each step and sampled and draft tokens are broadcast back](/posts/one-model-across-five-machines/layout.svg)

## The machines

| GPU | Count | Memory | Memory bandwidth | CPU |
|---|---|---|---|---|
| RTX PRO 6000 Blackwell | 2, in one workstation | 96 GB each | 1.79 TB/s each | x86 |
| GB10 (DGX Spark class) | 4 | 128 GB each, shared with the CPU | 273 GB/s each | Arm, 20 cores |
| RTX 5090 | 1 | 32 GB | 1.79 TB/s (on PCIe x8) | x86 |

The GB10 boxes have the memory and the PRO 6000s have the bandwidth. A decode step has to read every active weight
once, so bandwidth is speed: one PRO 6000 reads its memory about 6.5 times faster than one GB10 box. Four boxes
only get fast when they work on the same layer at the same time.

## The missing feature

Two kinds of parallelism split a model across GPUs:

- **Pipeline parallelism** splits the layers into stages, one after the other. A token goes through stage 0, then
  stage 1, and so on.
- **Tensor parallelism** splits each layer of a stage across that stage's GPUs, which read their parts at the same
  time and add up the result (an all-reduce).

One decode step costs roughly the sum of its stages' times. So the layout I wanted was obvious: the four GB10 boxes
as one stage at tensor parallel 4 (their bandwidth added up), and the two PRO 6000s as another stage at tensor
parallel 2. The GB10 boxes add capacity, the PRO 6000s add speed.

No engine I checked can do that. vLLM, SGLang and llama.cpp all use **one tensor-parallel size for every stage**.
vLLM can make the stages uneven in layers (`VLLM_PP_LAYER_PARTITION`), not in GPUs. Research systems such as HexGen
and Zorse go further, but none of them serves today's models on these GPUs. With one size for every stage, the GB10
boxes have to drop to tensor parallel 1 or 2, which makes each of their layers several times slower, or some
machines stay out.

My planner (more on it below) estimated what that costs for a 550B hybrid model I tried first: about 13 tok/s on the
four GB10 boxes alone, about 8 with every GPU as its own stage, and about 22 with the PRO 6000s at tensor parallel 2
in front of the GB10 boxes at tensor parallel 4. Only the last one needed a new feature. Those were estimates for
that model, and I have not measured that layout yet; the measured numbers in this post are for DeepSeek.

Writing a new engine was never the plan. vLLM 0.32 already runs these models on both GPU generations
(`sm_120` on the PRO 6000s and the 5090, `sm_121` on GB10), with their quantized kernels, speculative decoding and
multi-node launch. The missing piece is small and well defined, so I extended vLLM.

## The patch: a tensor-parallel size for each stage

The patch adds one setting next to vLLM's own layer split:

```bash
VLLM_PP_STAGE_TP=4,2           # stage 0: 4 GPUs, stage 1: 2 GPUs
VLLM_PP_LAYER_PARTITION=20,20  # stock vLLM: 20 layers per stage
```

What it changes:

- **Ranks are numbered stage by stage.** Ranks 0 to 3 are the GB10 boxes, ranks 4 and 5 the PRO 6000s. Each stage's
  ranks form its tensor-parallel group.
- **Between stages, any receiver can take the whole tensor from one sender.** After a stage's all-reduce, every rank
  of that stage holds the same hidden states. So receiver *i* of the next stage reads the full tensor from sender
  *i mod (previous stage's size)*, and no tensor has to be re-split when the sizes differ.
- **`--tensor-parallel-size` is the last stage's size.** vLLM takes each step's output from rank
  *world size − tensor-parallel size*, and with that setting the rule still lands on the last stage's first rank.
- **Each worker switches to its own stage's size before it builds anything**, so its layers, attention heads and
  cache are cut for its own stage. The cache is planned per worker, because some models' cache shapes change with
  the tensor-parallel size.
- **Version 1 refuses what it does not handle**, with a message that says why: data parallelism, expert
  parallelism, context parallelism.

All of it lives in eight vLLM files. The DeepSeek-specific fixes below are three more patches, and one optional
experiment (described under tuning) is off unless switched on.

**One image, two CPU architectures.** Every rank must run byte-identical Python, and half the engine is Arm and half
x86. The image is the official vLLM v0.32.0 image for each architecture plus the patched files, copied in with no
build step. A checker compares the sha256 of every patched file inside both images. One process runs per GPU; the
workstation's two GPUs are two vLLM "nodes" that happen to share a machine.

Three small surprises on the way:

- vLLM's shared-memory transport decided which ranks share a machine by counting visible GPUs, and each workstation
  rank sees both cards (for PCIe peer-to-peer). With the new setting it treats each process as its own node, as the
  launcher does.
- vLLM's custom all-reduce cannot work between two vLLM nodes on one machine, so this engine turns it off. NCCL over
  PCIe peer-to-peer does that stage's all-reduce.
- On the workstation's ZFS pool, the default memory-mapped loader read 5.4 TB from disk to load 80 GB of weights.
  vLLM's prefetch load strategy, which reads each file once, ahead of time, fixed it.

### How I knew it was right

Fast and wrong is easy to miss, so every layout had to agree with a single GPU before its speed counted. The check:
generate text greedily on one GPU, score that same text on the split layout (the model reads it token by token and
reports its log-probabilities), and compare position by position. On one GPU, two runs differ by at most 0.19 nats
(mean 0.006), so a split layout passes if its maximum difference stays under 0.5 nats and its mean under 0.03.

| Layout | Result | Speed |
|---|---|---|
| Nemotron Lightning 30B (NVFP4), one layer group per GB10 box (TP1 × 4 stages) | matches (max 0.46, mean 0.027) | 61 tok/s, against 70 on one box |
| Qwen2.5-7B, [two GB10 boxes at TP2 \| one box \| one box] | matches | 16.8 tok/s |
| Llama-3.3-70B (FP8), [two RTX PRO 6000 at TP2 \| the RTX 5090] | matches | **26.5 tok/s**, against 20.5 on one PRO 6000 |

The last row crosses two x86 machines: the 5090 box joined the workstation's two cards, and the three-GPU pipeline
ran 29% faster than the whole model on one PRO 6000.

## DeepSeek-V4.1: the rules you find one boot at a time

DeepSeek-V4.1-Flash-1017 has 40 layers with 384 routed experts each (6 used per token), MXFP4 experts, a DSpark
draft head inside the checkpoint for speculative decoding, and something unusual: two **Engram** layers (1 and 14),
which look up n-gram embeddings in tables of 101.5 GB each.

My planner reads the checkpoint's safetensors headers (no weights), totals the bytes of every layer and checks
which splits fit in which GPUs. For DeepSeek, memory alone ruled out layouts such as 14/26 (the PRO 6000s would need
about 94.5 GiB each). The split that fit was layers 0–19 on the GB10 boxes and layers 20–39, the draft head and the
output head on the PRO 6000s, about 75 GiB per card once loaded.

The planner did not know DeepSeek's own rules. Booting it found seven, one failed boot at a time:

| Rule | What changed |
|---|---|
| A stage must start at a layer that produces compressed attention cache (2, 8, 14 or 20). A 22/18 split was refused at load: layer 21 needs layer 20's cache on the same GPU | 20/20, the only valid split that fits (14/26 needs 94.5 GiB per PRO 6000) |
| The draft head reads the input embedding, which normally lives only on the first stage | the last stage builds the embedding too (V4's own rule for draft heads, applied under pipelining) |
| V4.1 routes its experts on token ids in every layer, so later stages need the token ids, not just hidden states | later stages keep the token ids |
| An attention-replay optimization expects ordinary layers before layer 20 on the same GPU | it is off for a stage that starts at layer 20 |
| The Engram tables must not sit in GB10 memory: pinned in RAM they took 47 GiB per box beside 41 GiB of weights, and two boxes stalled for 25 minutes at load | the tables stay in the checkpoint and each step reads its rows (ported from [ondigo-winder's GB10 work](https://github.com/ondigo-winder/deepseek-v4_1-1017-4-gb10)) |
| GB10's sparse-attention kernel needs 64-row cache pages | ported from the same repository |
| A cache group with no layers on a stage must give that stage no cache tensors; the PRO 6000 stage was handed cache for layers 2, 8 and 14, which it does not hold | each worker builds only its own layers' cache |

It answered its first request on 2026-11-03 in the evening: 17 × 23 = 391, a correct tool call, thinking on and
off. Single-stream decode was 127 tok/s counting to 100, 104 on code and 51 on prose; 16 requests made 140 tok/s in
total.

## Tuning: where a decode step went

A profile of one decode step showed the GB10 GPUs busy only 16–22% of the time. The rest was the Engram lookup.
Each step gathers about 180 table rows on the CPU (at 16 requests), and a row that is not in memory is a page fault over NFS,
one 264-byte row at a time: **28–37 ms of every step** at 16 requests.

A box only ever reads its own contiguous slice of each table, 23.6 GiB per table. So a warm-up reads that slice once,
sequentially, right after boot: 47 GiB per box in 25 seconds. The gather dropped to 0.4–0.6 ms per step. Prose went
from 51 to 62 tok/s, and 16 requests from 140 to 227 tok/s total.

The other changes that stayed, each measured on its own:

| Change | Effect |
|---|---|
| Fewer draft tokens as the batch grows (vLLM's per-batch-size schedule) | 8 requests: 149 → 190 tok/s; single streams unchanged |
| A bigger cache: 8 GB per GPU, 2.14 million tokens | room for two full 1M-token requests (capacity; I have not run two at once) |
| Up to 64, then 128 concurrent requests | 435 tok/s at 64, then 763 at 128 |
| Engram slices kept resident (next section) | 64 requests: 435 → 519 tok/s; long prompts 1.5–2.6 times faster to the first token |
| 5 draft tokens on a single stream, instead of 3 | count to 100: 126 → 174.5 tok/s; code 111 → 131.6; agentic loop 113.5 → 132.7 |

And the ones that did not, which matter as much:

| Tried | Result |
|---|---|
| No speculative decoding | slower everywhere except 64 requests (+5%, inside the noise) |
| Splitting each step's decodes across the stages | +7% at 16 requests, −10% at 8: dropped |
| DSpark's adaptive verification | unsafe here: it re-assigns draft slots from the draft head's confidences, which only the last stage has, so the stages would disagree on the batch |
| NCCL's tree algorithm for all-reduce | 3–8% slower than the default ring |
| 16K-token prefill chunks instead of 8K | ran a PRO 6000 out of memory on a 49K-token prompt; that stage has about 6 GiB to spare |
| Moving layers from the GB10 boxes to the PRO 6000s | does not fit (the 14/26 split above) |
| A second network port on each GB10 box | the all-reduces here are small and wait on the slowest box; on the GB10-only lane a collective benchmark ran the same on one port as on two. Not worth it |

What is left is close to the hardware. At 16 requests the GB10 boxes read their experts close to their peak memory
bandwidth, and in a profile at 16 requests the PRO 6000 stage spent about 70% of the window waiting to receive from
them. Run-to-run spread is about ±10% for the concurrent tests (temperature 1.0 means different text and different expert choices each run), so I
only kept changes that beat that.

## The page cache that would not stay warm

The next morning, the same long prompts prefilled 25–32% slower than the evening before.
Decode speed had not moved. That pattern (prefill slower, decode unchanged) usually means slower compute, so I
checked clocks and throttling first: 2.4 GHz, no throttle flags.

The answer was in the page cache. Asking the kernel which pages of each Engram slice were resident (`mincore`, which
reads no data) showed that right after two more warm-up passes, two of the four boxes held only 47–51% of their
slice. One of them still cached 32 GiB of ordinary weight files that the GPU had loaded hours earlier.

A GB10 box shares its 128 GB between the CPU and the GPU. With the engine running, the GPU's allocations take about
66 GiB, which leaves about 55 GiB for the page cache, and the slice alone is 47 GiB. The weight pages read during
loading were still cached ahead of the slice; the likely reason is that Linux keeps pages that were touched more than
once on its active list. A 47 GiB slice re-read through what was left of the cache kept pushing its own pages out.
Prompts with new text then faulted their rows over NFS again.

The fix needs no privileges: before reading the slices, the warm-up tells the kernel it no longer needs the other
weight files (`posix_fadvise(DONTNEED)`, which drops only clean cached pages), then reads the slices, then checks with
`mincore` that every box holds at least 95% of its slice, or it fails. All four now report 100%.

![Time to first token for the same lane and prompts. 12K tokens: 7.77 s before, 2.96 s after. 49K tokens: 18.7 s before, 11.1 s after. 194K tokens: 68.2 s before, 44.5 s after](/posts/one-model-across-five-machines/prefill-ttft.svg)

| Prompt | Before | After |
|---|---|---|
| 12K tokens | 7.77 s | **2.96 s** (2.6×) |
| 49K tokens | 18.7 s | **11.1 s** (1.7×) |
| 194K tokens | 68.2 s | **44.5 s** (1.5×) |

Decode got faster too, wherever many requests touch rarely used rows: 319 → 393 tok/s at 32 requests and 435 → 519 at
64.

There is a price. While the engine runs, a GB10 box can cache the slice or the weight files, not both, so a restart
now reads the weights over NFS again: 5 to 9 minutes of loading instead of about 2. A full local copy on each box
would remove that, but by my estimate it needs about 350 GB per box, and some boxes have less free space.
Per-rank checkpoint files, roughly the 40 GiB each box actually loads, are the next thing to try.

## A bug only the hybrid models hit

DeepSeek has attention layers only. Hybrid models such as Nemotron (Mamba, attention and mixture-of-experts layers)
broke on the same patch as soon as the stages had different tensor-parallel sizes:

- `[TP1 | TP2]`: wrong answers.
- `[TP2 | TP1 | TP1]`: an illegal memory access on the first stage.

Running the first stage with `CUDA_LAUNCH_BLOCKING=1` made `[TP1 | TP2]` correct, at 53.7 tok/s. That setting makes
every GPU launch wait for the previous one, so it was a strong hint of a race and not a fix.

**Finding the write.** DGX OS already ships NVIDIA's `compute-sanitizer`, so I mounted it read-only into the first
stage's container and ran that stage under its memory checker. It caught an out-of-bounds 8-byte write in the kernel
that copies Mamba state between cache blocks, to an address about 7.9×10¹⁷ bytes past any allocation. (Tip: turn
off its API-error reports, `--report-api-errors no`. NCCL's harmless "no kernel image" probes used up the print
limit before the real error.)

**Finding the value.** A garbage address meant a garbage index. Printing the kernel's inputs just before the launch
showed that, at the first decode step after a 31-token prompt, the first stage believed the request had
**1,088,798,923** tokens. Both of that stage's GPUs held exactly that number. Read as two bf16 halves it is
7.15 and −6.34: leftover activations, not a count.

**Finding the source.** Printing the same field after each update within a step put the garbage in the sampled-token
message the last stage broadcasts back to every rank. The earlier steps' messages had been correct.

**The cause.** vLLM moves each worker process onto its own CUDA stream the first time a helper asks for the
current stream. In stock vLLM that happens early, inside a device communicator's warm-up. The model runner's
pipeline handler remembers the current stream when it is built and orders its broadcasts against it. My pipeline
group had no device communicator, and a stage with a single GPU has no tensor-parallel one either. So on those ranks
the handler remembered the default stream, and the model then ran on another one. Its waits ordered nothing: a
single-GPU last stage could broadcast tokens before computing them, and a single-GPU earlier stage could read them
before they arrived.

**The fix** is one call: move every rank onto its dedicated stream as soon as the groups are built, before anything
remembers a stream. With no `CUDA_LAUNCH_BLOCKING`:

| Layout | Before the fix | After the fix |
|---|---|---|
| `[TP1 \| TP2]` | wrong answers (correct at 53.7 tok/s with blocking) | **matches one GB10 box (max 0.483, mean 0.020), 87.6 tok/s** |
| `[TP2 \| TP1 \| TP1]` | illegal memory access | runs; 78 tok/s; scores within stock vLLM's own drift for tensor parallel 2 |

On the second layout, the scores differ from a single box by more than my 0.5 / 0.03 limits (max 1.185, mean
0.038), but stock vLLM's own uniform `[TP2 | TP2]` differs more (1.380, 0.043): splitting this quantized model's
layers across two GPUs changes its numbers that much on its own. The limits were set for layouts without tensor
parallelism.

Two lessons I kept. `CUDA_LAUNCH_BLOCKING` hides races; it is a diagnostic, never a fix. And scoring a prompt only
exercises the prefill path: a layout can pass it while the decode path's broadcast still goes wrong. The
attention-only mixed layouts above passed before the fix, so their decode tests get re-run on the fixed build next.

## The numbers now

Everything below is the final configuration, measured on 2026-11-04 after a warm-up run with thinking off, except the
needle and one-hour rows, which say when they ran. The concurrency test asks each request for a 512-token essay,
which is why one request there (58.6 tok/s) lands near the prose number, not near "count to 100".

![Total decode throughput against concurrent requests. Tuned lane: 58.6 at 1, 144.8 at 4, 210.4 at 8, 303 at 16 (the best of several runs), 497 at 64 and 786 at 128 requests. First boot, limited to 16 requests: 45.7, 88.7, 114.7 and 140.4. The SGLang lane on the four GB10 boxes alone: about 250 at 16 requests; it would not boot at 32](/posts/one-model-across-five-machines/throughput.svg)

| Test | Result |
|---|---|
| Single stream, count to 100 / code / prose | **174.5 / 131.6 / 58.8 tok/s** (prose does not benefit from extra drafts: 61.4 with 3) |
| Agentic coding loop (read a module, fix a bug, run the tests), 2 rounds | both pass; decode median **132.7 tok/s** (with thinking on, 117 in an earlier run) |
| Total throughput at 1 / 4 / 8 / 16 requests | 58.6 / 144.8 / 210.4 / 303.0 tok/s (303 is the best run; 225–303 across runs at 16) |
| Total throughput at 64 / 128 requests | 497–571 (across runs) / **786 tok/s** |
| Needle in a long prompt | found at every size up to **1,012,167 tokens** (308 s to the first token at 1M, measured before the page-cache fix) |
| One hour at 16 concurrent requests | 96 rounds, no failure, 234 tok/s mean (run on 2026-11-03 on the earlier setup: 3 draft tokens, before the page-cache fix) |
| Tool calls | correct `finish_reason=tool_calls` with the right arguments |

The GB10 boxes run warm but stay inside their limits at these loads: 69 °C GPU and 78 °C on the hottest SoC sensor at
128 concurrent requests. A five-minute 1M-token prefill is the hardest thing I asked of them, at 81–84 °C GPU and
87–90 °C SoC. That is inside the range where one box cut its own power in October, so I run very long prompts under
a thermal guard, watch the peaks, and do not run them back to back. The [earlier post on the boxes' heat](/writing/dgx-spark-busy-polling-heat)
has the background.

## What about the 5090?

The 5090 is fast and small. With Llama-3.3-70B it was one stage of a pipeline that ran 29% faster than one PRO 6000.
With DeepSeek it does not help. A stage may only start at layer 0, 2, 8, 14 or 20, and eight layers would not fit in
32 GB, so it could hold layers 0–1 only; layer 1 is an Engram layer whose 101.5 GB table its host would have to keep
in its page cache. Taking two of twenty layers off the GB10 boxes would gain a few percent at most, by my estimate,
inside the run-to-run noise. Now that hybrid models work with a different size per stage, the 5090 is more useful as a stage for those.

## What I'd tell someone trying this

- **Check the numbers before you check the speed.** Scoring one GPU's greedy text on the split layout catches a
  wrong layout in minutes. Add a decode-heavy test, because scoring only exercises prefill.
- **Let the checkpoint headers plan the split.** Bytes per layer from the safetensors headers and the memory each
  device can give narrowed the choices before the first boot. The model's own rules (DeepSeek's cache-producing
  layers) still cost a failed boot; write them into the planner once you find them.
- **Profile the step before tuning it.** The biggest single gain here came from the CPU and the page cache, not
  from a kernel.
- **Prove a warm cache stays warm.** `mincore` tells you what is resident without reading a byte; a warm-up that does
  not check is a guess.
- **Treat `CUDA_LAUNCH_BLOCKING` as a clue.** If it fixes something, there is a race to find.
- **Look for the tools you already have.** The sanitizer that found the hybrid bug was already installed on every
  GB10 box.

## What's next

- Per-rank checkpoint files on each box's own NVMe, so a restart stops depending on NFS.
- Hybrid models (Nemotron and its relatives) on mixed layouts now that they work, with the 5090 as a stage.
- Decode-heavy tests for every mixed layout on the fixed build.

The patch is small: eight files for the per-stage feature, which keeps vLLM's own behavior when the setting is unset,
and three patches for DeepSeek, which change that model's code paths either way. For now it lives in my lab; the
numbers above are what it does today.

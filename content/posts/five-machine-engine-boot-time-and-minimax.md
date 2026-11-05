---
# Every number below was measured in my lab between 2026-10-29 and 2026-11-05 (source: my private lab notes).
# Host names, addresses, ports and file paths are left out on purpose.
title: "The five-machine engine, a day later: a 3.6-minute boot and a second model"
slug: five-machine-engine-boot-time-and-minimax
summary: >-
  A follow-up to running DeepSeek-V4.1 as one vLLM engine across four GB10 boxes and two RTX PRO 6000s. Each
  pipeline rank now reads only the checkpoint files that hold its own layers, and the time from the first log line
  to a serving API went from 16 minutes to 3.6. The same engine now runs a second model, MiniMax-M3.1-Flash with all
  128 experts, where a draft model makes a single stream up to three times faster.
tags: [vllm, minimax, deepseek, pipeline-parallelism, tensor-parallelism, speculative-decoding, dgx-spark, gb10, rtx-pro-6000, local-inference]
date: 2026-11-05
series: AI engineering notes
relatedPosts: [one-model-across-five-machines]
---

Yesterday's post, [One model across five machines](/writing/one-model-across-five-machines), described a small vLLM
patch that gives each pipeline stage its own tensor-parallel size, so one engine can span four GB10 boxes (Arm, one
Blackwell GPU each) and a workstation with two RTX PRO 6000 cards (x86). DeepSeek-V4.1-Flash runs on it. Two things
changed since: the time from the first log line to a serving API is four and a half times shorter, and the engine
now runs a second model, which was the point of building it as a general patch.

## A boot went from 16 minutes to 3.6

The last post put the cost of a restart on the GB10 boxes, which read their weights over NFS. That was wrong. Boots
on 2026-11-04 spent 430 to 890 seconds loading the workstation's stage (770 and 831 seconds on the last one before
the fix); the GB10 boxes took 87 to 113 seconds. I had not compared the per-host load times before writing it down.

The workstation was slow for two reasons that added up:

- **Every rank opened the whole checkpoint.** Each stage holds half of DeepSeek's 40 layers, but vLLM's loader
  walks every checkpoint file and drops the tensors it does not need. The files that hold only other stages'
  layers are still opened and paged in.
- **The workstation's filesystem caches only metadata for that dataset**, a setting chosen so it can serve the GB10
  boxes fast over NFS. vLLM's prefetch step reads each file once to warm the page cache, which does nothing there,
  and the memory-mapped loader then faults the data in one 1 MiB record at a time.

The fix is one more patch, in two parts:

- **A rank skips any file that holds only other stages' layers.** It reads the layer index out of each tensor name
  and drops a file only when every tensor in it belongs to a layer outside its own range. A file with anything it
  cannot classify (embeddings, norms, a vision tower) is kept. The draft model, which uses only its own heads, now reads
  3 files instead of 48.
- **Whole files, several at a time.** On the workstation the stage reads whole files instead of mapping them, four
  ahead per rank on worker threads: eight streams read 2.77 GiB/s from that pool, against 0.42 GiB/s for one.

| | Before | After |
|---|---|---|
| First log line to a serving API | 16 min 07 s | **3 min 35 s** |
| Workstation stage, weights per rank | 770–831 s (all 48 files) | **109 s** (26 of 48) |
| GB10 stage, weights per box | 87–93 s | **45–49 s** (28 of 48) |
| Draft model | 33–36 s | **2.6 s** (3 of 48) |

From starting the lane to it reporting ready now takes 5 minutes, which includes a 34-second warm-up of the model's
lookup tables.

The decode path did not change, but I checked anyway: the mean log-probability difference from the previous build was
0.027 nats, the same as between two earlier builds (0.027), and the largest single-token difference was 2.2 nats
against 2.4 there. The probe, a tool call and needle tests at 12K, 49K and 194K tokens all passed.

## A second model: MiniMax-M3.1-Flash with all 128 experts

MiniMax's own NVFP4 release of M3.1-Flash is about 250 GB, with 128 experts per layer. The workstation alone holds
192 GB, which is why the version I run on it alone is a community build pruned to 80 experts. Across the two groups
the full release fits: the workstation takes layers 0–35 at tensor-parallel 2, the four GB10 boxes take layers 36–59
at tensor-parallel 4, and the release's own draft model runs on the GB10 stage.

It took four things beyond a profile file:

- **The right vLLM build.** Stock vLLM's prefill kernel for this model is built only for datacenter Blackwell, so by
  my reading of its code it cannot run on these GPUs (I did not boot it); vLLM's own MiniMax build can, so the
  per-stage patch is rebased onto that build, for both CPU architectures.
- **A planner fix.** One of the model's cache page types could not be padded to the per-stage layout, so the planner
  now falls back to vLLM's own plan in that case.
- **The draft model.** Without it the engine decodes 45 tok/s on one stream, close to the planner's estimate of 44.8.
  The release ships a small draft model; with 6 draft tokens a single stream runs about three times faster on
  repetitive output and 1.7–1.9× faster on code. Prose is slightly slower (38–43 against 45 tok/s).
- **The loading fix above**, ported to that build: the workstation's stage loads in 70 s instead of 183, the GB10
  boxes in 232 s instead of 354, and the engine serves about six minutes after it starts.

| Test | No draft model | With the draft model |
|---|---|---|
| Single stream: count to 100 / code / prose | 45.4 / 45.5 / 45.4 tok/s | **131–142 / 76–86 / 38–43 tok/s** (four runs on two builds) |
| Total throughput at 1 / 4 / 8 / 16 requests | 45.0 / 106.2 / 163.2 / 247.8 tok/s | 48.2 / 88.7 / 124.1 / 180.6 tok/s |
| Needle in a long prompt | found at 12K and 49K tokens (194K not run) | found at 12K, 49K and **194K** (41 s to the first token at 194K) |
| Agentic coding loop (read a module, fix a bug, run the tests) | 1 of 2 rounds (this build still leaked reasoning into streamed replies) | **3 of 3**, decode median 77.7 tok/s |
| Tool calls | correct | correct |

The third column is also the first build with my reply-parser fix (next section), so the agentic and tool-call rows
are not a clean draft-model comparison; the speed rows are.

The draft model is a latency tool. It speeds up a single stream when the output is predictable and costs about a
quarter of the total at 16 requests, because every step now runs the draft work too. For comparison, the same release
on the four GB10 boxes alone, under SGLang with a different draft model (a community one, 5 draft tokens), gave 35–40
tok/s on prose and 50 on code when I measured it on 2026-10-29, in a separate 800-token test. The pruned build on the
workstation alone is still faster on one stream, but it has 80 of the 128 experts and a shorter context window, so the
two are different trade-offs rather than one replacing the other.

The GB10 boxes stayed inside their limits: 74–79 °C GPU and 80–84 °C SoC at the hardest point, the 194K-token prefill.
The workstation's CPU is the part to watch with this model. Its two worker processes keep about six CPU cores busy
under load, and it reached 85 °C during boots and 86 °C during a benchmark, so I give it breaks between long runs.

## Test each way a reply can come back

Two of the bugs I fixed along the way were in how the server splits a reply into the model's reasoning and its
answer. Streamed replies came back with the reasoning inside the answer, while plain replies were fine. My first fix
for that broke another mode: replies constrained to a JSON schema came back with an empty answer. Both are fixed in my
build now, and each fix comes with a test that fails on the build before it.

The lesson is the test matrix, not the bug. After any change to how replies are parsed, I now check each mode on this
list: plain and streamed, with and without the thinking switch, a tool call, a required tool call, and JSON-schema
output. The first fix passed the four tests I had written for its own bug and failed one I had not thought to run.

## What I'd tell someone trying this

- **Time every host before you blame one.** One log line per host ("loading weights took N s") would have pointed at
  the workstation a day earlier.
- **A rank should read only what it keeps.** On a pipeline split, most of a checkpoint belongs to other ranks; the
  layer index in each tensor name is enough to skip whole files, as long as a file with any name you cannot classify
  is kept.
- **Check how your filesystem caches before trusting a prefetch.** A warm-up that reads each file once is wasted on a
  dataset that caches metadata only.
- **Measure a draft model at more than one concurrency.** It helps a predictable single stream and hurts a full
  batch; switching the number of draft tokens by batch size is the next thing I will try for MiniMax.
- **One engine, several models.** The second model needed a different vLLM build, a fix to the per-stage cache
  planner, a reply-parser fix, a draft model and a profile, not a new engine. That was the reason to build it as a
  general patch.

## What's next

- A draft-token count that falls as the batch grows, as the DeepSeek lane already does.
- More models on the same layout, now that a restart takes minutes instead of a quarter of an hour.

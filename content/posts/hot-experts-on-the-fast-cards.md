---
# Numbers are from my own lab measurements, mostly of 2026-11-14 (source: my private lab notes).
# Host names, addresses, ports and file paths are left out on purpose.
title: "Hot experts on the fast cards: the five-machine engine, 1.6 times faster"
slug: hot-experts-on-the-fast-cards
summary: >-
  DeepSeek-V4.1-Flash on the same four GB10 boxes and two RTX PRO 6000 cards now writes code 1.6 times faster on one
  stream and serves 16 requests 2.3 times faster. The fast cards run the trunk and each layer's most-read experts,
  the GB10 boxes serve the rest, and both tiers work at the same time.
tags: [vllm, deepseek, moe, tensor-parallelism, dgx-spark, gb10, rtx-pro-6000, local-inference, performance, benchmarking]
date: 2026-11-14
keyMetric: "code on one stream, against the layer split = 1.6×"
series: AI engineering notes
relatedPosts: [one-model-across-five-machines, five-machine-engine-boot-time-and-minimax]
---

> **Update, 2026-11-17:** a draft count that follows each request, and a better way to measure a small change.
>
> The draft head also scores its own drafts. With the engine's adaptive verification, a step verifies only the drafts whose chance of being kept is worth the row they cost: a request that is writing predictable text keeps all five, one that is not gets one or two, and the tokens that come out are the same. It needs a price list of what a step costs by its number of rows. The engine's own list comes from dummy passes, on which a row looks free on this layout, so I measured one on agent loops.
>
> Two starts of the lane could not tell me what it is worth. One pair of starts said +14% at one agent and the next pair said -5%: two starts differ by up to 10% by themselves, before anyone touches the desktop. So the engine now measures it itself. Every 128 draft steps it switches between the two policies and counts each step's time and tokens, so both meet the same lane in the same minute. With agent loops and thinking at its highest setting: no difference at one request (-0.0%, 95% interval -4.7 to +4.7), +6% at two, -4% at three to four, and about a tenth at five to eight (+9.6%, and +11.0% on a second start, interval +6.9 to +15.2). Parallel essays gain far more: +31% at 16 requests and +51% at 64, between two starts, which is well beyond what two starts differ by. With few requests a row costs about half of what my price list says, and about 16 ms of a 20 ms step do not depend on the drafts at all, so there is little to save there.
>
> So it is an option that trims only from five requests in a step, and the lane I use every day still verifies every draft. One more lesson for the list at the end: a change worth a few percent is measured inside one start, and read by its interval.

> **Update, 2026-11-16:** three things have changed since these numbers were measured.
>
> The placement now follows the sessions. "What's next" names a placement that follows the running sessions; it was built the same evening, though not as the per-step cache sketched there, which would have needed about 92 promotions per step. Instead a reserve, the coldest 15% of the experts on the fast cards, is also loaded on every GB10 box, and the engine trades reserve experts for the cold ones the sessions read, a few per second, between two decode steps. After five minutes of code, a decode step of code went from 23.4 ms to 21.0 ms, and the correctness checks pass after 1,500 swaps.
>
> The lane is set up for agent loops, which is what I mostly run. The KV cache went from 8 to 16 GiB per card (about 4.6 million tokens), paid for with experts (5,486 on the fast cards instead of 6,400), and the engine drafts five tokens at every request count. One stream pays for that: code is at about 199 tok/s today against the 218 in the tables below. In return, 32 agent loops that share a cached prompt write 603 tok/s in total, 64 write 816 and 128 write 1,005.
>
> Reading a new prompt got faster. A prefill layer call now serves the GB10 boxes two at a time, which reads 13 to 15% more prompt tokens per second: the first token at 12K / 49K / 194K prompt tokens comes after 1.8 / 7.0 / 28.5 s on the sliced layout.
>
> The ratios against the layer split below are those of 2026-11-14; the layer split has not been measured again under the new settings. A second model family runs in this layout since 2026-11-16: see the note on [the MiniMax post](/writing/five-machine-engine-boot-time-and-minimax).

Ten days ago I wrote about [running one model as one vLLM engine across five machines](/writing/one-model-across-five-machines):
four GB10 boxes (DGX Spark class) and a workstation with two RTX PRO 6000 cards, with DeepSeek-V4.1-Flash-1017 split
between them by layer. It works. A profile of it also showed what it wastes: on a single stream the two fastest
cards I own spent less than 30% of a decode step computing and waited for the GB10 boxes the rest of the time.

This post is a second way to spread the same weights over the same machines. One single-stage vLLM engine on the
workstation's two cards runs everything that every token needs (the **trunk**) and keeps each layer's most-read
experts. The GB10 boxes hold the other experts and serve them layer by layer, while the fast cards run their own.
Measured on the same day, with the same checkpoint, against the layer split:

| | Layer split (the earlier post) | By popularity, whole experts | By popularity, sliced experts |
|---|---|---|---|
| Single stream: count / code / prose | 177.5 / 135.0 / 62.3 tok/s | 218.4 / 184.5 / 98.4 | **260.8 / 218.1 / 110.0** |
| against the layer split | | 1.23× / 1.37× / 1.58× | **1.47× / 1.62× / 1.77×** |
| Agentic coding loop, decode median | 143.4 tok/s | 211.1 (1.47×) | **243.8 (1.70×)** |
| Total at 16 concurrent requests | 240.7 tok/s | 549.2 (2.28×) | **565.6 (2.35×)** |
| Time to first token, 12K / 49K-token prompt | 2.72 s / 10.68 s | **1.51 s / 5.88 s** | 2.14 s / 7.86 s |
| Hottest GB10 GPU during the run | 65–69 °C | 55–60 °C | 58 °C |

Nothing is pruned and nothing is re-quantized: these are the same weights, and a section below measures how closely
the answers agree. The two right-hand columns differ only in how the GB10 boxes hold their experts ("whole" and
"sliced" are explained further down).

The rest of this post is how it got there, in roughly the order it happened: the profile, three measurements that
could have ended the idea, a toy model, the real model, and two slowdowns that turned out not to be the engine at
all.

![Layout: the workstation's two RTX PRO 6000 cards run one vLLM engine at tensor parallel 2 that holds the trunk of all 40 layers, the KV cache, the draft head and the 6,400 most-read experts. Each of the four GB10 boxes runs an expert server that holds the other 8,960 experts and serves rows of the two Engram tables. For every layer the engine sends token rows and their routing to the boxes and adds the partial sums they return](/posts/hot-experts-on-the-fast-cards/layout.svg)

## Where the step went

One decode step of the layer-split engine, kernel time per GPU on a single stream (the profiler slows a step by about
30%, so read these as shares; the parts are rounded):

| | A GB10 box (layers 0–19) | An RTX PRO 6000 (layers 20–39, draft head) |
|---|---|---|
| Routed experts | 10.3 ms | 3.2 ms |
| Dense matrix products | 8.1 ms | 5.3 ms |
| All-reduce inside the stage | 4.6 ms | 0.9 ms |
| Everything else | 2.6 ms | 2.4 ms |
| **Work per step** | **25.7 ms** | **11.8 ms** |

Three things in that table decided the design.

**The stages take turns.** A token goes through the GB10 stage, then through the workstation stage. While one works
the other waits, and the GB10 stage needs 2.2 times as long: of a profiled step of about 42 ms, a fast card computes
for 11.8.

**Expert time is bytes divided by bandwidth.** This model is about 6.9 GB of dense trunk, which every token reads,
and about 289 GB of routed experts: 384 per layer, 18.8 MB each, six read per token per layer. An RTX PRO 6000 reads
its memory at 1.79 TB/s and a GB10 box at 273 GB/s, so the workstation has 3.3 times the memory bandwidth of the
four boxes together. A split by layer gives it half of the bytes. The slower tier sets the pace, and no tuning of
that layout changes it.

**Under load, a step carried about half of the requests.** With 16 requests the two stages worked on different
batches at the same time, 6 requests in one and 10 in the other, so each request advanced on every second engine
step. A single-stage engine advances every request on every step. That is one reason the gain at 16 requests (2.3×)
is larger than on one stream (1.6×); I did not measure how much of it this accounts for.

## The design

- **The trunk engine** is a single-stage vLLM engine: tensor parallel 2 on the workstation's two cards, with vLLM's
  expert parallelism. It runs attention, norms, the shared experts and the router of all 40 layers, the KV cache, the
  draft head for speculative decoding, the sampler and the API. One thing changes inside it for this design, the
  mixture-of-experts layer. After the router has picked each token's experts, the layer runs the experts its own card holds, as before.
  For the others it sends the token rows and their routing to the GB10 boxes and adds the partial sums they return,
  just before the layer's ordinary all-reduce.
- **An expert server** runs on each GB10 box. It is a small process built from the engine's own classes: it loads
  routed-expert tensors only, receives rows and routing for a layer, runs the engine's own expert kernel on the
  experts it holds and sends the weighted partial sum back. It has no attention, no KV cache, no tokenizer and no API.
- **A placement file** says, for every (layer, expert) pair, who holds it: one of the two trunk cards or a GB10 box.
  It is computed from a trace of real work, described below.

The link between the two is NCCL send and receive over the same 200 Gb/s RoCE network as before, on a communicator
of its own, so the GB10 boxes are not ranks of the engine. That matters: every rank of a vLLM engine runs every layer
of its stage, so as ranks the boxes would have to run the trunk too.

Placing experts by how often they are used is not a new idea. Engines that keep experts in system memory cache the
popular ones on the GPU, and earlier this month I had built such a cache for a single-GPU setup. This is the same
observation applied across machines: the popular experts go where the bandwidth is.

## Three measurements that could have ended the idea

The design rests on three assumptions. I measured the round trip first. The model's weights were not available that
morning, so I built the mechanism on a toy model next (the following section), and took the routing trace and ran
the simulation when the weights were back. Any of the three could still have stopped the real build.

**1. A round trip is cheap enough.** Every layer now pays one trip to the boxes and back. A small benchmark sent a
decode-sized tensor from one RTX PRO 6000 to all four boxes and back, inside one captured CUDA graph, 40 times per
step as the model would:

| Payload per box | 8 KB | 32 KB | 128 KB | 512 KB |
|---|---|---|---|---|
| Round trip to four boxes, median | 62 µs | 74 µs | 113 µs | 253 µs |

My target was 100 µs at 32 KB, and I would have stopped above 250 µs. Bulk transfers reached about 22 GB/s through the workstation's one port,
which bounds how fast a long prompt can be fed to the boxes.

**2. Routing is skewed enough.** I recorded which experts every token used on the layer-split engine: 13,644 engine
steps and 6.9 million expert reads during decode, across agentic test runs, a replay of 36 turns from 12 of my own coding sessions,
repository documents, general tasks and the benchmark prompts. Only expert ids are kept, never text.

- Routing is moderately skewed: the top 10% of a layer's experts take 32–50% of its routings.
- Tested on workloads the placement had not seen, the most-read 40% of the experts served 71% of decode reads and
  the most-read 47% served 77%.
- It is strongly local in time. A cache that follows recent use and holds 47% of each layer's experts would hit
  92%. A fixed placement leaves that on the table; it is the next thing to build.

My first pick was wrong in an instructive way. I ranked experts by all of their routings, and that placement
served only 62% of decode reads. Prefill is 93% of all routings, and during prefill this engine runs the upper
layers only on the last 128 tokens of a prompt, so "all routings" handed the lower layers nearly everything and
left layers 20–39 with about 30 experts each. Decode needs every layer. Ranked by decode reads, the same budget served 77%.

**3. The sums work out.** A small simulator replayed the traced steps through a candidate placement, using the
measured round trip and per-expert kernel times. It predicted 1.4–1.5× on a single stream. A hand calculation with
the same constants said that placing by layer alone, with every lower-layer expert remote, would gain about 1.1× on
one stream and lose a little at 16 requests: the popularity placement is the gain, the remote call is only the
mechanism.

## The mechanism on a toy model

The first version ran on a four-layer, 32-expert model with random weights, small enough to boot in seconds and to
compare against a single GPU exactly.

**Correctness came first, and found a real bug.** The first split run was off by up to 0.52 nats against one GPU. A test
that builds one layer's experts whole and as three holders in one process found it: holders whose experts were ids
0 to n−1 were exact and every other subset was wrong. Some expert kernels assume that a rank's experts are one
contiguous block, which is true of the default expert-parallel layout and false for a popularity placement. The tiered layer
now refuses to start with a kernel that does not honour the expert map. With a kernel that does, the split agrees
with one GPU as closely as vLLM's own two-GPU expert-parallel split does (largest difference 0.036 nats against
0.037).

**Then overhead.** The first protocol sent a header and a payload for every layer, and the server answered each one
from Python: 0.37 ms per layer call, against 0.06 ms for the bare round trip. At 40 layers that is 15 ms per step,
more than the whole expected gain. The second version sends one plan for a whole forward pass. The server captures
"receive, run the experts, send" for every layer of that plan into one CUDA graph and replays it on each step, the
same way the engine replays its own.

| Four-layer toy, single stream | One GPU | Protocol 1 | Protocol 2 |
|---|---|---|---|
| Decode step | 0.54 ms | 2.03 ms | 0.79 ms |
| Cost per tiered layer call | | 0.37 ms | **0.063 ms** |

At 63 µs a call costs what the network costs. The server's own overhead is gone.

## The real model: what did not fit the plan

**Memory.** I had hoped to fit 7,600 of the 15,360 experts on the two cards. An expert takes 19.6 MB on the GPU, and
a card also holds 7.6 GiB of trunk weights, about 4.5 GiB of draft head, about 4.6 GiB of runtime buffers and 8 GiB
of KV cache. With 6,900 experts the engine ran out of memory while capturing its graphs. 6,400 fit (41.7%), with the
cards at about 90 of 96 GiB while serving.

**The Engram tables.** DeepSeek-V4.1 looks up n-gram embeddings in two 101.5 GB tables. In the layer split the GB10
boxes keep their slices of those tables in their page cache. The trunk now lives on the workstation, and reading the
rows from the workstation's own disk pool cost about 20 ms of every decode step, as much as everything else in it.
So the rows stay where they were already warm. Each GB10 box runs a small row server, and the trunk asks it for each step's rows.

That brought a lookup down to about 1 ms, and a detail was hiding in the rest:

| 36 rows from one box | Median |
|---|---|
| Requests back to back | 77–164 µs |
| Requests 20 ms apart, as between decode steps | 276–938 µs |

The rows cost 0.1 ms. Waking a sleeping server thread on a GB10 box costs up to 0.8 ms. The row server now keeps
polling for 250 ms after a request and sleeps only when the lane is idle: one busy core per box while tokens are
being generated, none otherwise. Lookups fell to 0.47–0.68 ms, and single-stream decode gained about 10%.

**One hang at startup** cost two failed starts. The lane was silent, and my first two explanations were wrong. What located it
was looking in the right order: disk activity, CPU, the network counters (no bytes were moving, so it was not my new
link), and then a stack dump of every thread in each process, which showed two processes waiting for each other. I
now look at the counters before I read logs, and dump stacks before I guess.

## Whole experts or slices

There are two ways for the GB10 boxes to hold the 8,960 experts that do not fit on the fast cards.

- **Whole:** every cold expert lives on one box. In prefill, where rows are sent only where they are needed, a row
  goes only to the boxes that hold one of its experts.
- **Sliced:** every box holds a quarter of every cold expert, as in tensor parallelism. All four boxes work on the
  same expert at once, so a cold expert is read at four times the bandwidth, and in prefill every row with a cold
  expert goes to all four boxes.

On the same code, the sliced layout decodes a single stream 11–21% faster (at 16 requests the two are within noise)
and prefills 25% slower. In decode the rows are few and the boxes' bandwidth is the limit. In prefill there are thousands of rows per chunk and the link is the limit: about 87%
of a chunk's rows travel to each box, against about 36% with whole experts.

| | Whole | Sliced |
|---|---|---|
| Agentic decode median | 211 tok/s | 244 tok/s |
| Prefill rate | about 8,100 tok/s | about 6,100 tok/s |
| First token at 194K prompt tokens | 24.4 s | 31.7 s |
| Start-up | about 5 minutes | about 7 minutes |

A rule of thumb from the two rates: a turn is faster on the sliced layout when it writes more than about 6% as many
tokens as it reads new prompt tokens. Agent loops and chat, where the context is already cached and the model mostly
writes, run sliced. One question over a long new document runs whole. Both are profiles of the same engine; I switch
by restarting.

## Is it still the same model?

Same weights should mean same answers, and floating-point sums in a different order never give exactly the same
numbers. The check from the earlier post compares log-probabilities position by position. On 131,000 tokens of long
texts, from position 33 on:

| | Mean difference per token | Positions more than 1 nat apart |
|---|---|---|
| Layer split against itself (two runs) | 0.0271 nats | 39 |
| Whole experts against the layer split | 0.0278 nats | 39 |
| Sliced experts against the layer split | 0.0281 nats | 56 |

So the new layouts differ from the old one about as much as the old one differs from itself.

**Why "from position 33".** The first positions of a sequence disagreed far more, between the layouts and between
two runs of a new layout. (The layer split's own two runs agreed exactly at position 1, though not at positions
3–32.) Measured on the first start of the whole-expert layout, before tuning and pinning:

| Positions | Layer split against itself | New layout against the layer split |
|---|---|---|
| 1 | 0.000 nats | 3.03 nats |
| 3–4 | 0.062 | 1.95 |
| 17–32 | 0.199 | 0.60 |
| 33–64 | 0.090 | 0.124 |
| 65–128 | 0.059 | 0.069 |

I guessed large activations at the first token. A measurement said no: its numbers look like any other row's. What
it is instead is chaos in the plain sense. I sent the same request twice and logged the first token's row layer by
layer. Layers 0–6 were identical. At layer 7 one partial sum differed by a single bf16 rounding step. At layer 12
the router picked a different expert. From layer 17 on it was a different computation. I did not find where that
first rounding difference between two identical requests comes from. The layer split shows the same sensitivity
when something perturbs its rounding: its own score at position 1 moves from −5.38 to −4.65 when only the size of
the first chunk changes.

So position-by-position equality means something only once the context has grown, and the start of a sequence needs
a different question: is it as good? A second check scores the real next token over positions 1–32 of 200 short
natural texts on both engines and compares the means with a bootstrap interval. New layout minus layer split:
−0.007 nats per token, interval −0.032 to +0.016. No difference that 200 texts can show.

That check found one thing equality could not. Beyond position 32 of those short texts the new layouts scored
slightly worse: 0.008–0.009 nats per token, about 0.8% higher perplexity, and all ten runs were below both baseline
runs. In the placement in use, 110 of the 155 experts that the first token routes to in the lower layers were cold,
so the first token's row was assembled from up to six holders, and every later token attends to that row. Pinning
those 155 experts to one trunk card shrank the gap to −0.0022 (interval −0.0091 to +0.0043, no longer
distinguishable from zero) and cost 0.3 points of decode locality.

The other gates, on both layouts: an arithmetic probe, a tool call with the right arguments, a needle found in
prompts of 12K and 49K tokens (and of 194K on the placements before the pinning), structured output, and an agentic
coding loop (read a module, fix a bug, run the tests). That loop passed 14 of 14 rounds on the layer split, 18 of 18
on whole experts and 37 of 38 on sliced; the miss fixed the bug and ran the tests but did not stop within its eight
turns.

Endurance: the sliced layout ran for an hour at 16 concurrent requests without a failed round (224 rounds) on the
morning's code, before the first-token pinning and the polling row servers. The whole-expert layout did the same on
the final image (201 rounds), and a seven-minute run of the sliced layout on the final image (26 rounds) had no
failure either. I have not repeated the 1M-token needle of the earlier post on these layouts.

## Two slowdowns that were not the engine

**One box with part of a table out of memory.** The first measurement of the packaged image came in 16% slower at 16
requests, and the first token on a 49K prompt took 11.3 s instead of 7.6 s. Single-stream decode looked normal, which
is exactly why a quick check misses it. One GB10 box was missing about 7% of its slice of one Engram table (about
2 GiB) in its page cache, and the other three held all of theirs. A row that is not cached is a page fault over the network,
and every lookup waits for the slowest box. The cause was stale pages: the lane that had run just before gave that
box a different quarter of the same two files, 12.7 GiB of it were still cached, and the kernel made room by dropping
part of the new quarter.

Since then nothing is assumed. The launcher asks the kernel which pages of each box's slice are resident (`mincore`,
which reads no data), drops what is stale, reads back what is missing, and refuses to start the trunk if a slice
cannot be made resident. One trap on the way: to a user who neither owns the files nor may write them, as inside the
server's container, `mincore` answers "everything is cached". The check has to run as the files' owner. Later the same day a different model's
leftover files did the same thing to another box, and the check refused the start, which is what it is for; the
repair now drops other checkpoints' stale pages too.

**The desktop.** Twice during a one-hour run the engine slowed for several minutes, at worst from about 525 to
about 450 tok/s, and recovered by itself. Caches, clocks, temperatures and the GB10 boxes were unchanged. I blamed other programs using the
workstation's CPU, and a closer look said otherwise: a minute with eleven more busy cores had changed nothing. So I
ran a steady load for seven minutes and sampled the machine every few seconds:

| Browser and window manager CPU during a round | Rounds | Total tok/s: mean (range) |
|---|---|---|
| Under 15% (nobody at the desktop) | 9 | 575 (561–586) |
| 15–60% | 10 | 559 (544–577) |
| 60% or more (someone scrolling or typing) | 6 | 537 (508–559) |

Round speed followed the desktop's activity (correlation −0.82) and hardly the machine's other busy cores (−0.21).
The likely reason is that one of the two cards also draws the screen. I have not proven that part: nobody has moved
the display to another output and measured again. The practical rule is proven enough: a benchmark counts only while
the desktop is idle, and a 10% difference between two runs has to beat this before it means anything.

## The numbers now

Everything here except the last comparison was measured on 2026-11-14, on one start of each layout (the sliced
agentic median is from the second, pinned start that morning): medians of three runs after a warm-up, thinking off,
temperature 1.0. Run-to-run spread is about ±10% for the concurrent tests. The sliced column of the
table at the top is the morning's start. Other starts of the same code that day measured 221–260 tok/s counting,
183–220 on code and 560–595 tok/s at 16 requests. The lowest was a start that ran about 12% slow for its first four
minutes, which I have not explained; one of the other low ones was measured with the desktop in use.

![Total decode throughput against concurrent requests on 2026-11-14, two lines. Layer split: 66 tokens per second at 1 request, 155 at 4, 172 at 8, 241 at 16. Experts by popularity, sliced: 115, 283, 411 and 566 at the same loads, then 720 at 32, 988 at 64 and 1,254 at 128 requests. The whole-expert layout is in the table below](/posts/hot-experts-on-the-fast-cards/throughput.svg)

| Concurrent requests | Layer split | Whole experts | Sliced experts |
|---|---|---|---|
| 1 | 66.0 tok/s | 104.6 | 115.0 |
| 4 | 155.0 | 257.9 | 282.8 |
| 8 | 171.7 | 377.9 | 410.6 |
| 16 | 240.7 | 549.2 | 565.6 |
| 32 / 64 / 128 | not measured that day | not measured | 719.9 / 987.9 / 1,253.8 |

For scale: ten days earlier the layer split measured 786 to 891 tok/s at 128 requests (I did not re-measure it at
that load on 2026-11-14); 1,254 is 1.4 to 1.6 times that.

A profile of one decode step of the sliced layout: 19.9 ms under the profiler, against about 42 ms for the layer
split. The fast cards now do their own work for about three quarters of the step and wait 3.2 ms for the boxes'
replies. No single large item is left: the largest are the trunk's own experts (4.9 ms), its dense products (3.6 ms)
and that wait.

The GB10 boxes run cooler because they do less: 55–60 °C on the GPU, where the layer split reached 65–69 °C. The
exception is a burst: at 128 concurrent requests the hottest SoC sensor reached 80 °C in under a minute, so a long
run at that load still gets watched.

## What I'd tell someone trying this

- **Find out who is waiting.** A profile of each tier, per step, said more than any benchmark. The fast cards
  computed for less than a third of each step, and no throughput number shows that.
- **Put bytes where the bandwidth is.** In a mixture-of-experts model nearly all the bytes are experts, and a token
  reads only a few. Which experts sit on the fast memory matters more than which layers do.
- **Measure what can end the idea before building the expensive part.** One round trip, one routing trace and a
  replay through a simulator: any of the three could have stopped the work before I booted the real model in the
  new layout.
- **Count the thing you will be waiting for.** Ranking experts by all routings optimized prefill and starved decode.
- **Make the remote side replay a graph.** Per-layer work in Python on the server cost six times the network.
- **Compare where comparison means something.** The start of a sequence is sensitive to rounding on every layout.
  Test equality later in the sequence, and test quality at the start.
- **A benchmark measures the whole machine.** A cold page cache on one box cost 16%, and someone using the desktop
  cost up to about 14%: as much as a real tuning step gains.

## What's next

- A placement that follows the running sessions. At the same size, the trace says a cache that follows recent use
  would serve 92% of decode reads where a fixed placement serves 77%.
- A cost model in the planner, so the next model's placement can be estimated before its first start.
- The layer split stays available. It needs no placement trace and remains the simpler way to bring up a new model.

The earlier post's patch is still what makes a layer split possible. This one adds three patches to the engine and
a few modules beside it: the tiered layer, the expert server, the row server and the routing trace. For now it lives
in my lab; the numbers above are what it does today.

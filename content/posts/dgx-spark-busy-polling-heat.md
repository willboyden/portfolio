---
# Every number below was measured on my four-GB10 lane on 2026-10-27 (source: my private lab notes).
# Host names, addresses and ports are left out on purpose.
title: "Three spinning threads were overheating my DGX Sparks"
slug: dgx-spark-busy-polling-heat
summary: >-
  Four GB10 boxes serving DeepSeek hit 90 °C within a minute. Two fixes cut
  their heating rate 60%, at 1 or 16 requests, for under 2% speed.
tags: [gb10, dgx-spark, sglang, nccl, arm64, thermals, local-inference]
date: 2026-10-27
series: AI engineering notes
---

I run DeepSeek-V4.1-Flash-1017 as one engine across four GB10 machines (DGX Spark class: a 20-core Arm CPU and a
Blackwell GPU on one package, 128 GB of shared memory). On SGLang, with MiaAI-Lab's
[four-Spark recipe](https://github.com/MiaAI-Lab/DeepSeek-v4.1-Flash-DGX-Sparks), it decoded an agentic coding loop at
88.7 tok/s, against 71–79 for the vLLM setup I had. It also cooked the boxes.

- A single stream took one box's hottest sensor from 56 to 91 °C in 49 seconds. My thermal guard stopped every
  benchmark before it finished.
- Under real traffic, 16 parallel requests from a benchmark harness, the hottest box read 96.7 °C before I took the
  engine down.
- One of these boxes cut its own power four times earlier this month, at 92–94 °C. That is the embedded controller's
  thermal cut: no log, the box just turns off.

The GPU die meanwhile sat at 61–67 °C. Whatever was hot, it was not mainly the GPU.

This post is the hypothesis, the experiments and the numbers. The short version: three CPU threads per box were
spinning at 100%. Two small changes cut how fast a box heats up by about 60%, with one request or with 16 at once,
and cost under 2% of decode speed. Both are now part of the engine's image and configuration.

## The hypothesis

`top -H` on any box during decode showed three threads at 92–100% of a core, all named `sglang::schedul`.
Prometheus told the same story over four days of history, per box and by number of running requests:

| | busy CPU cores | GPU power | hottest sensor, median | hottest sensor, max |
|---|---|---|---|---|
| SGLang, 1–16 requests | 2.2–2.9 | 34–47 W | 81–91 °C | 87–97 °C |
| vLLM, 1–16 requests | 1.1–1.7 | 27–39 W | 60–85 °C | 86–97 °C |

SGLang kept one to one-and-a-half more cores busy, and its boxes ran 5–15 °C hotter at the same load. So the
hypothesis: **busy-polling CPU threads heat the package**, and making them wait without spinning would cool the boxes
without costing speed. Two caveats were visible from the start. vLLM also reached 96–97 °C under heavy load, so the
threads could not be the whole story. And "without costing speed" needed proof: spinning is usually there because
something measured that sleeping was slower.

## First, a wrong guess

The recipe ships its own RDMA transport, a C proxy thread that spins on a doorbell by design. The recipe even raised
its spin count from 200,000 to 20,000,000 polls, with the comment that "sleeping there adds one scheduler wakeup to
every collective". I read that code first and started designing a fix for it.

Then I read my engine's log. It had no RDMA-transport lines at all, and said "CustomAllreduce is disabled because this
process group spans across nodes". My setup never turned that transport on. Every byte between the boxes went
through stock NCCL over InfiniBand verbs. The proxy I had been studying was not running.

Lesson kept: before patching the thing that looks guilty, prove it is running.

## Measuring the parts on an idle box

With the engine down, I ran small tests on one idle box, inside the serving image, 90 seconds each:

| Test | Hottest sensor |
|---|---|
| 2 threads spinning | +9 °C (39.7 → 48.8 °C), most of it within 5 seconds |
| 2 threads spinning, pinned to the efficient cores | +1.9 °C |
| 2 threads spinning, pinned to the fast cores | +10.1 °C |
| 2 threads waiting in WFE | +0.0 °C |

GB10's CPU has ten fast Cortex-X925 cores and ten efficient Cortex-A725 cores. A spin on a fast core makes about five
times the heat of a spin on an efficient one. WFE ("wait for event") is the Arm instruction Linux uses in
`smp_cond_load_acquire`: the core sleeps until the cache line it is watching gets written, or until the 100 µs event
stream ticks.

Two more tests decided what the fixes could be:

- **Does a GPU write wake a WFE wait?** A spinning thread and a WFE thread watched the same word in pinned host
  memory while the GPU wrote 1,000 values into it. The WFE thread woke at the same moment: median −0.14 µs, worst
  +0.05 µs. On GB10 the GPU's store clears the core's exclusive monitor, so the wait costs nothing.
- **What about CUDA's own blocking wait?** `torch.cuda.Event(blocking=True)` (or the context flag
  `CU_CTX_SCHED_BLOCKING_SYNC`) puts the thread to sleep on an interrupt. On GB10 each wait came back about
  **0.5 ms late**: 704 µs a lap against 163 µs for a spinning wait. A decode step waits several times, so that
  would cost 5–15% of the speed. Ruled out.

## Finding the three threads

NCCL names its threads only when asked: `NCCL_SET_THREAD_NAME=1`. With that set, a small script that reads
`/proc/<pid>/task/*/stat` twice, five seconds apart, showed the same picture on all four boxes:

```text
 %CPU  thread           core kind
   99  sglang::schedul     5 X925    <- the scheduler's main thread
   98  NCCL Progress 1    16 X925    <- NCCL network proxy
   90  NCCL Progress 1     9 X925    <- NCCL network proxy
```

That leaves the question of what the main thread spins on. A Python profiler that attaches from outside needs ptrace,
which my containers don't grant. So I sampled from inside instead. A `sitecustomize.py` placed first on `PYTHONPATH`
runs the recipe's own `sitecustomize` and then starts a daemon thread. Fifty times a second it reads
`sys._current_frames()` for the main thread and counts the innermost frames. During decode, about **92% of the main
thread's active time** was in one place: `copy_done.synchronize()`, the CUDA event wait at the end of each step. The
rest of the Python work was a few percent.

So the three threads were two NCCL proxies polling the network, and one scheduler spinning on a CUDA event.

## Fix 1: NCCL's proxies on the efficient cores

NCCL has no setting that makes its proxy poll less. It does have `NCCL_PROXY_CPUSET`, which pins the proxy threads.
One gotcha cost me a test run: NCCL 2.30.7 read the hex mask `7c1f` as "CPU 7" (a fast core), and the range list
`0-4,10-14` as "CPUs 0 and 10". Only the explicit list did what it says:

```bash
NCCL_PROXY_CPUSET=0,1,2,3,4,10,11,12,13,14   # the ten efficient cores; check /proc/<tid>/status
```

To measure the cost, I switched the NCCL threads between "efficient cores only" and "any core" live, with
`sched_setaffinity` inside each container, so both settings shared one boot. Each trial was one 1,200-token request at
temperature 0, so every trial generated the same tokens. Every trial started with all four boxes below 60 °C and
would stop at 85 °C. The settings ran in ABBA order, so a slowly warming room could not favour either one. There were
4 trials per setting:

| NCCL threads on | Decode, median | Hottest box's rise over 14 s | Rate |
|---|---|---|---|
| any core | 86.9 tok/s | +16.3 °C | 1.18 °C/s |
| efficient cores | 85.6 tok/s | +10.2 °C | 0.73 °C/s |

**−1.5% speed, −38% heating rate.** The proxies poll a little more slowly from a smaller core, and the box heats up
much more slowly.

## Fix 2: the scheduler waits in WFE

SGLang's overlap scheduler records a CUDA event, `copy_done`, after each step's results are copied to the CPU. Then
it waits for it. In this recipe, all five of those waits go through one function, which made a single patch point. In
front of the original wait, my version does four things:

1. If the event has already completed, it does nothing.
2. A side stream waits for the event. Then the GPU writes a sequence number into pinned host memory with
   `cuStreamWriteValue32`, a stream memory operation, so no kernel is launched.
3. The CPU thread waits for that word in WFE. After 10 seconds it gives up and falls back to the normal wait.
4. The original `copy_done.synchronize()` runs as before and now returns at once, so CUDA's own completion guarantee
   still holds.

The wait itself is a few lines of C:

```c
// 0 once *word has reached target (the sequence wraps), 1 after the timeout.
int lab_wait_ge(volatile uint32_t *word, uint32_t target, uint64_t timeout_ns) {
    uint64_t deadline = now_ns() + timeout_ns;
    for (uint32_t n = 0;; n++) {
        uint32_t v;
        __asm__ volatile("ldaxr %w0, [%1]" : "=&r"(v) : "r"(word) : "memory");  // arm the monitor
        if ((int32_t)(v - target) >= 0) { __asm__ volatile("clrex"); return 0; }
        if ((n & 63u) == 63u && now_ns() > deadline) { __asm__ volatile("clrex"); return 1; }
        __asm__ volatile("wfe" ::: "memory");   // sleep until the line is written (or the event stream ticks)
    }
}
```

A standalone test checked it against the spinning wait. It ran GPU work from 50 µs to 20 ms, then read back a value
the GPU wrote just before the event. Over 5,650 waits, every value was visible when the wait returned, and there were
no timeouts. The overhead was 3–9 µs per wait, the Python around it. That is once per decode step.

Then the same live A/B as before. This time it flipped the WFE wait on and off with an off-switch file. NCCL's
threads stayed on the efficient cores in both modes:

| Scheduler wait | Decode, median | Hottest box's rise over 14 s | Rate |
|---|---|---|---|
| spinning (SGLang's own) | 84.4 tok/s | +10.3 °C | 0.72 °C/s |
| WFE | 84.3 tok/s | +6.4 °C | 0.45 °C/s |

**−0.2% speed, which is inside the noise between trials, and −38% heating rate.** The wrapper's own counters show
why. The average wait lasted about 58 ms, nearly a whole decode step. The scheduler's thread used to spend that time
spinning on a fast core. Now it sleeps in WFE and wakes within a fraction of a microsecond of the GPU's write. It
never hit its 10-second timeout.

One thing did not change: `top` still shows that thread at about 100%. To the OS, a core waiting in WFE is a running
core. The difference shows only on the thermometer.

## Making it permanent, then 16 requests at once

*Added later the same evening.*

Both changes were trials until then: the WFE wait loaded from a file share at start-up, and the NCCL pinning lived
in a test overlay. I made them part of the engine:

- **The WFE wait is in the image.** A new build step patches SGLang's wait function, the same way the image already
  patches the recipe's launcher. Each text substitution must match exactly once, or the build fails. The step then
  compiles the C file and checks the hook is in place. It is the last step of the Dockerfile, so every earlier
  layer came from the build cache, and the new image differs from the old one by one small layer. The wait stays
  off unless `LAB_WFE_WAIT=1`, so switching it off is a one-line change.
- **The lane's config sets both.** It has `NCCL_PROXY_CPUSET` with the explicit list of efficient cores,
  `NCCL_SET_THREAD_NAME=1` and `LAB_WFE_WAIT=1`.

Then the open question: does any of this matter under heavy load? That is where these boxes actually overheated.
With 16 requests running, the GPU does far more work, so the three threads could have been a rounding error. Same
method, new load. Each trial sent 16 different coding tasks at once, 200 tokens each, at temperature 0. The fixed
lane (both changes on) ran against the stock one (NCCL threads on any core, scheduler spinning). It was the same
boot, in ABBA order, with 4 trials each:

| 16 requests at once | Throughput, all streams | Hottest box's rise over 13 s | Rate |
|---|---|---|---|
| stock | 251.6 tok/s | +15.8 °C | 1.26 °C/s |
| fixed | 248.6 tok/s | +6.4 °C | 0.50 °C/s |

**−1.2% throughput, −60% heating rate.** The gain held under load, almost exactly as it did for a single stream.
The same three threads were busy in both settings; only the cores they ran on, and how they waited, changed. With
bigger batches each decode step takes longer, and the WFE wait averaged about 171 ms per step, again with no
timeouts. The hottest reading over the whole run was 75 °C. Under real traffic, before the fixes, the same boxes
had passed 96 °C.

## What this does and doesn't fix

Together, the two changes take a single stream's heating rate from 1.18 to 0.45 °C/s, about −62%, and 16 requests'
from 1.26 to 0.50 °C/s, −60%. They cost under 2%: −1.5% for the pinning and −0.2% for WFE on a single stream, each
measured within one boot, and −1.2% for both together at 16 requests. The pinned, spinning setting measured 0.73
and 0.72 °C/s on two different boots, which is why I combine the single-stream results. These boxes used to reach
90 °C in under a minute. Now a 13-second burst of 16 answers raises the hottest sensor by about 6 °C.

What it does not tell me yet:

- **Where a sustained load settles.** Every trial lasted 13–14 seconds, from a cool start. The rate is lower, but a
  benchmark harness that keeps 16 requests running for minutes will still warm the boxes toward some steady
  temperature. I have not measured that temperature yet. Until I have, the harness that caused the trouble stays
  capped at a few parallel requests.
- **The vLLM lane.** It also talks over NCCL, so the same pinning should help it. It has not been measured there.

## Method notes

- **Measure heat as a rate, from a fixed start.** Peak temperature depends on where a box started. Every trial began
  below 60 °C, and I compared the rise per second over the same 1,200 tokens.
- **A/B in one boot.** A restart takes 14 minutes and changes the caches. Both knobs here could be flipped live: CPU
  affinity with `sched_setaffinity`, and the WFE wait with an off-switch file the wrapper checks.
- **Name your threads.** `NCCL_SET_THREAD_NAME=1` turned three identical `sglang::schedul` lines into an answer.
- **Test at the load that hurt.** The single-stream result could have vanished at 16 requests. It took one more
  boot and fifteen minutes to find out that it does not.
- **Check the parser.** The CPU-set variable accepted two formats silently and did something else with both.
  Read back `Cpus_allowed_list` after setting any affinity.
- **The standard fix can be the wrong one.** Blocking sync is the textbook answer to a spinning CUDA wait. On this
  hardware it costs half a millisecond per wait. WFE is an Arm answer and fits this package better.

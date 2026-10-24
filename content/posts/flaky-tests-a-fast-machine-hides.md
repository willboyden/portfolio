---
title: "Four flaky tests a fast machine hid, and how I built a slow one"
slug: flaky-tests-a-fast-machine-hides
summary: >-
  The first CI runs of a new repository failed tests that had passed every
  time on my workstation. Each rested on an assumption that only held there:
  an exec race in /proc, a token bucket that refilled, a fetch the test did not
  wait for, and an order that came from file times.
tags: [testing, rust, quality-gates, developer-tools]
date: 2026-10-24
series: Harness² Workbench
relatedProject: harness2-workbench
relatedPosts: [building-harness2-workbench, taking-a-repository-public]
---

[Harness² Workbench](/writing/building-harness2-workbench) has 641 unit and
integration tests and seven end-to-end tests. Every one of them passed, many
times over, on the 32-core workstation where it was built, including from a
fresh clone. Then the repository got its first CI runs on GitHub's shared
runners, which have two cores for a private repository, and the tests started
failing: one per run, a different one each time, never the same one twice in a
row.

A test that fails once is a bug until proven otherwise. Each of the four
rested on an assumption that held only on a fast machine with stable file
times, and one of them was hiding in production code. This
post is how I found them, how I made my machine slow enough to fail the same
way, and how I proved the fixes.

## Making a fast machine slow

A shared runner is slow in two ways: few cores, and other work competing for
them. Both are easy to reproduce on Linux:

```sh
# Two busy loops pinned to cores 2 and 3 ...
for c in 2 3; do taskset -c $c sh -c 'while :; do :; done' & done
# ... and the test binary pinned to the same two cores, run fifty times.
for i in $(seq 50); do taskset -c 2,3 ./target/debug/deps/<test-binary> --test-threads 8; done
```

Where two cores were not slow enough, one core with four busy loops was. The
other half of the method was **negative controls**: a fix counts only if the
old code fails under the same conditions and the new code passes. The first two
fixes below have both numbers.

## 1. The exec race in /proc

The Workbench stops a crashed job's processes on restart only after
identifying them: every step carries an `H2W_JOB_ID` marker in its environment,
and the server reads `/proc/<pid>/environ` to find it. The test started
`sh -c "sleep 30 & exit 0"` with the marker set, waited until every process
in the group was named `sleep`, and asserted that each one carried the marker.
On the first CI run it did not.

The reason is in the kernel's exec path. A process gets its new name early in
`exec`, before the kernel has filled in the new program's environment
pointers, and in between, `/proc/<pid>/environ` reads as empty. I measured it
with a small script that spawns `sleep` and polls `/proc` at once: 260 of 500
spawns showed the name `sleep` with an empty environment, and it filled in
after 0.018 ms at the median and 0.139 ms at worst. On a fast machine the
test's first poll almost never landed there. On a two-core runner it did.

![What /proc/PID/environ returns during one exec: the parent's environment right after a vfork-style spawn, then permission denied for a child of a non-dumpable process, then empty while the new name is already set, and only then the marker](/posts/harness2-workbench/exec-windows.svg)

This was not only a test bug. Restart recovery read each process once, and an
empty read meant "unmarked", so a job process caught mid-exec at the wrong
moment would be left running. It fails safe (nothing unidentified is ever
signalled), but it fails. The fix makes an empty read mean "look again": up to
nine reads, with pauses doubling from 1 ms, about a quarter of a second in
all, asynchronous so the server's runtime never blocks.

The first version of that fix was not enough, and the slow machine is what
showed it. A new test catches processes mid-exec on purpose. Rust's
`Command::spawn` returns while the child is still inside `exec`, so checking
right after `spawn` lands in the window almost every time. Under load it still failed
about one run in twenty. Two more windows explained it:

- **Permission denied.** A child of a non-dumpable process inherits that flag
  until its `exec` marks it dumpable, and until then reading its environment
  fails with `EACCES`. The Workbench server is non-dumpable by design (it keeps
  same-user processes out of its own environment), and so is the test process
  once another test has exercised that code. From a small C program that marks
  itself non-dumpable and calls `posix_spawn`, 5 of 2,000 immediate reads were
  denied. Denied now also means "look again".
- **The parent's environment.** A vfork-style spawn wakes the parent before
  the child's address space is switched, so a read at that instant can return
  the *parent's* environment, which in the test has no marker. I never caught
  this directly; it is the explanation that fits the failures that remained,
  and it matches the kernel source. In production it is harmless, because the
  parent of a job process is itself a marked job process. The test now waits
  for the new name before it checks.

With a single read, the new test fails on its first iteration, five runs out
of five. With the fix, the `/proc` tests passed 100 runs out of 100 and the
whole server unit suite 30 out of 30, all on two loaded cores.

## 2. The token bucket that refilled

The authentication tests send 500 requests with junk tokens and expect exactly
60 `401` answers (the per-client limit) followed by 440 `429`s. On CI the
count came back as `{401: 61, 429: 439}`.

The limiter is a token bucket, and a token bucket refills continuously. Sixty
a minute is one a second, so any run that takes longer than a second earns
an extra attempt. On one core with four busy loops the old test failed eight
runs out of eight with exactly the CI numbers.

The fix is not to widen the assertion by a magic number. A helper computes
what the limiter can have handed back over the measured run:

```rust
/// What a limiter of `per_minute` hands back over `elapsed`, rounded up.
fn refilled(per_minute: u32, elapsed: Duration) -> u32 {
    let ms = u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX);
    u32::try_from(u64::from(per_minute).saturating_mul(ms) / 60_000 + 1).unwrap_or(u32::MAX)
}
```

and the test accepts anything from the quota up to the quota plus that refill.
Every downstream number (the 429 count, the metrics, the audit rows) now
derives from the measured count instead of the constant. Four tests counted
quotas this way; all four were changed, and the new file passed eight runs out
of eight under the same load.

## 3. The browser test that read too soon

The end-to-end suite drives the real UI in headless Firefox. On one CI run it
opened a finished job, waited for the log element to appear, read its text
and did not find the line it expected. The element renders as soon as the job record
arrives; the log lines are fetched after that. Locally the fetch always won.

Waiting for an element is not waiting for its content. A small helper now
polls until the element contains the expected text, for up to 20 seconds, and
puts the last text it saw in the failure message. Two other reads had the same
shape: the experience-library view, and a diff that relied on a fixed 500 ms
sleep. Both use the helper now, and the sleep is gone.

## 4. The order that came from file times

The last one was not about speed at all. A test copied a fixture experiment
twice and compared the two experiments' sweep lists, in order. Sweeps are
listed newest first, by the times of their files, and each copy got its own
file times. On CI the two copies listed two sweeps in opposite orders. The
test is about *which* sweeps are listed (one unreadable sweep must not hide the
others), so it now compares them as sets.

## Finding the rest before CI did

After the fourth fix I stopped waiting for CI to find the next one. I ran the
whole workspace suite five times on starved CPUs: three runs on two cores with
two busy loops, two on one core with two busy loops. All passed, and CI has
been green since.

What I took from it:

- **Fast hardware hides timing assumptions.** Every one of these passed every
  time locally. A shared runner is not a worse environment; it
  is a more honest one.
- **A test that fails once has found something.** Three of the four were test
  bugs, each asserting something stricter than the system promises. The exec
  race was also a production bug that failed safe: it could leave a process
  running, but never signal the wrong one.
- **Build the slow machine yourself.** `taskset` and a busy loop reproduce a
  two-core runner in seconds, and then the failure is yours to debug.
- **Wait for conditions, not for time,** and derive tolerances from what
  you measured, not from a constant that happened to pass.
- **Prove a fix with a negative control.** "It passes now" proves nothing
  about a race. "The old code fails 8 of 8 here and the new code passes 8 of 8"
  does.

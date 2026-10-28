---
title: "Rewriting three Python services in Rust without breaking them"
slug: rewriting-three-python-services-in-rust
summary: >-
  Nemo Console, Agent Hub and Engine Console are now Rust: 56,000 lines of
  FastAPI and Python agent code replaced as a drop-in, with every one of 4,508
  Python tests mapped to a Rust test or a written reason, and both
  implementations run side by side on the same requests until they agreed. The port also found three security
  bugs and a data-loss bug in the Python code.
tags: [rust, python, testing, security, open-source]
date: 2026-10-28
relatedPosts: [building-nemo-console, building-agent-hub, building-engine-console]
---

[Nemo Console](https://github.com/willboyden/nemo-console),
[Agent Hub](https://github.com/willboyden/agent-hub) and
[Engine Console](https://github.com/willboyden/engine-console) are three local
control planes I run every day. All three started as FastAPI backends with a
zero-build browser UI. As of this week all three backends are Rust: Nemo Console
0.4.0, Agent Hub 0.3.0 and Engine Console 0.5.0: about 56,000 lines of Python
source, counting Engine Console's node agent and Agent Hub's search service.

The reasons were practical. Engine Console's node agent runs on six machines,
and a single static binary is easier to put on a DGX Spark than a Python
environment. The consoles sit idle most of the day, so start-up time and resident
memory matter more than peak throughput. And the security bar these tools need
(loopback services that start containers, edit config files and hold keys) is
easier to hold with a compiler that refuses `unsafe` and `unwrap`.

The constraint was the hard part: **nothing may break.** Same API, same status
codes and error bodies, same settings and file formats, the user's existing
database and keys loaded as they are, the same bytes written into other tools'
config files, and for Engine Console the same wire protocol, because a Rust hub
has to keep driving the Python nodes already installed on remote machines. This
post is about how that was checked, and what the checking found.

## A contract before any Rust

For each app the first step wrote no feature code. It produced:

- **The route table, dumped from the running Python app**, with roles, request
  bodies and response shapes.
- **A porting contract** listing every setting, persisted file format, metric
  name, subprocess argument list and security control, each control with the
  Python line it came from and the Rust test that would fail without it.
- **A Rust skeleton** with every route already registered. Routes not yet ported
  answered `501 not_ported`, so a missing route could never look like a working
  one.
- **A test map**: one row for every pytest id, 4,508 across the three apps,
  each to be filled with the Rust test that covers it, or "N/A" with a reason.
  A row counts as mapped only if it names a real `#[test]` function; a checker
  enforces that.

The work was then split into workstreams with disjoint file ownership, each in
its own git worktree and branch, and merged with `git merge` as each one
finished. A test that needed another workstream's code was marked
`#[ignore = "pending WS-X"]`. The final gate failed on any such marker, so none
could be forgotten.

## The referee: run both, compare everything

Unit tests prove what their author thought of. A port also has to match what
nobody wrote a test for, so each app got a **differential harness**: a
zero-dependency Node script that starts the Python server and the Rust server
one after the other in the same hermetic layout (temp home directory, state
seeded by the Python code, fake upstream services, fake command-line tools on
`PATH`), sends both the same requests and compares status codes, chosen headers,
normalised JSON, and the files each side wrote to disk.

Two rules made it trustworthy:

1. **Python against Python first.** The harness must report zero differences
   when both sides are Python. That proves the normalisation rules (timestamps,
   generated ids) hide only genuine noise.
2. **Every difference is either fixed or written down.** The allow-list of
   accepted differences shrank to almost nothing, and the entries that remain
   still compare the status and body; only a named header may differ.

| App | Harness cases | Result against the last Python code |
|---|---|---|
| Nemo Console | 1,393 HTTP cases, plus start-up errors and launcher checks | 1,392 equal, 1 documented deviation |
| Agent Hub | 431 hub cases, 114 knowledge-service cases | 0 differences (a few allowed for extra security headers, and for the adapter added in Rust) |
| Engine Console | 674 HTTP steps in three modes, 875 wire-protocol vectors | 0 differences (9 allowed for extra security headers) |

Some properties need more than an HTTP comparison, so each app also got
cross-implementation checks:

- each implementation opens the database and files the other one wrote;
- for Nemo Console, either launcher's `stop` stops a console the other one
  started, and 26 kinds of bad setting give the same exit code and message;
- for Engine Console, the hub-node protocol in all four combinations against
  recorded transcripts: Python hub with Rust node, Rust hub with Python node,
  and both pure pairs.

Every app's existing browser suite, a headless Chrome visiting every page and
tab, was pointed at the Rust backend too.

## "Exactly like Python" is a long list

Most of the effort went into behaviour nobody thinks of as a feature until it
changes:

- **Floats.** Python's `repr` rounds exact ties to even; Rust's formatter rounded
  them up, so 17 of 9,018 golden values were wrong until the core was fixed. The
  same bug sat in the JSON and validation-error output.
- **YAML.** Agent Hub writes other tools' config files, so its YAML had to be
  byte-identical to PyYAML 6.0.3: YAML 1.1 booleans (`yes`, `on`), the
  emitter's quoting and line folding, the exact error messages. The answer was a
  port of PyYAML's pure-Python loader and dumper, about 6,800 lines, checked
  against a corpus captured from the Python test suite itself and 630,000
  comparisons with a live Python oracle on random documents. It is also 25 to 50 times faster than
  PyYAML on large inputs.
- **TOML.** The usual Rust crate parses TOML 1.1; Python's `tomllib` parses 1.0
  and rejects what 1.1 allows. That meant a port of CPython's parser too.
- **Validation errors.** FastAPI's 422 bodies come from pydantic's lax coercion
  rules: which floats count as booleans, how a dictionary key's location is
  printed. Golden cases generated by pydantic itself pin them.
- **The rest:** `difflib`'s matcher with its auto-junk heuristic for plan diffs,
  `fnmatch`, `shlex`, `str.isprintable` with Unicode 15.1 tables, `int()`
  accepting non-ASCII digits, Starlette's Range and ETag handling,
  `prometheus_client`'s text format, and uvicorn's habit of running start-up
  work before binding the port.

All of it lives in compatibility layers of roughly 8,000 to 11,000 lines per
app, which is the main reason the Rust source is about three times the size of
the Python it replaced. Golden files are generated by the Python code, and the
generators are committed so the goldens can be rebuilt.

## What the port found in the Python code

A second implementation that must agree byte for byte reads the first one more
closely than any review. The bugs it found:

- **Three security bugs in Agent Hub 0.2.0**, published as
  [GHSA-7j23-gq83-5j4w](https://github.com/willboyden/agent-hub/security/advisories/GHSA-7j23-gq83-5j4w):
  - the content-migration step followed symbolic links in git metadata, so a
    planted link could make it delete or overwrite files elsewhere (high);
  - a symlinked `.git/config` was read and quoted in an error message (medium);
  - the inbox listing accepted a path as its client filter (medium).
- **A data-loss bug in Nemo Console's Data Designer page**: once a run's records
  file reached 2,000 lines, later batches silently dropped out of the user's
  csv, jsonl and json copies. Rust keeps Python's behaviour until both are fixed
  together, because a port is not the place to change outputs quietly.
- **A hang.** In Agent Hub, a named pipe swapped in at an apply target hung the
  apply while it held the hub's lock.
- **A clock bug.** Nemo Console built run ids from two clock readings, which
  could sort a new run before an older one at a second boundary.
- **Engine Console's node** kept probing engine ports after refusing an invalid
  policy file, and a policy could make a writable model root overlap the node's
  own configuration. Both are fixed in the Rust node.

The rule was simple: keep Python's behaviour, record every bug, and break
parity only for security.

## Tests that reached things they should not

The most uncomfortable findings were about the tests, old and new:

- **Two of the existing browser suites were not hermetic.** One sent read-only
  requests to my live router and routing services on every run. The other read
  my real GPUs. Both now run against fakes by default, check that before the
  first page, and need an explicit opt-in to touch anything live.
- **A unit test leaked a key.** A ported test copied a default URL that in
  Python was intercepted by a mocking library. In Rust nothing intercepted it,
  and the test sent my shell's router key to my own local routing service.
  Since then, every test default points at a closed port and children get a
  scrubbed environment.
- **A test passed for the wrong reason.** Under my umask, a test's policy file
  came out group-writable. The node correctly refused it, fell back to a default
  policy that probes engine ports, and the test still passed because it only
  checked the mode it reported. Tests now assert that the policy actually loaded.
- **The proof** is the whole test suite run under `strace -e trace=connect`:
  every connection goes to an ephemeral loopback port. The first CI run on
  GitHub then caught one more environment leak: a file-mode assertion recorded
  under my umask, which the runner does not share.

## Independent audits

Each port then got an independent review that started with no context: it read
the code, not the porting notes or anyone's summary of them. All three came back "ship with
fixes", none critical. The same classes appeared in all three, and they are what
a Python-to-Rust port loses by default:

- **Limits uvicorn had and a bare Rust server lacks:** an idle keep-alive
  timeout, a header deadline, a connection cap, and a truncated body treated as
  an error instead of a shorter body.
- **Background loops.** Python wrapped each poller tick in `try/except`; in Rust
  a panic silently ends the task. The fix catches each tick, redacts the panic
  message and recovers poisoned locks.
- **Role checks** done by hand in each handler, with a test that only read the
  route table. Roles are now enforced by the request pipeline, and a test calls
  every route as a viewer and without a key.
- **File and process hygiene:** readers that would block on a named pipe, child
  output buffered without a cap, an interpreter found on `PATH` (where a
  user-writable directory comes first), and build paths baked into release
  binaries.

## The numbers

Measured on the same machine, same hermetic setup, release builds, 2,000
sequential requests per route, three interleaved passes (medians):

| | Python | Rust |
|---|---|---|
| Cold start to first 200, Nemo / Agent Hub / Engine Console | 241 / 264 / 272 ms | 12 / 12 / 9 ms |
| Knowledge service cold start (LanceDB) | 659 ms | 11 ms |
| Resident memory at idle, the three consoles | 61–64 MB | 15–18 MB |
| Knowledge service memory at idle | 153 MB | 22 MB |
| Nemo `/overview` p50 | 4.5 ms | 0.66 ms |
| Agent Hub `/doctor` p50 | 2.0 ms | 0.32 ms |
| Engine Console `/engines` p50 | 0.34 ms | 0.15 ms |
| Engine Console node agent on a remote machine | a Python 3.10+ environment | one 4.7 MB binary |

Two routes got slower: Agent Hub's health check, which spawns `git` on every
call and costs more child CPU from Rust, and Engine Console's 580 KB `/learn`
document. Neither was profiled yet. Latency under concurrency was not measured,
and on the smallest routes the Rust numbers sit at the measuring client's own
floor.

## Where it stands

- **Nemo Console 0.4.0** is deployed. With the Rust backend, the browser suite
  was run once against the real systems (router, routing layer, Dynamo, GPU
  telemetry, Prometheus, guardrails): all 46 pages and tabs rendered with no
  error.
- **Agent Hub 0.3.0** runs on my real content repository, with a DeepSeek
  Harness adapter added along the way.
- **Engine Console 0.5.0** is released with x86_64 and arm64 node binaries. It
  has passed every comparison against the Python code, but it has not yet run
  real GPU launches, remote machines or arm64 hardware. Remote machines can move
  one at a time, since either hub speaks to either node.

Each repository keeps its porting record (`backend/PORTING.md`): the decisions,
every deliberate difference from Python with its reason, and the Python bugs
found. The last Python commit stays the reference the parity harness runs
against, so any later change can still be compared with the original behaviour.

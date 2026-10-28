---
title: "Building Engine Console: one page for five inference engines, on one machine or several"
slug: building-engine-console
summary: >-
  Engine Console runs vLLM, SGLang, TensorRT-LLM, llama.cpp and Ollama from one
  page. How it grew from a single-workstation control plane into a small
  fleet manager: sandboxed engines behind a loopback gateway, an agent on every
  machine, a policy file as the hard boundary, and the security findings that
  shaped each step.
tags: [llm-inference, vllm, sglang, gpu, security, fastapi, open-source]
date: 2026-10-26
relatedProject: engine-console
relatedPosts: [building-nemo-console, building-agent-hub]
---

> **Update, 2026-10-28:** since 0.5.0 the hub and the `ecnode` node agent are Rust, a drop-in for the Python version described here, with the same wire protocol. How that was checked: [Rewriting three Python services in Rust without breaking them](/writing/rewriting-three-python-services-in-rust).

Serving models locally means living with several inference engines. vLLM,
SGLang, TensorRT-LLM, llama.cpp and Ollama each have their own flags, images,
metrics endpoints and failure modes, and the question I kept asking was simple:
what is running where, how much GPU and host memory does each engine really
hold, and will this next model fit?

[Engine Console](https://github.com/willboyden/engine-console) is my answer:
an open-source control plane and monitoring UI for those five engines. It
started in late September as a console for vLLM and SGLang on one workstation.
Version 0.4.0, "the fleet", manages engines and models on several GPU
machines through a small agent on each one. This post is how it is built and
what each stage taught me.

![The Engine Console dashboard: every machine with its GPUs, the VRAM each engine holds, utilisation, temperature, power, host RAM and drives. Rendered from the repository's mock server, so the machines and numbers are a canned demo](/posts/engine-console/dashboard.png)

## The first version: one workstation, one rule

The first version was a FastAPI process bound to `127.0.0.1`, a hexagonal core
with one `EngineAdapter` port, SQLite in WAL mode for state, server-sent events
for live logs and metrics, and a frontend with no build step and no npm
dependencies. Launch forms are generated from each adapter's parameter catalog,
so adding a setting to an engine is a data change, not a UI change. It already
covered Hugging Face search and resumable downloads, a VRAM fit estimate,
instance logs, metrics, a load-test benchmark, chat, a side-by-side arena and
token usage.

The rule from day one: a console that can start containers is a target, even
on loopback. Two independent reviews of the early versions turned that rule
into the checklist I now apply to every local admin service:

- Loopback is not a trust boundary for a browser, because any web page can call
  `127.0.0.1`. So: a `Host` allowlist against DNS rebinding, an `Origin` check
  and a custom header on every state-changing request, and no CORS at all.
- Role checks on every router, with a test that enumerates the routes from the
  OpenAPI document so a new route cannot skip them.
- A strict Content-Security-Policy on every response, errors included, and no
  Swagger page, because FastAPI's default docs load JavaScript from a CDN onto
  the admin origin.
- Docker driven through argument lists, never a shell, and every identifier
  checked with a full match (a regex ending in `$` still accepts a trailing
  newline).
- Every string a download server sends treated as untrusted: hashes, commit ids
  and relative paths are validated, and paths are resolved and contained before
  anything is written.
- Secrets passed by environment-variable name and shown as `[set]`, never as a
  value in an argument list, an API response or the audit log.

## Engines in a box with one door

Engines run as sibling containers on an internal Docker network: no published
ports, every capability dropped, `no-new-privileges` and a process limit. They
run with `HF_HUB_OFFLINE=1`, read their model cache mounted read-only and never
receive a Hugging Face token. The console's own traffic to Hugging Face goes
through an allowlisting proxy and fails closed.

On rootless Docker that raises a problem: an internal network cannot publish a
port, and container addresses are not routable from the host, so the console
cannot reach its own engines. The answer is a per-instance gateway: a tiny,
read-only nginx container that forwards TCP from one `127.0.0.1` port to one
engine. A TCP stream does no buffering, so streamed tokens just work.

Two of the bugs here only real Docker could show. nginx without `daemon off;`
forks away from PID 1, so the gateway container exited cleanly with empty logs
while every mocked test passed. And the default bridge network's DNS did not
work on this host, so anything that resolves names goes on a user-defined
network. Isolation is proven with a stand-in engine: the gateway answers on
loopback, the engine cannot reach `huggingface.co`, and `docker port` on the
engine is empty.

## Memory you can actually see

Version 0.3.0 added host RAM per engine, and the first measurement showed why
it was worth doing. An SGLang engine held 68.6 GiB of host memory, 64 GiB of it
shared memory, while its main process's resident size looked small. Resident
size misses weights and caches staged in shared memory, so the console reads
the container's cgroup instead and splits it into anonymous memory, page cache,
shared memory and kernel memory. Shared memory cannot be reclaimed, so it gets
its own alert, and the fit estimate checks host RAM as well as VRAM.

## From one machine to a fleet

Version 0.4.0 changed the architecture rather than adding a feature. Every
machine, the hub's own included, is now a host reached through a node:
`ecnode`, a small agent written against the Python standard library alone. The
node does all the Docker, GPU and file work on its machine. The hub reaches
other machines over ssh with its own key, and each machine restricts that key
to the node command and to the hub's address
(`restrict,from=...,command=...`). ssh runs with no config file, batch mode,
strict host-key checking against a read-only `known_hosts`, no agent and no
forwarding.

The hard boundary is a policy file on each machine. It says whether the
console may only watch that machine or also manage it, which engine images may
run, which model folders exist and which are writable, the port range, the
operator's own scripts, and switches for image pulls, deletes and stopping
engines the console did not create. No policy file, or one the node refuses,
means monitor mode. Installed as a root-owned file, it binds the hub too: a bug
or compromise in the hub can do at most what each machine's policy allows.

Engines come in three classes. **Managed** engines are the console's own.
**Script** engines are started by the operator's scripts, registered in the
policy, so the console runs those scripts and never bypasses an ordering rule
it does not know about. **External** engines are everything else, discovered
and shown read-only. On top of that sits a model library across machines:
Hugging Face caches, GGUF files, Ollama stores and plain checkpoint folders, per
machine and per drive. A machine that mounts another machine's disk over NFS
shares that copy instead of listing it twice, a machine that is down shows its
last-known library marked stale, and downloads and copies between machines are
resumable and size- or hash-checked.

## What building the fleet found

Several findings came from building it, not from a review:

- **ssh fell back to my default keys.** With `-i <file>` and the file missing,
  ssh only warns and then offers the user's default identities, even with
  `IdentitiesOnly=yes`. The hub would have logged in with an unrestricted key
  and skipped the forced command. It now refuses to build the command while its
  key is missing and passes the key in a form that fails closed.
- **A shared cache made every model look in use.** Engines mount a whole cache
  folder, so the first in-use rule refused to delete a freshly downloaded test
  model because two unrelated engines mounted the same cache. The rule now
  reads each engine's parsed model arguments, and an engine whose command cannot
  be parsed still counts as using everything it mounts, so a delete is refused
  rather than pulled from under a running engine.
- **llama.cpp answered any web page.** Its default CORS setting echoed any
  origin, so a page open in the operator's browser could read answers from the
  loopback port. The adapter now passes `--cors-origins localhost`.
- **Container environments stay on the machine.** The node reports names,
  images, commands, labels, ports and mounts, but never an environment value,
  and a test plants a marker value that must never appear in anything reported.

An independent review of the 0.4.0 tree then found three high-severity problems
in the node's file and mount handling: a symlink that could reach outside a
model root through another link, a delete that could be redirected outside the
root during its in-use check, and read-write mounts that let a container plant
links. All three were fixed with regression tests that reproduce the attack,
every model mount is now read-only, and a second review of the fixes found no
high or medium issue. One medium item, provenance for copies between machines,
is still open and listed in the security document.

## Fit estimates that admit what they do not know

The fit estimate answers "will this model fit here?" and says "unknown" rather
than guess when a term is missing. Each engine sizes its memory differently, so
the rules were read from the pinned images' source. vLLM must find its whole
`gpu_memory_utilization` share free at start, plus about 2.5 GiB I measured on
top of it. SGLang's `mem_fraction_static` is a share of the memory free at
launch, so an engine already on the card shrinks it, and the estimate names the
engine you would have to stop. Machines whose GPU shares system RAM get a
unified-memory budget. Apart from that one vLLM measurement, the estimates are
not calibrated, and the documentation says so.

## Learn mode

Every parameter, preset, metric, state and launch check has a plain-language
explanation, stored as data next to the code, and a test fails the build when
one is missing. The UI shows them as info buttons, in a beginner wizard and in a
glossary, because the people who most need to know what `max_num_seqs` does are
the ones least likely to read the engine's source.

## What is proven, and what is not

Verified live on my two-GPU workstation with rootless Docker, mostly in monitor
mode plus one managed test I approved: host facts and per-process VRAM
attributed to containers, discovery of running engines, a library scan of 8
roots holding 32 models and about 3 TB, a real Hugging Face download through
the allowlisting proxy, and a managed vLLM launch under the full sandbox, ready
in about a minute, with chat through the node, stop, remove and a library
delete. On five more machines (four aarch64 GB10 systems and one x86_64 machine
with an RTX 5090), the node was installed and the hub's restricted ssh links all
came up, in monitor mode.

Covered by tests with fakes only: managed work on a remote machine, copies
between real machines, script actions, multi-GPU launches, and launches of
TensorRT-LLM, llama.cpp, Ollama and SGLang, whose catalogs were checked against
the pinned images' `--help`. Not done yet: the frontend against the real backend,
which is still being finished. Those remote machines run rootful Docker, where
anyone in the `docker` group is root-equivalent; that is the first residual risk
in the security document.

The test suites run offline: 2,095 backend tests, 390 for the node on Python
3.12 to 3.14, and 244 for the frontend. Twenty-one architecture decision
records explain the choices, and the security document has a STRIDE table,
every finding fixed and the residual risks in plain words.

The same patterns, a loopback admin service with no trusted loopback, an argv-only
runner and a zero-build frontend, carried over to
[Nemo Console](/writing/building-nemo-console) and
[Agent Hub](/writing/building-agent-hub).

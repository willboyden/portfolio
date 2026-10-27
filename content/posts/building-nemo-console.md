---
title: "Building Nemo Console: one page for ten NVIDIA AI systems"
slug: building-nemo-console
summary: >-
  Nemo Console went from three NVIDIA systems to ten in a month. How it is put
  together: a locked adapter port, config edits that roll themselves back, a
  localhost security baseline, and the bugs that only daily use, a fresh clone
  and a real browser found.
tags: [observability, security, fastapi, llm-routing, testing, open-source]
date: 2026-10-26
relatedProject: nemo-console
relatedPosts: [routing-coding-agent-two-local-models, taking-a-repository-public]
---

My lab runs a small stack of NVIDIA software around its models. NeMo
Switchyard routes requests between a fast model and a large one, NeMo Relay is
the gateway my coding agents talk to, and Dynamo serves a model when I want it.
Each one has its own CLI, its own config file, its own logs and its own way
of failing. A typo in Switchyard's `routes.toml` breaks routing for every client
that uses it, and finding out why meant three terminals and a guess.

I wanted one page that answers three questions: is everything up, can I change
a setting without breaking the stack, and does a real request get through? That
page became [Nemo Console](https://github.com/willboyden/nemo-console), an
open-source (MIT), single-user web console. It started with those three systems
and now covers ten: Switchyard, Relay, Dynamo, DCGM GPU telemetry, AIPerf,
NeMo Guardrails, OpenShell, SkillEvaluator, NeMo Evaluator and Data Designer.
It is an independent project, not affiliated with NVIDIA. This post is about
how it is built and what building it taught me.

![The Overview page: a topology graph from the agent clients through NeMo Relay, Switchyard and the LiteLLM router to the engines, and a status card per system with its problems and the fix for each. Rendered from the repository's mock server, so the data is a canned demo](/posts/nemo-console/overview.png)

## Contract first

Before any code, I wrote `docs/ARCHITECTURE.md`: a table of decisions, the
directory layout with one owner for every path, the HTTP API, the canonical
metric names and the quality bar. The most important file in the repository is
the `SystemAdapter` port, the interface every system implements. It was
written first and marked locked. Every later change to the contract has been
additive, appended as a numbered addendum (the last five systems of 0.3.0
are addendum 9.8), so nothing that already worked had to change shape.

The decisions themselves are fifteen architecture decision records, each with
the alternatives I rejected. The frontend got its own mock server on day one,
so the UI never waited for the backend. That mock server still ships, and it
renders the screenshot above.

## One adapter per system

The core knows nothing about Switchyard or Dynamo. An adapter describes its
system: status and problems, metrics, config files, parameters, actions with a
danger level, and an optional playground. The UI renders all of it from those
descriptors. SkillEvaluator arrived in 0.2.0 as one new adapter file. In 0.3.0
six more came the same way: Data Designer, OpenShell, DCGM, AIPerf, NeMo
Guardrails and NeMo Evaluator. The last five share one generic page that
renders whatever their adapter describes, and the navigation is grouped into
routing, engines and load, safety and sandboxing, and evaluation and data.

Not everything is a service. SkillEvaluator and Data Designer are command-line
tools, so the console runs them on demand, one run at a time, and keeps their
reports. Every problem a system reports carries one copy-pasteable fix, because
"Switchyard is degraded" is only useful if the next line says what to run.

## Changing config without breaking the stack

The console's most valuable feature is also its most dangerous: it edits the
config files that live systems read. Two decisions keep that safe.

The core, not the adapters, owns every file write. An apply is always the same
sequence: validate, show the diff, confirm, back up, write atomically, restart
or recreate the system, health-check it and **roll back automatically** if it
comes up unhealthy. Edits use a SHA-256 compare-and-swap, so an edit made
against a file that changed underneath it gets a 409 instead of overwriting
someone else's change. Every revision is kept, and a manual rollback re-runs
the validator and the secret scan on the old revision before writing it.

Validators also say how much they know. Switchyard's validator runs the real
server in dry-run mode, in a throwaway container with no network and a
read-only filesystem, so it is marked authoritative. Relay's is only a parse
plus a semantic pass, so it is marked `authoritative=false`, the UI says so,
and the real test is the restart that the apply flow already guards with a
rollback. A validator that cannot be sure should not look sure.

Some files are not the console's to change. Relay's plugin and signature
policy and OpenShell's trust files are shown read-only. NeMo Guardrails rails
configs are editable, but a change that removes a rail is refused unless it
carries an explicit marker, so weakening a safety rail is always a deliberate
act.

## A localhost service is still an attack surface

The console starts and stops containers and restarts systemd units, so
compromising it is roughly equivalent to compromising the Docker user it runs
as. It runs as a normal host process rather than in a container, because it
has to drive the operator's own rootless Docker and systemd user manager. It
listens on loopback only, but loopback alone is not a defence:

- a `Host` allowlist (against DNS rebinding), an `Origin` check and a custom
  header on every state-changing request (against cross-site requests);
- bearer keys stored only as SHA-256 hashes, with admin and viewer roles;
- loopback trust **off** by default. With it on, any local process, including
  a prompt-injected agent with a shell, would be an admin without a key;
- a strict Content-Security-Policy and a frontend with no build step and no npm
  dependencies;
- all process control through one argv-only command runner with an allowlist of
  bare binary names, never a shell;
- secrets referenced by environment-variable name, never stored or returned,
  and playground chats streamed but never persisted;
- an append-only audit log of every mutating call.

Two independent security reviews ran before the first public release, and
their findings changed defaults. Loopback trust started out on; it ships off.
Later reviews kept paying for themselves. A review of the sandbox runner behind
Data Designer found that its network still had internet egress, and that
copying results back trusted file paths chosen inside the sandbox. Both were
fixed the same day.

## Going public

Version 0.1.0 was an internal build on 24 September. The public repository
starts at 0.1.1, four days later, from a fresh history. The test fixtures were
captured from my workstation, so they were sanitised first: home directories,
host paths, GPU UUIDs, MAC and LAN addresses became neutral placeholders, and
the parsers are still tested on the same structure. CI runs ruff, mypy in
strict mode, pytest and the frontend tests, with every GitHub Action pinned to
a commit, and vulnerabilities are reported privately through GitHub. The
checklist I now run before a repository goes public is in
[Taking a repository public](/writing/taking-a-repository-public).

## What daily use found

The best bug reports came from leaving the console open on my own stack:

- **A health check that flooded my tracing.** Relay's liveness probe polled the
  gateway's model list every two seconds without a key. Each poll was a 401
  that the router logged to Langfuse as an error trace: about 43,000 a day, 98%
  of all traces. The probes now use health endpoints that leave no trace.
- **A stack the console did not fully know.** Dynamo was running from two
  compose files, and the console knew only the base one, so its restart would
  have replaced the running stack with a different one. It now reads the exact
  files from the containers' compose labels, treats them as untrusted input,
  and refuses to act if they do not check out.
- **A crash loop that looked healthy.** Docker reports a container as running
  during its restart back-off. "Restarting" now wins, so a crash loop shows as
  a failed worker.
- **Off is not down.** Dynamo is off on purpose most of the time, yet it kept
  the whole page red. Health gained an `off` value, drawn as a neutral badge,
  never red.
- **A counter that only counted successes.** Switchyard's stats count
  successful calls, so a tier that had never succeeded never tripped the error
  check. It now compares errors with successes.
- **A stop that waited forever.** `nemo-console stop` could not stop a console
  with a browser open, because a live event stream never closes on its own.
  Shutdown now ends every stream with a final event, and the UI reconnects.
- **Caches that looked fresh after a reboot.** Three caches were stamped with
  0.0 and compared with a monotonic clock that counts from boot, so on a machine
  up for less than the cache lifetime, the empty value looked fresh. CI caught
  it on a freshly booted runner.

## The browser bug that became a ship gate

The day 0.3.0 shipped, the five new pages showed "Something went wrong" in my
own browser. Every unit and API test was green. The cause was caching: the
frontend's files were served without a `Cache-Control` header, so a browser
that had used 0.2 kept the old JavaScript modules and paired them with the new
pages. One import failed with "does not provide an export named 'fmtUnit'",
and only a real browser with history could have shown it. 0.3.1 serves every
frontend file with `no-cache` and answers unchanged ones with a 304, and a page
that fails to load now says how to recover.

The bigger fix was a ship gate. A browser end-to-end suite now starts the real
backend and drives a real headless Chrome over the DevTools protocol, using
Node's built-in WebSocket, so it needs no npm packages either. It opens every
route and every tab (13 routes, 46 pages and tabs) and fails on an error state, an uncaught
exception, a console error, an API 5xx or a file served without `no-cache`. A
versioned git `pre-push` hook refuses to push any commit the suite has not
passed on the exact backend and frontend trees.

Running it from a fresh clone found two more bugs straight away. A parameter
preview answered 500 when a compose file was missing, and the config tab of a
system that is not deployed showed an error instead of "this file is not on
this machine". My own checkout had hidden both, because the backend there found
my lab's files. The suite now always starts the backend with an empty
repository root, so every run sees what CI sees.

## Where it stands

[Version 0.3.1](https://github.com/willboyden/nemo-console/releases/tag/v0.3.1)
came out on 24 October. In my checkout, 878 backend tests pass (from a clean
clone, 837 pass and 43 skip, because those need my deployment's layout or a
live system), mypy is clean in strict mode, 121 frontend tests pass, and the
browser suite covers every page. Every feature in the README is labelled
implemented, verified-live or unverified, and the feature matrix gives the
evidence for each.

The limits are stated just as plainly. Nobody but me has used it, on one
workstation, against one set of pinned versions. Some checks are indirect: the
console notices a stopped engine, not a running one that answers badly. The
topology shows plausible paths, not observed traffic. Several container and
unit names from my deployment are still constants in the adapters rather than
settings. Turning those into settings, so the console fits someone else's
stack, is what I would do next.

How the routing it watches performs is in
[Routing a coding agent across two local models](/writing/routing-coding-agent-two-local-models).

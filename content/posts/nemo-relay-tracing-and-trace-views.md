---
# Every number below was measured in my lab on 2026-11-14 (source: my private lab notes).
# Host names, addresses, ports and file paths are left out on purpose.
title: "Turning up NeMo Relay's tracing, and building a place to read it"
slug: nemo-relay-tracing-and-trace-views
summary: >-
  NeMo Relay, the gateway my coding agents talk to, can record far more than I
  had switched on. I turned on every capture level that has somewhere useful to
  go, routed each to the store that renders it best, and added five trace views
  to Nemo Console that read Relay's own files. Real captures found four bugs the
  fixtures never showed, and a review by a reviewer with no part in writing the
  change shaped the rest.
tags: [observability, agents, opentelemetry, security, rust, testing, open-source]
date: 2026-11-14
relatedProject: nemo-console
relatedPosts: [building-nemo-console, security-reviews-of-a-localhost-control-plane, rewriting-three-python-services-in-rust]
---

NeMo Relay is the gateway my coding agents talk to. Requests from opencode,
and from Claude Code when I launch it through Relay, pass through it on their
way to a model, and Relay can
write down what happened: each lifecycle event, a trajectory per session, and
OpenTelemetry spans in more than one shape. Until this week I recorded the
smallest useful set. Two things were missing: more of what Relay can capture,
and somewhere to actually read it.

## What Relay can record, and what I had on

Relay records at several levels at once. The raw one is ATOF, a JSON line per
event on disk. ATIF is one trajectory file per session. On top of those it
exports OpenTelemetry spans in three projections (the standard `gen_ai`
conventions, OpenInference, and Relay's own `full` shape), plus logs and
metrics. I had been exporting `gen_ai` spans and metrics, with payloads
filtered down to the newest turn.

That filtering mattered more than I expected. In a throwaway gateway with a
fake upstream, three calls in one session carrying 2, 4 and 6 messages were
recorded as 2, 2 and 2: the system prompt plus the newest message. The history
the model actually saw was gone from the record. With complete payloads on,
the same three calls were recorded as 2, 4 and 6.

I now name the choices as levels and apply them with one script, which
validates a candidate config in an isolated directory, backs up the live one,
restarts the gateway and checks its banner:

| | before | `enriched` | `full` (live now) |
|---|---|---|---|
| ATOF events and ATIF trajectories on disk | yes | yes | yes |
| What a model call keeps | newest turn | complete request | complete request |
| `gen_ai` spans to Tempo | yes | yes, plus Relay's metadata | same |
| OpenInference spans to Phoenix | no | no | yes |
| Relay's marks (routing decisions, hook events) as logs | no | no | yes |
| PII redaction before every sink | yes | yes | yes |

Relay's own `full` projection is the one level I left off on purpose. It
carries what ATOF already carries and none of the attributes a trace store
renders, so no viewer here would show it better than the projections they
already get.

### Two copies of one span

Turning on a second projection had a catch. Both copies of a span share the
same trace and span ids, so sending both to one store makes them collide. The
OpenTelemetry collector now routes them: `gen_ai` to Tempo, OpenInference to
Phoenix. I have Relay tag each projection with a resource attribute, and the rule that removes the `gen_ai` copy from Phoenix
also requires a second tag that only the `full` level sends. Without that
guard, rolling back to a lower level would have left Phoenix with no Relay
spans at all. A review of the script by a reviewer that had not written it
caught the missing guard before anything was applied.

### A test marker that redaction ate

The script has a `verify` step that sends one synthetic request and looks for it
in every store, with a positive control for every negative claim: "Tempo holds
no OpenInference copy" only counts if this run's `gen_ai` span is in Tempo.
Its first live run failed. The span was there, but its name ended in
`[REDACTED-PHONE]`: the marker was letters plus a ten-digit timestamp, and
Relay's PII redaction did its job on a digit run that looks like a phone number
in the OpenTelemetry exports. The marker is letters only now. Separately, one
fixed wait turned out to be too short for Tempo to make the span searchable, so
that check now polls for up to 90 seconds. Today `verify` proves that Tempo has
the `gen_ai` span and no OpenInference copy, and that Phoenix has the
OpenInference span. The logs row needs one routed model call and is next on the
list.

## A place to read it

NVIDIA's own tutorial uses Arize Phoenix to visualise Relay's traces,
and Phoenix now gets its native format. But the record I trust most is the ATOF
stream on disk, and the questions I ask most are about Relay specifically:
which route did a request take, how did a session's context grow, where did a
tool call stall. So [Nemo Console](https://github.com/willboyden/nemo-console),
my open-source console for the NVIDIA stack in my lab, gained five tabs on its
Relay page that read Relay's own files.

![A trace in Nemo Console: an agent run with its turns, model calls, tool calls and a subagent as a waterfall, with first-chunk markers and the cadence of streamed chunks under each model call. Rendered from the repository's mock server, so the data is a canned demo](/posts/nemo-relay-traces/trace-waterfall.png)

- **Traces**: a filterable list, and per trace a waterfall, an icicle and a span
  table that share one selection, with the routing decision, tokens, time to
  first chunk and the chunk cadence of every model call.
- **Sessions**: every trace of an agent session on one timeline, and the context
  the model was given call by call, cached and uncached.
- **Analytics**: totals, latency and token series, histograms, an activity
  heatmap, routing flows, tools and errors.
- **Trajectories**: Relay's own trajectories and those my Hermes agents write,
  step by step.
- **Capture**: which capture levels are on, what was observed for each, and what
  a reader of the traces is missing.

![A session: twelve traces on one timeline, and below it the input tokens of the model calls, cached at the bottom, growing from 6,000 to 90,000. Mock data](/posts/nemo-relay-traces/session.png)

The design is the part I would keep for any tool like this. One background task
reads the files into an in-memory index, incrementally: it remembers each
file's identity and how far it has read, re-reads a file that was truncated in
place, and never counts a rotated copy twice. The index holds metadata only:
identifiers, numbers and timestamps. Prompts, completions and tool payloads are
never stored in the index or returned by the views a read-only key can open. They
are read from the source line on demand, by two routes that need an admin key,
can be switched off, scrub known secret patterns and return only a fixed list
of headers.

A test plants one marker string in every payload field of the fixtures:
messages, tool arguments, tool results, streamed chunks, headers, trajectory
steps. It calls every read-only route and asserts the marker never appears,
then calls the admin route and asserts it does. A check that the marker is
absent proves nothing unless the same test can find it where it should be.

![Analytics for the whole window: calls, errors, tokens, cache hit ratio, latency percentiles, time to first chunk and output speed, then calls and tokens over time. Mock data](/posts/nemo-relay-traces/analytics.png)

## What real data found

The fixtures were synthetic and passed. The first run against my real captures
(2.4 GiB in seven files, four of them gzip rotations: about 566,000 events,
1,900 traces and 840 trajectories) found four problems none of them had:

- **Every Hermes trajectory was skipped.** Their ids are not UUIDs, and the code
  assumed they were. They now get a stable id derived from the original, which
  stays visible.
- **Opening a span from an old rotation was slow in proportion to its depth.**
  Near the end of a 1 GB gzip file it took 54 seconds, because gzip has no
  random access. The index now records seek points while it reads a rotation (the
  decompressor's state roughly every 32 MiB of output), and a read resumes from
  the nearest one. The deepest read dropped below one second (both numbers from a
  debug build).
- **Credentials inside tool output needed their own pass.** Content now gets an
  extra pass for secret-named pairs in JSON, YAML and environment-file form.
- **One 494-trace session needed about a hundred lanes on its timeline.** The
  timeline now keeps twelve lanes and says how many short traces overlap.

With the release build the first index of all of it takes about 15 seconds and
the console holds about 100 MB; after that, refreshes take milliseconds.

![The Capture tab: how many of Relay's capture levels are switched on, and for each one what is configured and what was observed on disk. Mock data](/posts/nemo-relay-traces/capture.png)

## A security review before merging

Nemo Console is public, and these views open conversation content, so a
reviewer with no part in writing the change read it before it merged, then
re-read the fixes twice. It found nothing critical, one medium issue and four
low ones, all addressed before the merge (two smaller limits are documented in
the threat model rather than changed). The lessons generalise:

- **A scrubber should not depend on an engine that can give up.** Secret
  scrubbing now runs only on linear-time regular expressions. A test checks the
  new pattern against the old one over 400 generated texts, and the re-review
  compared it with the original Python pattern on 60,000 random texts without a
  single difference.
- **Budgets must count what you actually decompress, not what a file declares.**
- **Bound every collection, not just the obvious one.** Spans were capped; marks
  and interned identifiers now are too.
- **Re-check a file when you read it, not only when you index it.** A changed
  trajectory is now refused instead of served.

The re-review also caught a regression in my first fix, which is why the final
fix replaced the engine instead of adding a fallback.

## Where it stands

The trace views and the review's fixes are merged to main and running here (not
yet in a tagged release), with the release gates, the browser suite and the
comparison against the old Python backend all green. Relay records at `full`.
Next comes the routed call that proves the logs row. After that, possibly the
upgrade to Relay's newer release, which adds resource metrics and runtime
diagnostics the Capture tab could show.

---
title: "Two security reviews of a localhost control plane: what broke, what held"
slug: security-reviews-of-a-localhost-control-plane
summary: >-
  Two independent reviews of Harness² Workbench found 27 issues, most with a
  working reproduction: a FIFO that hung every results call, a sparse file
  that kept other requests failing for over a minute, an audit log flooded at
  21,000 rows a second. What broke, what held, and the fixes.
tags: [security, rust, agents, testing, open-source]
date: 2026-10-24
series: Harness² Workbench
relatedProject: harness2-workbench
relatedPosts: [building-harness2-workbench, mcp-server-for-an-agent-harness]
---

[Harness² Workbench](/writing/building-harness2-workbench) is a web UI, REST
API and MCP server that starts processes, holds API keys for cloud models and
reads whatever those processes write. It listens on `127.0.0.1` by default,
and it is tempting to treat that as a trust boundary. It is not. Any page open
in your browser can send requests to localhost. A job the Workbench starts
runs as a user on the same machine, and an executor that a model can steer
writes the very files the Workbench later reads back to show you results.

So before the repository went public, the code went through two independent
security reviews. The reviewer had no part in writing it and started with no
prior context. It was given the source and a scratch server, and asked for
findings with a working reproduction and a minimal fix. This was an AI
security reviewer, not a human penetration test, and the repository says so.
The first review, at the end of the build, found 17 issues. The second, a few
hours later, checked those fixes, confirmed 12 and judged five partial or
acceptable by design, and found 10 more. A final documentation pass found
three further code issues, all fixed. Every code fix got a regression test.

This post is what they found, grouped by the lesson behind it.

## What held

It is worth starting with the attacks that failed, because they are what a
localhost admin tool usually gets wrong:

- **DNS rebinding and cross-site requests.** Every request must carry an
  allowed `Host` (anything else is a 421), every state-changing request
  needs a custom header that a cross-site form cannot set, and there is no
  CORS at all. The second review threw 28 raw-socket cases at the `Host`,
  `Origin` and CSRF checks.
- **Role checks.** The first review swept 49 method and path pairs against
  four roles, the second sent 196 route-and-role requests. No route answered a
  role it should not.
- **Path traversal in the results reader:** encoded `..`, absolute paths,
  backslashes, NUL bytes, symlinks and a run directory pointed at `/etc`.
- **The web UI:** hostile content rendered in 21 pages, and 19 `?next=`
  redirect payloads.
- **The egress proxy:** 20 server-side request forgery cases, including IP
  literals, loopback, other ports and credentials in URLs.
- **Fuzzing:** 686 hostile requests produced no server error and no panic.

The design choices behind that list (one enforcement point, argv-only process
spawning, a strict Content-Security-Policy, no `unsafe` code) did their job.
The findings were somewhere else.

## Lesson 1: files a job wrote are hostile input

The largest group of findings came from one fact: a job controls the files the
Workbench reads afterwards. Size caps on single files were in place from the
start. They were not enough.

**Memory amplification.** The first review wrote six task summaries of 38 MiB
each. One request to list experiments then parsed all of them into JSON
trees, and the server's peak memory went from 0.8 GB to 3.8 GB; four requests
in parallel reached 14.7 GB. The fix was layered: a 4 MiB cap on a summary,
typed parsing that keeps only the fields it needs, a cache keyed on file
times, at most four results reads at once, and a per-request budget.

**The FIFO swap.** The reader checked `summary.json` with `lstat` and then
opened it. Between the two calls a job can exchange the file with a named pipe
in a single `renameat2(RENAME_EXCHANGE)`. A plain `open` of a FIFO waits for a
writer that never comes, while holding one of the four read permits. Do that
four times and the results API is dead: the second review's first hang came
after about 6 seconds, and by about 35 seconds every results call was timing
out, until a restart.

![The FIFO swap: before, lstat then open blocks forever on a swapped-in FIFO; after, open without blocking or following links, then fstat to confirm a regular file with the same inode](/posts/harness2-workbench/fifo-swap.svg)

The fix opens every results file with `O_NONBLOCK | O_NOFOLLOW` and then
checks with `fstat` that the open handle is a regular file with the device and
inode `lstat` saw. Anything else is reported as unreadable and the permit is
released. The live check swapped a FIFO over `summary.json` nine million times
while tasks were being listed; no read hung.

**Sparse files.** The harness fingerprint and the experiment manifest's digest
read every file in full, with no cap, because they only computed hashes. A job can
create a 1 TiB sparse file that takes no disk space and reads as endless
zeroes. Four concurrent harness views over one kept every other results call
failing for over a minute; a 64 GiB file took 25.5 seconds. Both readers now
record an over-cap file by its size (`<too large: N bytes>`) without reading
it, and refuse more than 64 MiB (fingerprint) or 1 GiB (digest) in total.

**Hardlinks defeat per-file caps.** Forty sweeps of 63 hardlinked 4 MiB
summaries are 9.8 GiB of reading and 4 MiB of disk. A single
experiment request ran three threads at full CPU for about eight minutes. The
budget is now per request, in bytes and in sweeps; a request that times out
or whose client leaves cancels its reads; an experiment lists at most its 200
newest sweeps; and the sweep cache evicts the least recently used entry
instead of clearing itself.

**Responses grow with their sources, and past them.** A 268 MB job log came
back as one 268 MB page, and eight concurrent requests took the server from 12.6 MB to
4.2 GB of memory. A 64 MiB harness made of control bytes became a 402 MB JSON
response, six times its size, because every byte was escaped. Log pages now
stop near 1 MiB and return where to continue. Results responses are built
inside their read permit and refused with a 413 above 64 MiB. Job logs
themselves have a 256 MiB cap and a free-disk floor, after the first review
watched 400 MB of output become a 694 MB log in 29 seconds.

The rule I took away: a reader of untrusted files needs limits on **type,
size, total, time and concurrency**, plus cancellation. Any one of them alone
can be walked around.

## Lesson 2: an append-only log is a write endpoint

The audit log is a hash chain: each record includes the hash of the previous
one, so a later edit breaks the chain. That makes every audited event an
endpoint that writes to disk, and the reviews treated it as one.

- **Unauthenticated flooding.** Every request with a junk bearer token
  appended a record. 140,000 such requests added 140,000 records and 33 MB.
  Failed authentication is now limited to 60 attempts a minute per client
  (then `429`), and at most 10 failures a minute per client are recorded; the
  rest are only counted in a metric.
- **Authenticated flooding.** A viewer token calling an admin-only route
  300,000 times in 14 seconds wrote 300,000 records and 90 MB, about 21,000 a
  second. Refused requests are now recorded at most 10 a minute per principal.
- **The one the documentation pass caught.** Refused job starts and cancels
  were written by the job engine, not the HTTP layer, and the new limit did
  not cover them: 300 refused requests from an operator token still wrote 300
  records. They now share the principal's allowance. Live, 300 refused starts
  left 10 records, the next 300 refused cancels added none, and an
  administrator's refusal in the same minute was still recorded.
- **Spoofed actors.** A user signed in through the reverse proxy could call
  themselves `initial admin`, the name of the bootstrap token, and appear in
  the log as that token. Actors now carry their kind: `token:initial admin`
  and `proxy:initial admin` are different strings.

The first review also pointed out that the chain is unkeyed: anyone who can
write the database can rewrite every record and recompute every hash. That
was not fixed in code. The documentation now says plainly that the chain shows
edits only by someone who cannot rewrite the data directory, and tells you to
record the head hash somewhere else on a schedule.

## Lesson 3: identity has to survive proxies and duplicates

- **Repeated proxy headers.** In single sign-on mode the Workbench trusted
  identity headers from a reverse proxy. The first `x-forwarded-user` won and
  all `x-forwarded-groups` values were combined, so a client that added its
  own `x-forwarded-groups: admins` became an administrator. A repeated
  identity header is now a `401`, and a repeated `Host` or `Origin` header is
  refused too.
- **A panic before authentication.** A login token whose multibyte UTF-8
  character straddled byte 8 made the parser's `split_at` panic. The
  connection died and the server survived, but an unauthenticated panic is a
  bug class, not a bug. Tokens are now checked as ASCII first, with a
  property test over random non-ASCII input.
- **One shared limiter table.** Behind a trusted proxy the client address
  comes from `X-Forwarded-For`, which any process on the proxy's network can
  invent. A job filled the 10,000-entry limiter table with made-up addresses in
  3.6 seconds, and a real administrator's login from a new address got a `429`.
  Each trusted peer now gets its own share (1,024 clients, then its own
  overflow bucket), so a peer that floods only limits itself.
- **Long-lived streams.** A live-log stream was authorised only when it
  opened and could run for an hour after its token was revoked. Streams now
  re-check their credential at every heartbeat. One viewer could also open all
  64 stream slots, and 1,100 idle sockets filled the connection limit; both
  limits are now per principal (8 streams) and per address (256 connections).

## Lesson 4: "same machine" means "same user"

The finding with the widest reach (the reviewer rated it medium) was not a bug
in the usual sense. In host isolation,
harness2's executors run as the Workbench's own user, as they do upstream. The
first review's job simply opened the Workbench's database (stored secrets,
token hashes) and read `/proc/<pid>/environ` of the server, which held every
secret passed by environment and the proxy shared secret, enough, in
single-sign-on mode, to sign in as any user.

What changed:

- The server and the egress proxy mark themselves non-dumpable at start-up, so
  a same-user process can no longer read their environment through `/proc`.
- The README, the threat model and the setup docs say in bold that a host-mode
  job is, in effect, a Workbench administrator, and point to container
  isolation.
- Container jobs get their variables through a 0600 environment file instead
  of the runtime command's environment. The profile variables a user may set
  exclude names that could steer the container runtime or Git
  (`DOCKER_CONTEXT`, `XDG_RUNTIME_DIR`, `GIT_SSH_COMMAND` and others), after a
  fake `docker` script in the review received an attacker's context.
- Installing harness2 accepts only the commit the release was tested against
  (unless an administrator opts out), because GitHub serves commits that exist
  only in forks through the parent repository's URL.
- Restart recovery used to signal any process group whose leader started late
  enough, which could hit an unrelated process after a reboot. It now needs
  the same boot and a job marker in the process's environment.
- The egress proxy listened on all interfaces by default; it now listens on
  loopback unless configured otherwise.

## What I would do the same way again

**Ask for reproductions, not opinions.** The resource findings came with
numbers: 14.7 GB, 6 seconds, 300,000 records. That made each one impossible to
argue with and easy to turn into a regression test.

**Review the fixes, not just the code.** The second review exists because
fixes introduce new attack surface. The per-file caps from the first review
were real, and hardlinks walked straight past them, while the readers that only
computed hashes had no cap at all. The second round's fixes have not been
reviewed independently again yet, and the README says so.

**Write the residual risks down.** Some findings were narrowed rather than
closed: the unkeyed audit chain, best-effort secret redaction, one egress
allowlist shared by setup and executors. The threat model lists what remains
with what to do about it, and the README's feature matrix says which protections were verified against a real
server and which only with stand-ins. A security claim you cannot point at a
test or a measurement is just a claim.

The next post in this series is about the part of the attack surface that
talks to models directly: [the MCP server](/writing/mcp-server-for-an-agent-harness).

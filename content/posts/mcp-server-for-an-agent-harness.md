---
title: "An MCP server for an agent harness that will not let a model accept risk for you"
slug: mcp-server-for-an-agent-harness
summary: >-
  Harness² Workbench gives AI agents 42 MCP tools to plan, run and analyse
  harness2 sweeps. The MCP server holds no power of its own: the Workbench
  enforces each token's role, the MCP layer refuses to let a model accept
  host-execution risk for you, and results are treated as untrusted.
tags: [mcp, agents, security, rust, evals]
date: 2026-10-24
series: Harness² Workbench
relatedProject: harness2-workbench
relatedPosts: [building-harness2-workbench, security-reviews-of-a-localhost-control-plane]
---

Google Research's harness2 is a tool for improving AI agents, so it is
natural to want an AI agent to drive it: set up a benchmark, preview a sweep, estimate its cost,
start it, wait, read the results and export the harness that won.
[Harness² Workbench](/writing/building-harness2-workbench) ships an MCP server,
`h2workbench-mcp`, built for exactly that from Claude Code, opencode, Codex,
Cursor or any other MCP client.

It is also the most dangerous interface in the project. A model choosing tool
calls can be wrong, can be steered by text it read in a previous result, and
can cost money with every call it makes. This post is about the five rules
that decide what such a model can and cannot do.

![Who decides what: the model chooses tools and arguments; the MCP server adds one rule (no accepting host-isolation risk for you), labels results untrusted and bounds output; the Workbench server decides roles, refusals, isolation, limits and budgets](/posts/harness2-workbench/mcp-who-decides.svg)

## What an agent gets

Forty-two tools, three resource forms and three prompts. The tools follow the
lifecycle of a sweep, and each needs a minimum role that the Workbench server,
not the MCP server, enforces:

| Purpose | Tools | Role |
|---|---|---|
| Orient | `server_info`, `doctor`, `list_benchmarks`, `list_profiles`, `check_profile` | viewer |
| Experiments | `list_experiments`, `get_experiment`, `get_manifest`, `list_splits` | viewer |
| | `create_experiment`, `update_experiment` | operator |
| Plan, no model calls | `estimate_cost`, `validate_harness` | viewer |
| | `preview_run`, `check_benchmark`, `run_demo`, `create_split` | operator |
| Run (can cost money) | `start_run`, `start_pipeline`, `start_judge`, `start_report` | operator |
| Install | `setup_benchmark`, `install_harness2`, `start_bridge` | admin |
| Follow | `list_jobs`, `get_job`, `wait_for_job`, `get_job_log` | viewer |
| | `cancel_job` | operator |
| Read results | `list_tasks`, `get_task`, `get_harness`, `diff_harnesses`, rollouts, scores, reports, libraries, the improver's audit sessions, `compare_sweeps` | viewer |
| Adopt | `export_harness` (raw files, or an OpenCode or Codex project) | viewer |

The prompts are guided workflows: `improve_agent_harness` walks from the
environment check through a cost estimate, **your go-ahead**, the run, the
report and the export; `analyze_sweep` is read-only; `adopt_best_harness`
chooses and explains a harness and asks for approval before anything is
written.

## Rule 1: the server decides, not the MCP server

`h2workbench-mcp` keeps no state, runs no jobs and holds no credentials of its
own. Every tool call becomes an ordinary REST request carrying an API token, so
the Workbench's roles, limits and audit log apply to an agent exactly as they
apply to a person. A viewer token cannot start a job, whatever the model says.

There are two transports. Over stdio, one client uses one token, read from the
environment or from a token file that the MCP server refuses to use if anyone
but its owner can read it. Over streamable HTTP the endpoint is stateless and
every request carries its **own** bearer token, which is forwarded as it is, so
each client is authorised and audited separately. A token given to the process
itself is ignored in that mode, with a warning, so a shared MCP endpoint can
never lend one client's rights to another.

The HTTP endpoint has its own guard in front: an unknown `Host` is refused
(DNS-rebinding defence, and a `Host` with credentials in it counts as unknown),
a browser `Origin` that is not allowed is refused, requests without a
well-formed token are refused, and concurrency and body size are capped. The
MCP server also refuses to send tokens to a Workbench over plain `http` on
anything but loopback, unless that is explicitly overridden.

Refusals cost the agent nothing and tell it what to do next: the server's error
says which role a call needs. They also cannot be used to fill the audit log,
because each token's refusals are recorded at most 10 a minute and only counted
after that.

## Rule 2: no tool for secrets, tokens, profiles or the audit log

This one is by contract: there is no MCP tool that writes a profile, a secret, a
token or the audit log, and none that reads a secret. The reason is specific. A
model profile names the endpoint a job sends its prompts to, and which stored
secret holds its API key. A prompt-injected agent that could edit a profile
could point the endpoint at a server it controls and receive the key with the
next job. Secret values and new tokens should never pass through a model's
context at all. People manage those through the web UI, the REST API or the
command line.

## Rule 3: a model cannot accept risk on your behalf

In host isolation, harness2's executors run as the Workbench's own user, with
its files and its network: a host-mode job is, in effect, a Workbench
administrator. The Workbench therefore refuses a host-mode `run` or `pipeline`
unless the request sets `acknowledge_risks: true`.

That flag is a statement that a *person* accepted the risk, and the first
security review pointed out that a model could simply set it. So the MCP server
adds the only rule of its own: it refuses any `start_run` or `start_pipeline`
call that sets `acknowledge_risks=true`, unless whoever started the MCP server
passed `--allow-risk-acknowledgement`. The refusal, as it came back from a live
server:

```text
forbidden: this MCP server does not let a model set acknowledge_risks=true, which
accepts for the user that the executor runs with the server user's files and
network (host isolation). A human can start this run from the Workbench web UI;
an admin can pre-acknowledge host risks in the server configuration; or the
person who runs h2workbench-mcp can start it with --allow-risk-acknowledgement
(H2W_MCP_ALLOW_RISK_ACK=1). Without acknowledge_risks the call goes through and
the Workbench server decides.
```

The message is written for the model as much as for the person reading the
transcript: it explains what the flag means and lists the three ways a human
can make the decision instead. One of them, an administrator pre-acknowledging
host risks in the server configuration, removes the requirement for everyone,
agents included, and the documentation says exactly that. Other host-mode jobs
(previews, the demo, judging, reports) never needed the acknowledgement, which
is why the advice for anything untrusted is container isolation. The same thinking applies to money. `budget_usd`
is an argument the model chooses, so the advice is a budget on the model
account itself, not only in the tool call.

## Rule 4: everything a tool returns is untrusted

Rollout files, job logs, improver prompts and answers, task text, transcripts,
harness files and benchmark documents are written by models or by third
parties, and any of them can contain instructions aimed at the agent reading
them. An exported harness contains whatever a model wrote into it.

The server's instructions and the descriptions of those tools tell the model
to read such content as data and never to follow instructions found in it. The
documentation is explicit that this is guidance to a model, not a barrier: an
agent that acts on instructions found in a result should be treated as
compromised for that session, and nothing it proposes from that point should
happen without a person's approval.

## Rule 5: everything is bounded

An agent loop can wait forever, read forever and retry forever, so nothing in
the MCP server is open-ended:

- **Waiting.** Job-starting tools take a `wait_secs` of at most 600. The quick
  ones wait 45 seconds by default; the costly or slow ones return the queued
  job at once. `wait_for_job` follows the server's event stream for at most 600
  seconds and falls back to polling when the stream is unavailable.
- **Output.** A tool result is capped at about 100 KB of text, with an explicit
  note when it is cut and the full value attached as structured content when
  it is a reasonable size. Asking for the tail of a log returns the newest
  lines that fit, following the server's 1 MiB log pages, so a log of very long
  lines still ends at its last line.
- **The HTTP endpoint** limits concurrent requests and body size, as above.

## What was verified, and what was not

The MCP server was exercised live against a real Workbench and a real harness2
checkout over stdio: initialisation, the tool list, `server_info`, refusals for
each role, and a real demo run through `run_demo`, as well as the HTTP guard.
The end-to-end suite runs the demo through an MCP client on every push, and a
snapshot test fails if any tool's schema or description changes without being
reviewed. What has not been done is trying it in each of the MCP clients named
above: the configuration snippets in the documentation follow each client's
documented format and say they are unverified.

## If you are building an MCP server for something that runs code

- Make the MCP server a client of the system's own API, with the caller's
  credentials, so there is exactly one place where rules are enforced.
- Leave out the tools you would not let a prompt-injected agent call. A tool
  that does not exist cannot be misused.
- Separate "a person accepted this risk" from "a request says so", and do not
  let the model produce the former.
- Write refusals that say what the model, or the person, should do next.
- Bound every wait, every read and every retry.
- Hand agents the least privilege that works: a viewer token by default, an
  operator token only when the agent must start jobs, never an admin token, one
  token per agent, with an expiry.

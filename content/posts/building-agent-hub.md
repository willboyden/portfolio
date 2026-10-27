---
title: "Building Agent Hub: one place for what your coding agents know and may do"
slug: building-agent-hub
summary: >-
  Claude Code, opencode, Hermes Agent and Turnstone each keep skills,
  instructions, MCP servers and permissions in their own format. Agent Hub
  compiles them from one git repository instead: edit, commit, plan, apply,
  above a policy floor that content can only tighten, with every skill
  evaluated before it is imported.
tags: [ai-agents, mcp, security, developer-tools, fastapi, open-source]
date: 2026-10-26
relatedProject: agent-hub
relatedPosts: [building-engine-console, building-nemo-console]
---

I run several agent clients side by side: Claude Code, opencode, Hermes Agent
in a container, and Turnstone. Each one keeps its instructions, skills,
subagents, MCP servers and permissions in a different format and a different
place. Copies of the same skill drifted apart, a fix landed in one client and
not the others, and nothing showed what each agent was actually allowed to do.

[Agent Hub](https://github.com/willboyden/agent-hub) is the open-source (MIT)
tool I built for that: one place to organise what every agent client knows and
may do, rendered into each client's native files. This post is about the
decisions behind it and what using it on my own setup found.

![The Agent Hub home page: a getting-started checklist (import, organise, review the plan, apply), items that need attention, library counts and the status of each client. Rendered from the repository's mock server, so the content is a canned demo](/posts/agent-hub/home.png)

## Compile, don't serve

The obvious design is a service that the agents query for their skills and
permissions. Here it could not work. A containerised client such as Hermes may sit
on an internal-only network with no host mounts, and rootless Docker cannot
reach a service on the host's loopback, so configuration has to be pushed, not
pulled. And what an agent is told and allowed to do is security-relevant, so it
deserves history, diffs, review and revert.

A git repository of declarative files gives both. The hub is a compiler and a
change-controlled control plane: content goes in, each client's native files
come out (`.claude/skills`, `.opencode/agent`, `AGENTS.md`, a staged tree for
Hermes and Turnstone). Nothing has to be running for an agent to work. The cost
is accepted on purpose: there are no live toggles, and delivered files are
copies that can diverge, which the next part handles.

## Edit, commit, plan, apply

Every change follows the same loop. Edits in the UI or the command line change
the content's working tree. A commit is the approval of that content. A plan
renders the committed tree for each client, diffs it against the files on disk,
checks it against the policy floor and writes nothing. Apply writes only what
that plan showed, only after confirmation, and refuses if anything moved since
the plan was made.

Writes are all-or-nothing per client, with a backup of every file they
overwrite and a lock manifest of what the hub last delivered. A file someone
edited outside the hub becomes a conflict, which is skipped unless you adopt it
explicitly; nothing is overwritten silently. Rollback restores the last apply,
and refuses to touch a file that has been edited since.

## A policy floor content can only tighten

The floor is a file in the application's own repository, not in the content,
and neither the UI nor the API can edit it. It denies credential paths, denies
egress by default, refuses MCP servers that have not been scanned and refuses a
catch-all shell permission. Content can make any of that stricter, never
looser, and the rendered files are checked against it again before they are
written.

The hub is an authority over agents, so the agents must not be able to reach
it. Loopback is not trusted: if it were, any local process, including an agent
with a shell, would be an administrator without a key and could edit its own
policy. The content repository lives outside every project directory, because
an agent that can write into a project could plant a `.git/config` that runs
commands as me, or forge commits; the hub refuses a content repository that is
not safe. What remains is stated plainly: a process running as the same user
can read anything that user can, including the admin key. The real fix is a
separate operating-system user for that client, and `hubctl doctor` shows what
is exposed on the host.

## One vocabulary, many clients

Claude Code says `Bash`, opencode says `bash`, Hermes has toolsets. Writing
agents against native tool names would fork every agent per client, so content
uses twelve canonical capabilities and three model tiers, and each adapter maps
them. Two rules keep that honest. A lossy or missing mapping always produces a
diagnostic, and an error on a strict client. And an agent that would end up
with no tools at all is an error, because several clients treat an empty tool
list as "all tools".

Adding a client needs no code. A declarative YAML spec describes where its
files go and in which format, and the add-client wizard validates the spec live
and shows a dry render. Turnstone has its own adapter: it stages a tree, and a
delivery script pushes it through Turnstone's admin API as hub-owned skills that
are never auto-approved.

## Adopting a setup that already works

Nobody starts from an empty directory, so the hub starts with import. It reads
what each client already has, links identical items and records the live files
as adopted, so the first plan shows ordinary diffs instead of a wall of
conflicts. Each concern (skills, agents, instructions, MCP, permissions,
memory) is either managed, where the hub writes it, or advisory, where the plan
shows what would change and an audit checks the live file against the floor,
but nothing is written. That matters when another script already owns a file.

The first real apply, on 4 October, enabled eleven subagents in opencode. Its
`AGENTS.md` stayed outside the hub's control, because adopting it would have
reverted ten days of edits made elsewhere, and the conflict protection flagged
it exactly as designed. That apply also found a bug: turning a concern advisory
left its lock entries behind, so `verify` kept checking files the hub no longer
managed. Advisory concerns now release them.

## Evaluate before import

A skill is instructions an agent will follow, so importing one is a security
decision. Agent Hub can observe what a client actually holds; for Hermes, it
reads the skills directory of the running container, read-only. My Hermes
container held 198 skills, and 107 of them the agent had written itself.

Every skill can be evaluated with NVIDIA SkillEvaluator, and the evaluations
are a main view of the app. The import gate is decided by the static security
pass alone, because with the LLM pass on, its verifier can downgrade security
findings. The hub never runs SkillEvaluator's `dependency` check: it installs a
skill's declared requirements, which would run the skill author's code on the
host. When a security validator does not finish, the skill is blocked until a
person overrides it with a recorded reason.

The first pass over those 198 skills blocked 161, warned on 8 and passed 29. For
94 of the blocks the reason was only that one security scanner returned
"incomplete". 66 had high-severity pattern hits: mentions of `.env` files,
anti-refusal text, instructions to modify themselves, and `pip install git+`.
Those 66 are the reason the gate exists.

## Knowledge and memory

Two smaller parts complete it. A separate knowledge service holds vector
stores, embedded LanceDB for small per-project corpora and Qdrant for large
ones, chosen per namespace and reached through scoped tokens and a read-only
broker sidecar. And memory is curated: agents propose memories into an inbox,
and only a person promotes them into content that clients receive.

## Where it stands

Version 0.1.0 was the first public build, and the main branch has added the
desktop launcher, a sign-in form the browser can save, the Turnstone adapter,
observed inventories, skill evaluation and the import gate. 949 backend tests
and 178 frontend tests run offline, the knowledge service has its own suite,
and CI runs linting, strict type checking, the tests and a dependency audit.
The 0.1.0 security work came from an internal review rather than an independent
audit, and the changelog says so. The skill evaluation and the latest Turnstone
changes each had a security review before they were pushed.

The known limits are written down too. Delivered files are not read-only to the
agents that receive them. A same-user process can read the admin key. The floor
re-check of rendered files covers JSON and YAML artifacts only. Hermes delivery
is a manual step. It is a single-user tool.

Agent Hub stays separate from my engine tooling on purpose. Folding agent policy
into [Engine Console](/writing/building-engine-console) would have mixed two
trust models: a local operations UI and an authority that agents must not be able
to reach. They share patterns, not code.

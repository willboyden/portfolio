---
# DRAFT-REVIEW: human review before publishing. All facts verified against
# the opencode repo via GitHub API on 2026-10-16 (CHANGELOG.md at v2.0.32,
# tags, package trees at v2.0.0/v2.0.32/v1.19.3, packages/cli/src/config/migrate.ts).
# opencode.ai itself was not reachable from the sandbox (egress allowlist) —
# everything below traces to the public repository, PR numbers included.
slug: opencode-2-what-changed
title: 'OpenCode 2.0 — reading the changelog of a five-week rewrite'
summary: >-
  OpenCode 2.0 shipped September 11 and has iterated 32 patch releases in five
  weeks. A read of the repository — not the marketing — of what structurally
  changed: an Effect-native core, a confined Code Mode, a desktop app, worktree
  tooling, and the packaging fallout of the sst to anomalyco move.
tags: [ai-agents, opencode, developer-tools, changelog-forensics, effect]
date: 2026-10-16
relatedPosts: [eval-harness-silent-regressions, mcp-production-lessons]
relatedProject: orchestrator
---

I use OpenCode as one of the delegated coding agents in my local fleet — the
same fleet that benchmarks brokers and runs the MCP orchestrator. When the 2.0
line landed I did what I do with any tool this central to my workflow: ignored
the announcement post and read the repository. This article is that read,
compressed. Everything here traces to the public repo — tags, changelog,
package trees, and the migration code itself — with PR numbers so you can
check my work.

## The shape of the release

OpenCode 2.0.0 shipped **September 11, 2026**. Since then: **32 patch
releases in five weeks** (v2.0.32 on October 16). That cadence matters more
than any single feature — it says the 2.0 line is the active line, not a
branch in pretense. The 1.x series continued in parallel for a while (v1.19.3
landed the same day as v2.0.32), but the changelog discipline tells you where
the energy is: release notes are written, reviewed, and synced to a
`CHANGELOG.md` per version by dedicated release commits.

Two things happened to the project's home at the same time. The repository
moved from `sst/opencode` to **`anomalyco/opencode`** — and the package
namespaces followed: `@opencode-ai/*` became **`@opencode/*`**. If your
tooling pins imports or npm scopes, that rename is the migration item that
will actually bite.

## What structurally changed

Diffing the package tree at `v1.19.3` against `v2.0.0`:

**New packages:** `ai`, `simulation`, `theme`, `plugin-browser`, `latex`,
`merman`, `posts`, `util`. The `ai` package centralizes what was previously
scattered provider logic (the v1 tree had a separate `llm` package that is now
gone). `simulation` and `theme` being first-class packages tells you testing
and theming stopped being afterthoughts.

**Removed packages:** `docs`, `effect-sqlite-node`, `llm`, `opencode` (the
monolithic core was split into `core` + `server` + `cli`), `sdk-next`, and
`slack`. The `sdk-next` removal is housekeeping; the `llm` removal is the
architectural statement.

**The Effect rewrite.** The clearest signal is in the code itself. The config
migration (`packages/cli/src/config/migrate.ts`) is written as Effect
generator functions with typed schemas, `FileSystem` services, and atomic
temp-file renames. The SDK now exports Effect-native drivers
(`WorkspaceDriver`, `EnvironmentDriver`) from `@opencode/sdk/effect`. V2 is
an Effect-TS codebase where V1 was a Bun/TypeScript codebase with Effect
islands. That changes how extensions integrate: plugins get `ctx.permission.assert`
so they can reuse the host's permission rules instead of reimplementing
approval flows (v2.0.29, #54930).

**Code Mode.** The `codemode` package describes itself as "Effect-native
confined code execution over schema-described tools" — the agent writes code
against a tool schema and runs it in confinement, instead of the host
mediating every tool call individually. One v2.0.27 fix in this area matters
for security reviewers: `file://` access through Code Mode's `fetch` is now
blocked with a clear error (#54510). Confinement that actually confines.

## The feature surface, from the changelog

Reading v2.0.26 → v2.0.30 as one document, the themes are:

**Parallelism as a first-class workflow.** Built-in `worktree_create` /
`worktree_list` / `worktree_remove` tools (#53981) — you can now ask the agent
to isolate risky work in a git worktree without leaving the session, with
removal gated behind normal edit approval. Per-project auto-accept overrides
(#54839) acknowledge that trust is per-project, not global.

**Remote access, with consent.** OpenTunnel device pairing shipped in v2.0.29
(#55306), and v2.0.27 added a first-run confirmation before `opencode pair
--remote` exposes your server (#54561) — the safer-remote-pairing sequence is
the right order to ship those in. Remote service URLs moved to persistent
random subdomains instead of predictable routes (#53962).

**Long-running agent ergonomics.** Automatic response continuation when
output-token limits truncate a turn, preserving partial output (#53876), plus
the same for provider-split Gemini streams (#55056). Streamed-chunk timeouts
raised from 5 to 15 minutes for reasoning models that pause mid-stream
(#55032), and Bun's fetch idle timeout disabled for provider requests so long
streams don't die early (#55007). These are the fixes you only make when real
users run real long agentic sessions.

**Review and diff UX.** Changed-files-by-turn in the timeline with expandable
diffs (#55064), a docked `/diff` viewer in the TUI (#47152), and clearer
rendering of execution errors that happen *between* model steps (#53826) —
that last one matters more than it sounds; pre-model failures used to end a
session with no explanation.

**Platform maturity.** Native Windows ARM64 (#54689), official WinGet
packages with upgrade integration (#54808), installable web app behind
authenticating proxies (#53905), and zstd request compression as a setting
(#54932).

## The migration story

There is a real migration path, and it's engineering rather than a
`npx migrate` afterthought: a schema-validated V1→V2 config transform that
preserves unknown V1 OpenAI-compatible model options in migrated request
bodies (#54694), honors the old `experimental.policies` key alongside the new
top-level `policies` (#55297), and publishes a config schema that accepts
both shapes during the transition (#55524). Central configuration now takes
precedence over local config (#55267) — the managed-deployment posture.

## What I take from it

Three things, from the perspective of someone running this agent inside a
local fleet:

1. **The Effect migration is the real story.** Everything else in the
   changelog is features; this is the foundation decision that determines how
   extensions, permission systems, and the SDK compose for the next few
   years. Typed effects with proper resource management is the right
   substrate for an agent host that manages processes, streams, and
   permissions.

2. **Confinement is becoming table stakes.** Code Mode's confined execution
   plus the `file://` block plus consent-gated remote pairing — the 2.0 line
   treats "the agent can do arbitrary things" as a bug to be fixed, not a
   feature. That matches how I screen untrusted content in my own ingest
   pipelines.

3. **Worktree tooling inside the agent loop closes the parallelism loop.**
   My fleet runs parallel agents in separate worktrees by convention; OpenCode
   making that a native tool means the isolation pattern is becoming
   productized. Expect the other agents to follow.

---

*Everything above is sourced from the repository at specific tags and PRs:
launch date from the `v2.0.0` tag (2026-09-11), package diffs from the
`v1.19.3` and `v2.0.0` trees, changelog items from `CHANGELOG.md` at
`v2.0.32`, migration behavior from `packages/cli/src/config/migrate.ts`. I
could not reach opencode.ai from my environment (egress allowlist) — none of
this derives from marketing pages, which is exactly why it is all checkable.*

---
# DRAFT-REVIEW: human review before publishing. Site facts trace to
# /opt/data/workspace/projects/professional-portfolio (vitest.config.ts,
# src/**/*.test.*, scripts/build-content.mjs, e2e/); eval facts trace to
# /opt/data/workspace/model-quality-harness (harness/ + README + results/).
title: Testing when half your system is a prompt
slug: testing-half-your-system-is-a-prompt
summary: >-
  You cannot unit-test a prompt, so stop trying. Deterministic boundaries,
  a build that fails on a typo, golden output validated as an artifact, and
  statistical assertions with reps — the four patterns behind 493 unit tests
  and 49 browser checks on a site whose content pipeline eats markdown.
tags: [testing, llm, evals, typescript, python]
date: 2026-10-06
series: AI engineering notes
---

The honest architecture of most AI systems is: a deterministic shell, a
stochastic core, and a prompt holding them together. Testing advice usually
fails at the boundary: teams either unit-test the shell and pretend that
covers the system, or give up on automation and QA by vibes. The pattern that
survived contact with two real projects (an LLM eval harness, and this
portfolio site, which is a markdown-to-browser pipeline the content plan
hopes counts as a credible prop) is boring and general: **move work across
the boundary into the deterministic side, then test the deterministic side
ruthlessly.**

## Boundary one: the eval harness judges with rules, not opinions

The harness runs eight tool-calling scenarios against three models with two
repetitions each: 48 recorded runs. There is no LLM-as-judge anywhere in the
scoring path. Every emitted tool call is validated against the scenario's
JSON function schema, and every final answer is graded by rules like
`answer_contains`, which match case-insensitively and tolerate thousands
separators (`1301.04` matches `1,301.04`). Substring checks are dull. They
are also reproducible, and reproducibility is the entire job.

Because the core is stochastic, the assertions get two tools the shell never
needs. First, repetitions: two reps per (model, scenario) pair turn "it
failed" into "it failed 1 of 2 times," which is a different bug and a
different fix. Second, failure modes get named instead of bucketed: the
harness records `empty_content_turns` (HTTP 200, `content: null`) and
`reasoning_burn_turns` (`finish_reason=length` with empty content while
reasoning tokens burn), because a 200-with-nothing and a budget artifact are
not the same incident.

The shipped run shows why honesty at the boundary matters. One model
completed 16/16 runs at 100% valid calls, and recorded 20 empty-content
turns anyway: it kept hitting turns that returned nothing usable, and the
metric says so. The other two models were down at the broker, in
different ways: one threw a 404 "model does not exist" on eight attempts and
a 429 on the other eight (the cooldown flipping between calls), the other a
flat 500 on all sixteen. Both recorded as failures with the real HTTP error
bodies attached rather than dropped from the comparison. Latency after the
cache-bust fix reported an honest distribution: min 0.83 s, median 1.29 s,
max 3.72 s. A harness that hides any of this is marketing.

## Boundary two: a content pipeline that refuses to be fuzzy

This site renders markdown written by the same author who is trying to test
it, which is exactly the trust problem a prompt layer creates. The answer was
to make every step deterministic and loud.

**A parser with opinions.** The frontmatter format is a deliberately small
YAML subset — scalars, inline arrays, one-level nesting, folded blocks — and
anything outside the grammar throws with the offending line number. Flow
mappings, tabs, anchors: rejected. Guessing silently is how content
pipelines rot, so the subset guesses nothing.

**Schemas that are `.strict()` by contract.** Unknown frontmatter keys are a
a loud build error: `scripts/build-content.mjs` runs every file
through zod and exits 1 on any failure, printing one block per issue —
`file: <path>`, then `field: <collection>/<field>`, then `error: <message>`. A typo'd field name cannot become a feature that quietly
never renders.

**Output invariants as tests.** `src/content/content.test.ts` validates the
generated bundle against the whole-bundle schema, asserts unique slugs per
collection, date format everywhere, date-descending order, non-empty rendered
HTML per post, excerpts capped at 140 characters plus an ellipsis, and
integer reading minutes. The build sorts with slug tie-breaks so identical
inputs produce byte-stable output — which makes `generated/content.json` a
golden file: a build artifact the test suite re-validates rather than a
mystery blob.

**One security policy, both entry points.** The markdown engine's
`sanitizeUrl` allows only http/https/mailto and relative URLs (including
rejecting obfuscation like `java\nscript:`), and the frontmatter URL field is
a zod `SafeUrl` enforcing the same scheme allowlist, because `z.string().url()`
alone happily accepts `javascript:` and `data:`. One policy, two entry points,
asserted from both sides: unit tests check the generated HTML never contains
raw script tags or `javascript:` hrefs; the browser suite refetches a post
page and fails if any inline, execution-capable script survived.

## The pyramid you can actually run offline

The container is air-gapped, so the harness is plain Node. Vitest runs in the
`node` environment only — there is no jsdom package — so component tests
render through `renderToStaticMarkup` and assert structure: heading order,
hrefs, rendered content. That is 493 tests across 20 files in about 0.8
seconds, and it is genuinely useful because SSR caught a class of bugs
(client hydration) that jsdom fakes anyway.

Real behavior then moves to the browser: a self-written ~700-line CDP harness
drives real Chromium through 49 checks in 7 spec files. Security asserts CSP
`script-src 'self'` and `frame-ancestors 'none'`, nosniff and frame-deny
headers, and greps shipped markup for secret shapes (`sk-…`, `AKIA…`, bearer
tokens). Performance enforces budgets rather than aspirations: under 250 kB
of JS+CSS transferred on the home page, client-side navigation under 1500
ms, and an `<h1>` present in prerendered HTML so LCP never paints from zero.
Even nginx gets tested without nginx: `config-lint` parses the deploy config
and enforces the add_header inheritance invariant, since one location
declaring a header silently loses every server-level one.

The prompt half still needs humans, of course — that is what the two
repetitions and the named failure modes are for. Everything around it does
not, and that is the point. Push the boundary out, name what crosses it, and
test the rest like it's a compiler, because from the user's side it is.

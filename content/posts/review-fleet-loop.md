---
slug: review-fleet-loop
title: 'Twelve specialist lenses on one portfolio: what three review rounds found'
summary: >-
  Three rounds of specialist review offered 87 findings and retracted three as
  phantoms. The method, the fixes a normal pass misses, and the wall only the
  owner can cross.
tags: [ai-agents, review-methodology, quality-gates, supply-chain, portfolio]
date: 2026-10-24
readingMinutes: 7
series: AI engineering notes
---

I review my own work constantly, which is exactly the problem. The same brain
that wrote the code reads it back with the same blind spots, in the same order,
and stops at the same "looks fine." So before this portfolio launched its
current content, I stopped reviewing it myself and ran a different process:
waves of specialist reviewers, each with one narrow lens, each required to
prove what it claimed.

Three rounds later the ledger had 87 findings, 60-odd shipped fixes, and three
findings that were wrong. The wrong ones turned out to be the most useful part.

## The loop

The process is deliberately boring:

1. Run the full verification gate and record its numbers. A red baseline makes
   every later "improvement" unmeasurable, so the gate gets fixed first.
2. Dispatch four reviewers with **lenses no previous round used**. Round one
   covered zero-JS, cross-browser, plain language, maintenance. Round two:
   caching, privacy, client conversion, print. Round three: machine
   consumability, timed task walks, supply chain, and a meta-verifier that
   trusted none of the earlier claims.
3. Write a disposition that accounts for **every** finding: implement, accept
   with a reason, retract as a phantom, or mark owner-gated. Nothing silently
   dropped.
4. Implement in batches, gate green before each commit.
5. Re-review with the same four lenses against the live artifact. This is the
   quality control step, and it is where the phantoms died.

Each reviewer had to give an ID, a severity, evidence (a file and line, or a
command and its output), a specific fix, and an expected measurable effect.
A finding without evidence is an opinion, and opinions do not get implemented.

## What the lenses found that I did not

The zero-JS reviewer loaded every page the way a visitor with JavaScript
disabled sees it and found that the mobile navigation simply did not exist. The
menu was a JS-only dialog; below 768px with no JS, the only reachable links
were in the footer. The fix is a prerendered static nav revealed by a
`<noscript>` style block, and it is invisible to anyone with JS on.

The print reviewer printed the site from a dark-mode browser and got a
near-blank sheet. Browsers strip background colors when printing; the dark
palette's near-white text then sits on white paper. The print stylesheet now
forces the light palette, hides interactive chrome, and prints external link
URLs.

The caching reviewer thought the critical scripts were immutable-cached for a
year. Wrong, but the structural question underneath was not: a round-seven fix
for canonical URLs had been dispositioned as "implement this," and it was
**impossible as written**. The site origin was a hardcoded constant; the deploy
environment override only reached the feeds. Every page was telling search
engines and link previews that the canonical home was a placeholder domain that
does not resolve. The round-eight reviewer traced the real cause, and the fix
became an environment-injected origin for both bundles plus an audit gate that
fails the build if the placeholder survives.

The supply-chain reviewer found the best bug of the three rounds. CI installed
dependencies with `npm ci || npm install`, a fallback that quietly rebuilds the
tree when the lockfile disagrees. That fallback had been firing on every green
run: duplicate `@types/node` entries in `package.json` meant JSON's last-key-wins
made the effective version disagree with the lockfile. CI had not been
installing what the lockfile said for weeks. The same round found that a
truthfulness gate had been red on every pull request since it landed, because
its repo path was hardcoded to the author's private workspace. Both now fail
loudly, which is the only useful failure mode.

The machine-consumability lens asked a different question: what can an agent
answer from this site without a browser? Person structured data existed only on
the home page, so a deep link gave a machine a page with no author entity. Every
section page shipped the same site-wide description. There was no `llms.txt`.
The site now emits a Person on every page with `knowsAbout` derived from the
real tag corpus, distinct per-section descriptions, and an `llms.txt` generated
from the same content bundle that renders the pages, so it cannot drift.

And the buyer lens, playing a client with four minutes, found that nobody could
tell what to actually hire me for. The contact page now lists service areas
pulled from the site's own verified capability pages, with in-progress work
labelled. Nothing invented; the claims were already written and fact-checked.

## Three findings were wrong, and that is fine

The re-review retracted three findings:

- "Critical scripts are immutable-cached for a year." Live headers say
  `max-age=600`; the local and nginx paths say `no-store`. All three were
  correct. The reviewer had read a hashed asset header and generalized.
- "The CSS has no precompressed sibling." There are no separate CSS files.
  Styles are serialized inline per page; the finding had no object.
- "Dark-theme pages print blank." The measurement was real; the reading was
  backwards. Ink coverage of 3.7% is readable text, not a blank page.

All three are the same failure mode: a real measurement, concluded about the
wrong artifact. That is why severity requires a probe, and why the re-review
runs against the deployed site rather than the reviewer's memory. A phantom
costs one implementer batch if nobody checks; the retraction is cheap.

## The wall an agent cannot cross

Three independent lenses, in different rounds, stalled on the same thing: the
site has no published email address, no social profiles, and no resume. The
reviewers were right that this is the largest conversion gap on the site. They
were also right that it must stay empty until the owner fills it. Fabricating a
contact address would be worse than the gap.

That became a rule of the loop: owner-gated items are a deliverable, not a
failure. The disposition ends with the exact list of decisions only the human
can make, and the commands to make them. Everything else is fair game.

## The numbers

The gate went from 503 unit tests to 526 and from 53 end-to-end specs to 57,
with type and lint checks clean throughout. The audit grew from 23 to 34
prerendered pages as new content landed between rounds. Eleven scored lenses
finished at 7/10 or better, gaining 21 points in aggregate, with no lens ending
lower than it started. Every shipped fix was re-verified against the live site.

The method is the point. One reviewer is a second opinion. Four unrelated
reviewers, each forced to produce evidence, are a different kind of instrument:
they find the categories you do not have, and their disagreements tell you
where your own confidence is borrowed. Then you check their work.

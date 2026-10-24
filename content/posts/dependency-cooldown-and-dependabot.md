---
title: "A 14-day dependency cooldown, and three ways Dependabot slipped past it"
slug: dependency-cooldown-and-dependabot
summary: >-
  Harness² Workbench adopts no dependency younger than 14 days. On its first
  run Dependabot, configured with the same cooldown, proposed an end-of-life
  Node release, a lockfile with a one-day-old crate and a two-day-old uv
  image. What each gap was, and how the project closed it.
tags: [supply-chain, security, rust, open-source, developer-tools]
date: 2026-10-24
series: Harness² Workbench
relatedProject: harness2-workbench
relatedPosts: [taking-a-repository-public, security-reviews-of-a-localhost-control-plane]
---

Most malicious package releases are caught within days: someone notices a new
maintainer, an odd install script, a dependency that was never there before,
and the release is pulled. A project that waits a couple of weeks before
adopting anything new avoids most of them without reading a line of the code.
[Harness² Workbench](/writing/building-harness2-workbench) holds API keys for
cloud models and starts processes, so it adopts **no dependency version
younger than 14 days**.

This post is how that rule is enforced, and the three places on the
repository's first day on GitHub where Dependabot, configured with the very
same cooldown, proposed something the rule forbids.

## The rule, and what checks it

The policy lives in `docs/SUPPLY-CHAIN.md`. Only the crates are checked
automatically; the rest is pinned and aged by hand or by Dependabot:

- **Crates.** `cargo xtask cooldown` reads the publication time of every
  locked version, direct and transitive, from the crates.io index and fails on
  anything younger than 14 days. It runs in the local quality gate and in CI;
  on the day the repository went to GitHub it checked 475 registry packages.
- **GitHub Actions** are pinned by full commit SHA to releases at least 14
  days old, and the workflows are audited with `zizmor` by hand.
- **Tools installed in CI** (`wasm-bindgen-cli`, `cargo-deny`, `cargo-audit`,
  `cargo-cyclonedx`, `cargo-about`, `gitleaks`) are pinned to versions that
  passed the cooldown.
- **Container base images** are pinned by digest.
- **Dependabot** proposes updates with `cooldown: default-days: 14`.

Around it, `cargo-deny` fails the build on any RustSec advisory that is not
explicitly ignored with a reason (one is: an unmaintained compile-time crate),
on a licence outside an allow-list of permissive licences, on OpenSSL bindings
(rustls only) and on wildcard version requirements.

## Security fixes win

A cooldown has a failure mode of its own, and this project hit it first. The
very first lockfile, pinned strictly by age, pulled in versions of `rustls`,
`rustls-webpki`, `webpki-root-certs` and `tokio` that had known advisories,
already fixed in newer releases that were too young to adopt. Waiting two
weeks to take a security fix is the opposite of the point.

So the rule has one exception: a release that fixes a RustSec advisory is
adopted at once. Each such version goes into
`supply-chain/cooldown-exceptions.toml` with the advisory it fixes and an
expiry date (the day it would pass the cooldown on its own), and the checker
reports entries that have expired or are no longer needed. The exception is a
record with an end date, not a hole.

## Day one: three proposals the rule forbids

When the repository went to GitHub, Dependabot ran for Cargo, GitHub Actions
and Docker, with the same 14-day cooldown. It opened five pull requests. Two
were fine. Three were not, and each failed in a different way.

![October 2026: uv 0.12.24 pinned and published on October 8; uv 0.13.5, published October 22, proposed; a pull request titled uuid 1.28.0 (October 10) whose lockfile took uuid 1.29.0 (October 23)](/posts/harness2-workbench/cooldown-window.svg)

### 1. An end-of-life Node release

The runner image is based on Node 22, a long-term-support line. Dependabot
proposed `node:25-trixie-slim`. Its log shows why: it considered
`26-trixie-slim` first and skipped it "due to cooldown period": that tag had
been pushed within the last 14 days, as the tag of a maintained line is
whenever its image is rebuilt. Node 25, an odd-numbered line past its end of
life, had not been, so it passed.

For a floating Docker tag, the cooldown measures the last time the tag was
pushed, and that rewards lines that have stopped getting updates. The fix is
to stop letting the bot pick majors at all:

```yaml
ignore:
  # Node majors are picked by hand from the LTS lines (even numbers). With the
  # cooldown alone, the first run skipped 26 (its tags were rebuilt within
  # 14 days) and offered 25, an odd line past its end of life.
  - dependency-name: "library/node"
    update-types: ["version-update:semver-major"]
```

New digests of the pinned line still arrive. When the rule landed, Dependabot
closed its own pull request: "Looks like library/node is no longer being
updated by Dependabot, so this is no longer needed."

### 2. A lockfile that did not match its title

A pull request titled *Bump uuid from 1.27.0 to 1.28.0* was correct on its
face: 1.28.0 was published on October 10, just outside the window. But the
lockfile it changed contained **uuid 1.29.0**, published the day before.
Dependabot chose its target with the cooldown and then updated the lockfile
without it.

Nothing special was needed to catch it. CI ran the same check as the local
gate, on the artifact rather than on the bot's description:

```text
cooldown: 475 locked registry packages, minimum age 14 days (cutoff 2026-10-10)
  YOUNG uuid 1.29.0 (published 2026-10-23)
Error: 1 package(s) are younger than 14 days
```

The pull request was closed. The lesson is about where to enforce a policy:
on `Cargo.lock`, which is what gets built, not on a title.

### 3. A registry with no dates

The last of the three (PR #2 on GitHub) proposed uv 0.13.5 for the runner image, with a warning
on the pull request itself: *"Cooldown could not be applied because no
publication date was available from the registry."* uv's image lives on
ghcr.io, which gives Dependabot no publication date. uv 0.13.5 was two days
old, and our own cooldown check covers crates, not images, so nothing else
would have stopped it.

There is no setting that makes a missing date safe. Dependabot now ignores uv,
with the reason in a comment, and `docs/SUPPLY-CHAIN.md` gives the manual
procedure, both lookups of which were run against the version currently
pinned:

1. Take the newest release published at least 14 days earlier:
   `gh release view <version> -R astral-sh/uv --json publishedAt`.
2. Look up its multi-platform image digest:
   `docker buildx imagetools inspect ghcr.io/astral-sh/uv:<version>`.
3. Pin both in the runner's `FROM` line, and replace the vendored copies of
   uv's licence texts with those of the same tag.
4. Rebuild the images and run one container-isolated job before merging,
   because CI builds the images but runs no harness2 job inside them.

A tracking issue holds the date when 0.13.5 becomes eligible.

## The fourth failure: a bot looking for an image that is not published

The Docker update job also reported an error on its first run. The all-in-one
image is built `FROM harness2-workbench-runner:0.1.0`, an image built locally
from the repository and published nowhere, and Dependabot looked it up on
Docker Hub and got a 401. Naming the base through a build argument fixed it,
because Dependabot does not parse a `FROM` line that uses a variable:

```dockerfile
ARG RUNNER_IMAGE=harness2-workbench-runner:0.1.0
FROM ${RUNNER_IMAGE}
```

It also lets anyone build the all-in-one image on their own runner image.

## What I took from it

- **A cooldown means different things in different ecosystems.** On crates.io
  it is a publication date. On a floating Docker tag it is the last push. On
  some registries there is no date at all. Configuring the same number of
  days everywhere does not give you the same rule everywhere.
- **Check the artifact.** The lockfile and the image digest are what get
  built. The policy check that caught the uuid overshoot was not new work; it
  is the same one every push and pull request already runs.
- **Make exceptions expire.** Security fixes beat the cooldown, and each
  exception says why and until when.
- **Write the manual procedure down, with real commands.** Where automation
  cannot enforce the rule, a person has to, and the steps are only useful if
  they have actually been run.

The last post in this series is about everything else that had to be true
before the repository could be public:
[taking a repository public](/writing/taking-a-repository-public).

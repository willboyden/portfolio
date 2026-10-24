---
title: "Taking a repository public: the checklist I actually ran"
slug: taking-a-repository-public
summary: >-
  Before Harness² Workbench went public I scanned every commit for secrets and
  personal data, checked who each commit claims to be, and turned on what the
  governance files promise. Then the first code scan raised 15 alerts, and the
  release work added licence texts for every crate compiled in.
tags: [open-source, security, supply-chain, developer-tools, quality-gates]
date: 2026-10-24
series: Harness² Workbench
relatedProject: harness2-workbench
relatedPosts: [dependency-cooldown-and-dependabot, flaky-tests-a-fast-machine-hides]
---

Making a repository public cannot really be undone. Once it is visible, its whole
history can be cloned, forked, cached and indexed, along with its issues,
pull requests and every CI log. So
[Harness² Workbench](/writing/building-harness2-workbench) went public in
stages, and each stage had a checklist. This is that checklist, with what each
step found.

## 1. Nothing in the history that should not be there

A secret deleted in the latest commit is still in the history. So the scans
covered every commit, not the working tree:

- **Secrets.** gitleaks over the full history, with a release binary whose
  checksum was verified against the published one before use. It scanned 180
  commits and found nothing. The count did not match the 181 commits that
  change files, and the difference turned out to be one commit that only
  replaced a PNG screenshot, which gitleaks skips. If a scanner's count does
  not match yours, find out why before you trust the result.
- **Personal data.** A search of every line ever added, in every commit, for
  home-directory paths, machine names, internal hostnames, private network
  addresses and the names of other private projects. The only hits were the
  generic private ranges used in a configuration example and a test.
- **Identities.** Every commit records an author and a committer, with an
  email address. The repository's local Git configuration used the GitHub
  no-reply address from the first commit, and a check of every author and
  committer identity in the history showed only no-reply addresses: mine,
  Dependabot's and GitHub's. That
  includes merges made in GitHub's web interface, which take whatever email
  setting the account has, so that check is worth repeating after them.
- **Screenshots.** The project was renamed that morning, before its first push
  (another project had the first name). Seven documentation screenshots were older than the rename;
  each one was opened and checked for the old name. None showed it.
- **CI logs.** A public repository's past Actions logs become public too. The
  workflows use no secrets beyond GitHub's own token, which is masked.

## 2. Credit

harness2 is Google Research's work, and the Workbench is unofficial. The
README says so in its first lines, the project's description says "Not
affiliated with Google", and `NOTICE` credits harness2 (Apache-2.0, Copyright
2026 Google LLC) for the parts of the domain code that were translated from
it and for the harness2 output used as test fixtures.

## 3. A clean clone, not a working tree

A working tree contains files that exist only on your machine: build output,
generated assets, an ignored configuration that a test quietly reads. So
before the first push the whole gate ran from a literal `git clone` into an
empty directory outside the repository: formatting, the documentation link
checker, clippy for native and WebAssembly targets, every test, `cargo-deny`,
the dependency cooldown, the web bundle and the end-to-end suite against real
harness2. Before tagging the release it ran again from a fresh clone, with the
release build and the licence file added.

## 4. Private first

The repository went to GitHub as a **private** repository, with only `main`
pushed. That turned out to matter: the first CI runs failed four tests that had
always passed locally, and Dependabot's first proposals broke the dependency
policy in three different ways. Both stories have their own posts
([flaky tests](/writing/flaky-tests-a-fast-machine-hides),
[Dependabot](/writing/dependency-cooldown-and-dependabot)). All of it was fixed
while the repository was still private.

## 5. Turning on what the governance files promise

A `SECURITY.md` that points to private vulnerability reporting is a broken
promise until that feature is switched on. Each governance file was checked
against the repository's settings:

| Promise | Setting |
|---|---|
| `SECURITY.md`: report vulnerabilities privately | private vulnerability reporting on |
| `SUPPORT.md`: ask questions in Discussions | Discussions on |
| The issue forms label new issues `triage` | the `triage` label created |
| "Security fixes skip the cooldown" | Dependabot alerts and security updates on |
| No secrets in commits | secret scanning with push protection |
| CodeQL and Scorecard in `security.yml` | `CODE_SCANNING_ENABLED` set, after going public |
| `CONTRIBUTING.md`: changes need green CI and a review | a ruleset on `main` |

Code scanning is gated behind a repository variable because it needs a paid
plan on a private repository; the variable was set the moment the repository
became public, and the scans were started by hand.

The ruleset on `main` blocks force-pushes and deletion, and lets a pull
request merge only when ten named checks have passed and a code owner has
approved it. New commits dismiss earlier approvals. Each required check is
bound to the GitHub Actions app, so a status reported by some other integration
under the same name does not count. The code owner is me, so only my approval
counts. Because GitHub does not let anyone approve their own pull request, the
repository admin role can bypass the rule, and the docs say so. The bypass was
tested by the next push.

## 6. Reading the first code scan honestly

The first CodeQL and Scorecard run raised 15 alerts: two "critical", seven
"high", five "medium", one "low". Each one was read against the code before
anything was dismissed:

- **Two "critical" alerts for a hard-coded cryptographic salt** turned out to
  be a mock server's random-data generator: a non-cryptographic FNV hash whose
  stream-name parameter happened to be called `salt`. CodeQL reports any
  constant that reaches a parameter of that name. Renaming it to `stream`
  closed both, and the mock data is unchanged.
- **A test's failure message dumped a job's whole environment**, which would
  include the test's fake secret value. It now names what leaked, never the
  value.
- **The mock server logged raw browser reports.** They are now escaped so they
  cannot forge log lines. CodeQL does not count that escaping as a fix, so the
  alert came back and was dismissed with that reason.
- **Six alerts were dismissed**, each with its reason written on the alert. A
  "secret written to a log" was the *name* of the environment variable that
  holds a secret, not its value. A session cookie flagged for missing `Secure`
  is `Secure` whenever the site is served over HTTPS, and must not be over
  plain HTTP or the browser would drop it. One was a test's own assertion
  message. Three Scorecard findings were deliberate decisions: the admin
  bypass, a base image built locally rather than pulled, and an
  "unmaintained" advisory for a compile-time crate.
- **Five Scorecard alerts stay open,** because they are true: the repository is
  less than 90 days old, its history has no reviewed pull requests, static
  analysis has run on only a few commits, there is no fuzzing yet, and there is
  no OpenSSF best-practices badge. Dismissing them would make the dashboard
  green without making anything better.

## 7. Releasing

The code compiled into a binary carries other people's licences, and most of
them require shipping the licence text. A `cargo xtask licenses` command now
writes the licence texts of every crate compiled into the servers and the web
UI, ten licences in all, with `cargo-about`, using the same allow-list as
`cargo-deny` and skipping test and build dependencies. The release workflow
puts that file in every archive, and the all-in-one image carries it. The runner image copies the `uv`
binaries from uv's own image, which carries no licence file, so uv's licence
texts are vendored from the pinned tag. Their Git blob hashes match the
upstream files exactly.

The release itself is a workflow, not a laptop build. A binary built on a
developer's machine embeds that machine's paths, and nobody else can verify
how it was made. On a version tag the release workflow checks that the tag matches the
workspace version, builds both Linux targets with the web UI embedded, adds
the licence file, writes a CycloneDX SBOM and checksums, attaches GitHub
build-provenance attestations, and opens a **draft** release. A person
downloads one archive, checks its checksum and provenance, runs the binary
and the demo, and only then publishes the draft. A published tag is never
moved: a broken release gets a new patch version.

[Version 0.1.0](https://github.com/willboyden/harness2-workbench/releases/tag/v0.1.0)
went out that way on 24 October 2026. The checksums of both archives and the
SBOM matched, GitHub's provenance record for the three files named the release
workflow at the `v0.1.0` tag, and the downloaded binary served the web UI and
ran the demo to the same numbers the README shows.

## The checklist, short

1. Scan the whole history for secrets, and reconcile the scanner's count.
2. Search every added line for personal and internal data.
3. Check every author and committer identity, again after web merges.
4. Open every image the repository ships.
5. Credit upstream work in `NOTICE` and the README; ship third-party licences.
6. Run the full gate from a literal clone outside the tree.
7. Go private first, let CI and the bots run, fix what they find.
8. Turn on every setting the governance files promise, and protect `main`.
9. Read each code-scanning alert against the code; dismiss with reasons; keep
   the true ones open.
10. Release from CI, as a draft that a person verifies before publishing.

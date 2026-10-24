# Round 9 disposition — decided by orchestrator 2026-10-24

Fleet: R9-A LLM/agent consumability (6/10) · R9-B cold-stranger task walkthrough (8/10) ·
R9-C dependency/supply-chain/CI (6/10) · R9-D meta-verifier (independent cross-round audit).
Reports: `reviews/round9/`.

## Implemented this round

- **R9C-1 HIGH**: `truthfulness_check.py` had a hardcoded `/opt/data/workspace/...` repo
  path — FileNotFoundError on every CI run, so the R12 truthfulness gate never ran.
  Fixed: repo-root-relative (`Path(__file__)`), and proof pointers OUTSIDE the repo
  (the owner's private workspace, `/usr/bin/ffmpeg`) are recorded as owner-verify notes,
  not failures — they can never exist on a runner; in-repo proof paths still fail the
  build when missing. Verified: `--fast` exits 0 locally.
- **R9C-3 HIGH**: `npm ci || npm install --legacy-peer-deps` silently swallowed lockfile
  drift — and had been doing so live (the lockfile root said `^26.6.5` while the effective
  package.json said `^22.0.0`; every recent green CI run was a silent fresh install).
  Fixed BOTH halves: the drift itself (R9C-4) and the fallback (now `npm ci || loud
  annotation + exit 1`). Verified: `npm ci` passes clean with no fallback.
- **R9C-4 MEDIUM**: `@types/node` + `typescript-eslint` were declared TWICE in
  devDependencies (remote R8-R12 waves + round-7 wave both added them; JSON last-key-wins
  made the second entries effective while the lockfile pinned the first). Deduped to the
  tested versions and regenerated the lockfile to match — the install is now
  deterministic for the first time.
- **R9C-5 MEDIUM**: the R12 debug step auto-committing npm logs to the public `ci-debug`
  branch on failure removed (log can carry env/URL fragments; installs are deterministic
  now). Documented in the workflow.
- **R9C-7 LOW**: unquoted `$f` loop var in security-audit.yml secret scan quoted.
- **R9C-6 MEDIUM**: the vendored-emotion trust model documented in CONTRACT §1
  (trust-by-commit, notices in THIRD-PARTY-NOTICES.md, registry deps pinned by lockfile).
- **R9A-1 HIGH**: Person entity existed only on the homepage. Now every page's JSON-LD
  binds `about: {Person @id …/#person}`; the Person node's `knowsAbout` derives from the
  site's own tag corpus (top 8 real tags) instead of 3 hardcoded strings.
- **R9A-2 MEDIUM**: JSON-LD headline/name leaked tab-title chrome (" — Projects") and
  section pages shipped the site-wide boilerplate description. Fixed: `entityName()`
  strips the segment; six real per-section descriptions in route-meta.
- **R9A-3 MEDIUM**: /now freshness was prose-only. Now: real `<time dateTime=…>` in the
  h1 + CollectionPage `dateModified` from the newest content date; test pins the shape.
- **R9A-5 MEDIUM**: post tags were invisible to machines. Article JSON-LD now carries
  `keywords` from frontmatter tags.
- **R9A-6 MEDIUM**: `llms.txt` generated at prerender from the content bundle (site map,
  person, projects/writing/capabilities with dates+tags) — can never drift from what
  ships; `audit-dist` fails if it's missing.
- **R9A-7 MEDIUM**: /contact emitted a generic CollectionPage. Now ContactPage (with
  Person binding); `contactPoint` appears only when SITE.email is set (hide-don't-fabricate).
- **R9A-8 LOW**: robots.txt documents the deliberate blanket AI-crawler allowance.
- **R8D-9 LOW** (meta-verifier find): og:image:alt double-prefixed the site name — now
  just the page title.
- **R9B-1 MEDIUM**: the /now → /contact "Check availability" loop ended in the unset-email
  dead end. One honest line on /now sets the expectation before the click.

## Accepted / owner-gated (documented)

- **R9C-2 HIGH (owner action)**: no branch protection on `main` — direct pushes deploy
  immediately. Recommended exact command for the owner:
  `gh api -X PUT repos/willboyden/portfolio/branches/main/protection -f required_status_checks[0].context=build -F enforce_admins=false -F required_pull_request_reviews=null -F restrictions=null --input -` (or via Settings → Branches). An agent must not change the repo's protection settings unilaterally.
- **R9B-2 LOW** ("Start here" chip on the projects grid): design-taste change on a tuned
  surface; accepted as backlog, not implemented.
- **R9B-3 LOW**: availability is inference from the "Available for" list — the honest
  status line is owner-gated (same gate as R8C-4).
- **R9B-4 LOW**: tag chips are client-side only (no `?tag=` deep links). Accepted;
  router-state feature for a future round.
- **R9C-8 LOW**: dependabot flood guard — config already groups + limits; accepted.
- **R9A-4 MEDIUM (partial)**: projects render no `<time>`/tags in cards — the card design
  is R2-D-tuned; the machine-readable surface exists via llms.txt (dates + tags per
  project) and sitemap lastmod. Card-level `<time>` accepted as backlog to avoid
  re-litigating the round-2 design.

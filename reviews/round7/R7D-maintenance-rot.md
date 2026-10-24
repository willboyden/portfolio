# R7-D — Maintenance / Content-Rot Review

**Lens score: 5/10** — "6-month survivability"

_The owner is a busy engineer who last deployed content/code in late 2026. The site must survive him NOT touching it. This lens checks what breaks, drifts, or embarrasses in 6–18 months of neglect._

---

## Findings

### R7-A — Build gate rot (typecheck + lint both RED at HEAD)

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7A-01 | BLOCKER | `npm run typecheck` fails with `TS2688: Cannot find type definition file for 'node'`. `tsconfig.json:31` has `"types": ["vitest/globals", "node"]` but `@types/node` is **not** a devDependency of the project (not in `package.json`, not installed in `node_modules/@types`). On a fresh `npm install` this environment cannot resolve node types, so the first gate of `npm run verify` is red. This same gate was **green** at round-6 closeout per R5 verdict ("SHIP-READY", all 5 gates green). **New rot between rounds 6→7.** | Add `@types/node` to `package.json` devDependencies (or ensure offline-deps linker provides it). |
| R7A-02 | BLOCKER | `npm run lint` fails with `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript-eslint' imported from eslint.config.js`. `eslint.config.js:2` imports `typescript-eslint` but the package is absent from `node_modules` and **not** listed in `package.json` devDependencies. Same provenance as R7A-01: the gate was green at round-6 closeout, red now. **New rot between rounds 6→7.** | Add `typescript-eslint` to `package.json` devDependencies, or restructure `eslint.config.js` to avoid the import. |

### R7-B — Deploy workflow gate-chain fragility

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7B-01 | HIGH | The 8-step CI gate chain (typecheck→lint→unit→build→e2e→Pages-base-rebuild→prerender→audit→deploy) now **fails at steps 1 and 2** on a clean `npm install` (verified locally). Even if all gates were green, the e2e harness crashes with `EADDRINUSE 127.0.0.1:4321` when `npm run preview` (port 4321) is already running — no graceful port‑fallback or diagnostic message. |
| R7B-02 | MEDIUM | The "Rebuild with Pages base path" step (workflow line 71‑79) re‑prerenders with a subpath base (`/${repo}/`) and re‑runs `audit-dist`, but **does not re‑run e2e**. The artifact that passed e2e (root‑base dist) is **not** the artifact that ships to GitHub Pages (subpath base). The shipped artifact has received less testing than the gated one. |
| R7B-03 | MEDIUM | `npx --yes @puppeteer/browsers install chrome-headless-shell@stable` uses a **floating tag** (`@stable`). Every CI run installs whatever "stable" is at that moment — a supply‑chain / reproducibility risk. No pinned version locks the browser binary. |
| R7B-04 | MEDIUM | The deploy workflow assumes `package-lock.json` will "land on the next host-side push" (workflow line 36‑38) but it **never has** — the file exists on disk but is **untracked** in git (`?? package-lock.json`). Without it, `npm install` resolves `^` ranges fresh each time, enabling silent dependency drift. With it hypothetically committed, `npm ci` pins exact versions. The lockfile's absence from git is a dangling promise. |

### R7-C — Committed build artifact drift: `prerender-built/entry.mjs`

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7C-01 | MEDIUM | `prerender-built/entry.mjs` is **tracked in git** and currently **modified** (`git status: M`). Every `npm run build` (vite → prerender bundle) overwrites it, so the tracked copy diverges from the build output. This was previously dispositioned as "known-and-tolerated" (R3-A F11 / round-6 battery) for dotfile/gzip concerns, but the **active dirtiness + git tracking** is a new measurable state: the committed artifact no longer matches HEAD. |

### R7-D — heroImage schema field with zero UI consumption

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7D-01 | MEDIUM | `src/content/schema.ts:79` defines `heroImage: z.string().min(1).optional()`. The schema accepts any non‑empty string, but **no component in `src/` renders heroImage** — grep shows the field is consumed only in `schema.ts` itself. A post with `heroImage: https://example.com/nonexistent.png` passes `build-content.mjs` **silently** (exit 0), the field is never read by any UI component, and no build error or visual regression catches it. This contradicts the project's `.strict()` philosophy ("unknown keys are build errors") and creates a silent no‑op surface. |

### R7-E — package-lock.json untracked; no dependabot/renovate

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7E-01 | HIGH | `package-lock.json` exists on the workstation but is **untracked** in git (`?? package-lock.json`). The deploy workflow (line 36‑38) promises it "lands on the next host-side push" but it never has. No `dependabot.yml`, `renovate.json`, or `.github/automerge` config exists. All dependencies use `^` ranges. Over 6‑18 months, a fresh `npm install` (or CI `npm ci` after a hypothetical lockfile commit) could resolve to different minor/patch versions, and no automated gate would catch drift. |
| R7E-02 | MEDIUM | The offline‑deps linker (`scripts/link-offline-deps.sh`) was designed for a container at `/opt/hermes/node_modules`; the README's "Quick start (offline / this repo)" assumes that environment. The actual deployment path is GitHub Pages CI + `npm install` + `^` ranges, which CONTRACT.md §31 explicitly warns against ("do not run `npm install` — it cannot succeed"). Docs rot between CONTRACT, README, and the real CI reality. |

### R7-F — REVIEW_LOG.md traceability gap: R7-tagged commit absent from log

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7F-01 | MEDIUM | Commit `8672a15` (2026‑10‑10) is titled "Internet-era upgrades (R7)" and added the GitHub Pages deploy workflow, audio/video provider changes, and the deploy workflow gate chain itself, but **REVIEW_LOG.md has no round-7 entry**. The log records rounds 1‑6 and its closeout states round 6 is the latest, but HEAD already contains R7‑tagged changes. Institutional knowledge is split between the log and git history; future reviewers cannot rely on the log alone. |

### R7-G — CONTRACT/README environment rot

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7G-01 | MEDIUM | CONTRACT.md §31 says "do not run `npm install` — it cannot succeed" (no network egress). On the actual workstation, `npm install` **succeeds** (node_modules installed via `/opt/hermes/node_modules` or from the registry if network available). The README's "Quick start (offline / this repo)" targets the offline-deps linker container but the real deployment path is GitHub Pages CI + `npm install` + `^` ranges. The three documents (CONTRACT.md, README.md, actual CI) are mutually inconsistent. |
| R7G-02 | LOW | README claims "npm run deps # symlink node_modules from /opt/hermes/node_modules" — on a non‑container host this symlink farm either has no effect (all packages already real dirs) or creates dangling symlinks for packages not yet installed. The quick start does not match the actual host deployment reality. |

### R7-H — Broken images in markdown body

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7H-01 | MEDIUM | `scripts/build-content.mjs` / the vendored markdown engine have **no image‑path existence validation**. A post body containing `![A diagram that doesn't exist](/assets/nonexistent-image.png)` silently renders an `<img>` tag in the generated HTML. The build passes with exit 0; no line number, no error; the broken image only appears at read time. |

### R7-I — /now date hardcoded in code, not content

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7I-01 | LOW | `src/pages/Now.tsx:184` hardcodes `Last updated October 2026` in an `<h1>`. The adjacent Stamp component says "Updated when the picture changes — not on a calendar," contradicting the fixed date. The date is **not** in content frontmatter; updating it requires a code change + redeploy. Minor DX trap but measurable aging. |

### R7-J — Project status "active" going stale

| ID | Severity | Evidence | Fix |
|----|----------|----------|-----|
| R7J-01 | LOW | `content/projects/langfuse-dashboard.md:17` has `status: active` — the only project with that status among 8. In 6‑18 months without an owner update, "active" reads stale relative to reality. Mild will‑age‑badly (self‑declared field, no automatic expiration). |

---

## Disposition recommendations

| Finding | Recommendation | Owner | ETA |
|---------|---------------|-------|-----|
| R7A‑01, R7A‑02 | Add `@types/node` and `typescript-eslint` to `package.json` devDependencies; restore the typecheck/lint gate chain so `npm run verify` passes locally and in CI. | Owner / CI maintainer | < 1 day |
| R7B‑01 | Fix e2e port conflict: make `serve-dist.mjs` handle `EADDRINUSE` gracefully (log + choose next port). Add a port‑check probe before the harness starts. | Owner | < 2 days |
| R7B‑02, R7B‑04 | Commit `package-lock.json` (or generate it in CI and commit the file) so `npm ci` pins dependencies. Add `dependabot.yml` (or `renovate.json`) for automated dependency updates. | Owner / repo admin | 1‑2 weeks |
| R7B‑03 | Pin the Chrome version in the CI step: `chrome-headless-shell@<exact‑version>` or use an `action` that returns a hash for reproducibility. | Owner | < 1 day |
| R7C‑01 | Either (a) remove `prerender-built/` from git tracking (add to `.gitignore`) and regenerate on deploy, or (b) accept the dirtiness as a known convention and document it in `REVIEW_LOG.md` / `CONTRIBUTING.md`. | Owner | 1 day |
| R7D‑01 | Remove `heroImage` from `ProjectSchema` / `PostSchema` if the field is never rendered, **or** add a runtime check / UI component that uses it, **or** add a build‑time lint rule that flags unused schema fields. | Owner / UI engineer | 1‑3 days |
| R7E‑01 | Commit the existing `package-lock.json` (it already exists on disk) and add `dependabot.yml`/`renovate.json` for automated updates. If the lockfile must remain untracked (offline policy), add a CI step that validates lockfile integrity against a known‑good baseline. | Owner / CI maintainer | 2‑3 days |
| R7F‑01 | Add a round‑7 entry to `REVIEW_LOG.md` summarizing commit `8672a15` changes (Pages deploy workflow, audio providers, gate chain). Link from the closeout section to the new `reviews/round7/` directory. | Owner / reviewer | < 1 day |
| R7G‑01, R7G‑02 | Align CONTRACT.md, README.md, and actual CI expectations: either (a) rewrite the "Quick start" for the GitHub Pages CI + npm install reality, or (b) enforce the no‑network rule and move the project to an air‑gapped CI setup. | Owner | 1‑2 weeks |
| R7H‑01 | Add markdown-image existence validation in `scripts/build-content.mjs` (check that referenced image files exist under `public/` or fail with file:line). Alternatively, document that markdown images are unsupported / must reference absolute URLs only. | Owner | 2‑3 days |
| R7I‑01 | Move the "Last updated" date out of `Now.tsx` h1 and into content frontmatter (e.g., a `now.md` root‑level markdown) or make it dynamically computed from git log. | Owner | 1 day |
| R7J‑01 | Add a CI or lint check that flags `status: active` projects older than N months, or simply remove the `active` status from langfuse-dashboard.md and use `shipped` / `archived` instead. | Owner | < 1 day |

---

## Lens score: 5/10

_Why 5 and not higher?_ Two build gates (typecheck, lint) were green at round‑6 closeout and are now red at HEAD — dependency rot has already invaded the gate chain between rounds. The deploy workflow is double‑red (typecheck + lint block). The `prerender-built/entry.mjs` artifact is tracked + dirty. The heroImage field is a silent no‑op. The lockfile promise is unfulfilled. A round‑7 batch already shipped (commit `8672a15`) but the review log has no round‑7 entry, fragmenting institutional knowledge. These are accumulative rot factors that, left unaddressed, will prevent the owner from pushing to main and having the site deploy via GitHub Pages without manual intervention.

_Why not lower?_ The unit test suite (503 tests) still passes, the audit gate (AUDIT OK 23 pages) still runs clean, and the core content pipeline (build-content → content.json → vite → prerender) remains functionally intact. No data is silently corrupted; the breakages are at the gates (developer ergonomics) and at the edges (dead schema fields, drifted docs). The site would still **render and serve** if the owner ran `npm run build` + `npm run preview` on a machine with the correct node_modules layout. Survivability is limited by gate fragility and docs rot, not by catastrophic failure.

---
*Report generated 2026‑10‑23 by R7-D, maintenance/content‑rot reviewer. Cross‑referenced REVIEW_LOG.md (rounds 1‑6), REVIEW_ROUND1.md, git log (including R7‑tagged commit 8672a15), and destructive probes in /tmp/opencode/rot-probe.*
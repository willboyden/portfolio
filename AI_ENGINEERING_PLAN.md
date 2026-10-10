# AI_ENGINEERING_PLAN — v1 (PLAN STAGE, nothing built yet)

Author: plan-stage subagent, 2026-10-10. Scope of this document: information
architecture, content schema, content sourcing, page design, and the v1
builder split for a new **AI Engineering** section on the portfolio. Nothing
here is implemented; every evidence path below was verified to exist on this
workstation on 2026-10-10 unless marked otherwise.

Ground rules inherited from `CONTRACT.md` (this file defers to it):
Emotion-only styling, tokens only, `$`-prefixed transient props, no invented
packages, a11y mandatory, prerendered content via `scripts/build-content.mjs`,
base-aware router (`/portfolio/`), no git commits by builders.

---

## 1. Information architecture

### 1.1 Routes (additions to `src/app/App.tsx`)

```
/ai-engineering                 → hub page (new page component AiEngineering)
/ai-engineering/:slug           → capability detail template (AiCapabilityDetail)
                                   slug ∈ { local-inference, video-generation, smart-routing }
                                   unknown slug renders NotFound (same rule as ProjectDetail)
```

Subsection slugs are content-driven (one `.md` file per capability in
`content/ai-engineering/`), but the three v1 slugs are fixed as above so
prerender paths, nav, and cross-links are stable.

Prerender impact: `prerender/entry.ts:prerenderPaths()` gains 4 paths (hub +
3 details) → **27 prerendered pages** (23 today). `scripts/audit-dist.mjs`
auto-discovers `index.html` files, so the audit count updates itself.
`sitemapPaths` picks the new routes up automatically (they are not `/404`).

### 1.2 Nav placement decision — **add a 7th top-level item, gated**

Current state (verified): `Nav.tsx:NAV_ITEMS` declares 8 entries;
`availableNavItems()` filters out `/videos` and `/talks` because
`content.videos.length === 0` and `content.talks.length === 0`. Visible today:
**Home, Projects, Writing, Now, About, Contact = 6 items.**

**Decision: add `AI Engineering → /ai-engineering` as a 7th visible item.**

Rationale:

1. **The section is the portfolio's differentiator, and it is not a project.**
   Projects are artifacts (repos, demos, metrics). This section is *evidenced
   capability*: methods, proof, and honest limits across a fleet of tools
   (broker, router, bench, RAG store, worker fleet). Nesting it under Projects
   would force capabilities into an artifact schema they don't fit and bury
   the strongest hiring signal three clicks deep.
2. **The narrative arc already points here.** The Writing section's series
   badge literally reads "AI engineering notes — post N of 6" (REVIEW_LOG
   R6-C C2 fix). A visitor reads *about* the work in Writing; AI Engineering
   shows the work; Contact closes. A top-level item completes that arc.
3. **The empty-section failure mode is already solved.** The same
   content-driven guard that hides Videos/Talks extends naturally:
   `if (item.to === '/ai-engineering') return content.aiCapabilities.length > 0;`
   The item can never ship as an empty advertised tab.
4. **Duplication is resolved by cross-links, not omission.** Some evidence
   artifacts are also portfolio projects (e.g. `orchestrator`). The rule:
   capability pages *cite* them as proof paths and *link* them via
   `relatedProjects`; they are never duplicated as Project entries.

Alternatives considered and rejected:

- **Nest under Projects** (card on `/projects` + subnav): cheapest, but the
  section's identity is "what I can do and how I prove it", not "another
  repo". Also projects grid filters/tags would need a fake project entry to
  host it — schema abuse.
- **Merge into Writing** as a series: Writing is prose-first; this section is
  proof-first (numbered methods + evidence grid). Merging weakens both.
- **Footer-only link**: hides the differentiator; footer nav duplication is
  already an accepted R6-C C7 disposition, not a substitute for IA.

Overflow risk of a 7th item (the one real cost): the desktop nav renders
`white-space: nowrap` links at `font.sizes.sm`. Between the `md` breakpoint
(~768px, where Header switches to the mobile menu) and ~1024px, seven items
with the longest label "AI Engineering" could crowd the header. Mitigations,
(a) R6E-1 already added `overflow-wrap: anywhere` wrapping to nav link classes
nav link classes — long labels wrap instead of overflowing; (b) Builder D must
add a CDP e2e at the md–lg band asserting no horizontal overflow of the header
with all 7 items visible; (c) if it still overflows, fall back to label
"AI Eng." — decision recorded in FINDINGS.md, never silently.

Mobile: the mobile menu stacks items vertically; a 7th item costs one row and
zero risk.

### 1.3 Footer + sitemap

Footer's sitemap column gains the same item (it mirrors nav; R6-C C7 accepted
that duplication deliberately). Sitemap/robots pick up the routes via the
existing prerender exports.

---

## 2. Content model

### 2.1 `AiCapabilitySchema` — addition to `src/content/schema.ts`

Follows the existing house pattern: shared base fields, `.strict()` (unknown
frontmatter key = build error), build-time slug cross-validation.

```ts
export const AiCapabilityStatus = z.enum(['offered', 'in-progress', 'shipped']);

/** One evidence bullet. `path` cites the build workstation's workspace —
 * rendered as monospace citation text, never a hyperlink (no public URL). */
export const AiProofSchema = z
  .object({
    claim: z.string().min(1),
    path: z.string().min(1),
  })
  .strict();

export const AiCapabilitySchema = z
  .object({
    ...baseShape,                      // slug, title, summary, tags, date
    capability: z.string().min(1),     // display name, e.g. "Local LLM inference"
    oneLiner: z.string().min(1),
    status: AiCapabilityStatus,
    stack: z.array(z.string().min(1)).min(1),
    howItWorks: z.array(z.string().min(1)).min(3).max(6),
    proof: z.array(AiProofSchema).min(3).max(6),
    limits: z.array(z.string().min(1)).min(1),   // honest constraints — mandatory
    relatedPosts: z.array(Slug).optional(),
    relatedProjects: z.array(Slug).optional(),   // extension beyond the brief; see note
    /** Long-form body rendered from markdown below the frontmatter. */
    html: z.string().optional(),
  })
  .strict();

export type AiProof = z.infer<typeof AiProofSchema>;
export type AiCapability = z.infer<typeof AiCapabilitySchema>;
```

Notes:

- `relatedProjects` is one field beyond the minimum brief. It is required by
  the approved page design ("related posts/projects cross-links") and it
  reuses the exact pattern already shipped for posts/projects (R6-C C1:
  slugs validated at build time, typo fails the build). Cost ≈ zero.
- `date` semantics: **"evidence verified as of"** date, displayed in the
  detail hero. Capabilities age; the date keeps the claim honest.
- `status` semantics (enforced by convention in §3, not by zod):
  - `shipped` — artifacts exist today and are re-verifiable on demand.
  - `in-progress` — real artifacts exist but carry an environment caveat
    (documented in `limits[]`).
  - `offered` — described and prepared (skill/playbook exists) but **no local
    run artifacts yet**; proof bullets then point at the capability
    description honestly, never at invented runs.
- `SiteContent` / `SiteContentSchema` gain `aiCapabilities: AiCapability[]`.

### 2.2 Frontmatter encoding — the parser subset is the constraint

`vendor/markdown/src/frontmatter.ts` supports: quoted/plain scalars (no `: `
inside unquoted scalars), inline `[a, b]` arrays, `>-` folds, block sequences
of scalars, and nested mappings — **but not sequences of mappings**. The
existing workaround for arrays-of-objects is `metrics: - label = value`
strings expanded in `build-content.mjs` (split on first `=`). Proof uses the
same mechanism:

```yaml
proof:
  - Broker playbook: failure taxonomy, probe scripts, forensics recipes = /opt/data/skills/mlops/local-llm-broker/SKILL.md
  - Fleet pulse + repair runbook generator, 18-test pytest suite = /opt/data/workspace/broker-tools
```

Expansion rule (Builder A implements, mirroring the `metrics` block in
`loadCollection`): strings containing `=` split at the **first** `=` into
`{ claim, path }`; both sides trimmed. **Authoring rule: claim text must not
contain `=`** (reword — e.g. write "p50 under 2 ms", not "p50 = 2 ms"). Paths
contain no `=`. This rule goes in the content file header comment of each
`.md` and in this plan's builder brief.

Full file shape (`content/ai-engineering/local-inference.md`):

```markdown
---
slug: local-inference
title: Local LLM inference
summary: >-
  Serve, probe, and benchmark open-weight models through an OpenAI-compatible
  broker on a single-GPU host — with a failure taxonomy that refuses to call a
  listed model healthy.
capability: Local LLM inference
oneLiner: >-
  One GPU, twenty-one model groups, honest health: inventory, probes,
  benchmarks, and runbooks for a LiteLLM/vLLM/SGLang fleet.
tags: [llm, vllm, sglang, benchmark, litellm]
date: 2026-10-10
status: shipped
stack: [LiteLLM broker, vLLM, SGLang, Python stdlib, DuckDB]
howItWorks:
  - List model groups from GET /models, then health-probe each one — a listed group is not a healthy group.
  - Classify every failure by latency and response body (engine down vs bad upstream name vs GPU contention) before calling anything dead.
  - Benchmark sequentially with cache-busting (unique user field + prompt nonce), logging finish_reason and reasoning burn per turn.
  - Re-test any surprising throughput claim adversarially (ascending and descending concurrency ladder) before believing it.
  - Convert persistent DOWN groups into an operator-ready repair runbook instead of narrating failures.
proof:
  - Broker playbook — failure taxonomy, probe scripts, engine forensics = /opt/data/skills/mlops/local-llm-broker/SKILL.md
  - Tested fleet tooling — pulse, bench, runbook generator, 18-test suite = /opt/data/workspace/broker-tools
  - Controlled 50-probe cache experiment proving full-body response caching = /opt/data/workspace/cache-lab
  - Adversarial replay ruling out order-drift in a throughput-collapse claim = /opt/data/workspace/adversarial
  - Deterministic tool-call scoring harness with dashboard = /opt/data/workspace/model-quality-harness
limits:
  - One large model is resident at a time; most listed groups are dead by construction on a single-GPU host.
  - Engines can only be restarted by the operator — the container has no GPU, no daemon socket, and a /v1-only broker allowlist.
  - Identical request bodies hit the broker cache in ~0.02 s; latency numbers without cache busting are fiction.
  - GET /models 200 does not mean inference works — probe a chat completion before relying on a group.
relatedPosts: [eval-harness-silent-regressions, langfuse-observability-pragmatic]
relatedProjects: [model-quality-harness]
---

Optional long-form body (rendered markdown), used sparingly.
```

This example is the authoring template for all three files.

### 2.3 Builder wiring — `scripts/build-content.mjs`

1. `COLLECTIONS` gains `{ dir: 'ai-engineering', schema: AiCapabilitySchema }`
   (import the schema alongside the existing four — the script already imports
   TS via Node type-stripping).
2. Proof expansion: extend the existing `metrics` expansion block to also
   expand `entry.proof` when it is an array of strings containing `=`.
3. Cross-link validation (extend the existing R6-C C1 block):
   `relatedPosts` entries must match post slugs; `relatedProjects` entries
   must match project slugs. Typo = exit 1.
4. **`contentHash` body must include `aiCapabilities`** — the hash is built
   from an explicit body object (`{ projects, posts, videos, talks }`); add
   the new array or the new content never changes the hash. Explicit task,
   easy to forget, breaks byte-stability claims silently if missed.
5. Slug uniqueness check: the existing loop over `Object.keys(out)` covers the
   new collection automatically once it is in `out`.
6. **Proof-path verification is local-only.** CI (GitHub Pages deploy) cannot
   see `/opt/data/...`. `build-content.mjs` therefore validates proof *format*
   only. Add a `--verify-proof-paths` flag that stats each `proof[].path` and
   exits 1 on a missing path; the local gate battery runs it, CI does not.
   This keeps evidence honest at authoring time without breaking deploys.
7. `src/content/index.ts` gains `getAiCapability(slug): AiCapability | undefined`
   (additive; CONTRACT §4 amendment listed in §5).

---

## 3. Content sourcing — three subsections, real evidence

All paths verified to exist on 2026-10-10. Statuses assigned by the §2.1
rules. Proof bullets below are paste-ready frontmatter (claim `=` path).

### 3.1 `/ai-engineering/local-inference` — status: `shipped`

Story: open-weight models served on a single-GPU host behind an
OpenAI-compatible broker; the hard part is not serving, it is *knowing what
is actually up, how fast, and why it failed*.

Proof bullets (5):

1. Broker playbook — failure taxonomy (engine down vs bad upstream name vs
   GPU contention), probe scripts, engine/quant forensics
   `= /opt/data/skills/mlops/local-llm-broker/SKILL.md`
2. Tested fleet tooling — `fleet_pulse.py` cache-busted fleet-wide pulse,
   `bench.py` concurrency ladder, `repair_runbook.py` → operator runbook,
   18-test pytest mock-HTTP suite, hourly-pulse history JSONL
   `= /opt/data/workspace/broker-tools`
3. Controlled 50-probe cache experiment — confirmed full-body response
   caching (~0.02 s cached vs ~0.16–0.30 s real floor) and the `user`-field
   bust `= /opt/data/workspace/cache-lab`
4. Adversarial replay of a throughput-collapse claim — ascending/descending
   ladder ruled out order drift; found aggregate tok/s is tail-dominated
   `= /opt/data/workspace/adversarial`
5. Tool-call reliability harness — deterministic tool simulation + rule-based
   scoring, dashboard from real results JSON
   `= /opt/data/workspace/model-quality-harness`

Supporting facts for prose (verified live 2026-10-10): `GET
http://litellm-broker:4000/v1/models` returns **21 model groups** (qwen3.8
vLLM/SGLang variants, glm-5.3 cluster groups, gpt-oss-120b, llama-3.3-70b,
nomic-embed, …). Hourly pulse cron job registered (`fleet-pulse-hourly`,
id `3a549ee9b0df`, `/opt/data/cron/jobs.json`) — with the documented caveat
that it only fires when the gateway runs.

`howItWorks` (5 steps): see the §2.2 example.

`limits` (4): single resident model per GPU; operator-only engine restarts
(no GPU, no daemon socket, `/v1`-only allowlist — `/health`, `/metrics` 403);
cache hygiene mandatory for honest latency; `GET /models` 200 ≠ inference.

Cross-links: `relatedPosts: [eval-harness-silent-regressions,
langfuse-observability-pragmatic]`, `relatedProjects: [model-quality-harness]`.

### 3.2 `/ai-engineering/video-generation` — status: `in-progress`

Story: programmatic video pipelines that run where diffusion stacks can't —
a Manim CE MCP server plus a zero-dependency Pillow+ffmpeg frame pipeline —
with the diffusion lane (ComfyUI) honestly declared *offered, not yet
exercised here*.

Proof bullets (5):

1. MCP server for Manim rendering — stdlib JSON-RPC over stdio, tools
   `scene_list` / `scene_render` / `output_list`, 12 tests
   `= /opt/data/workspace/projects/animated-explainer/explainer_mcp.py`
   (tests: `test_explainer_mcp.py` in the same directory)
2. Seven rendered videos on disk (2026-07-10): project explainers for
   code-quality-dashboard, mini-task-manager, static-site-gen,
   static-site-generator, system-monitor, wiki-search, animated-explainer
   `= /opt/data/workspace/projects/animated-explainer/project_videos`
3. First-party Pillow+ffmpeg pipeline skill — section-function template,
   564-frame (~23.5 s) pattern, faststart/moov pitfall, palette +
   troubleshooting references `= /opt/data/skills/creative/animated-videos`
4. Manim CE authoring playbooks — explainer scenes and 3Blue1Brown-style
   math/algorithm animation patterns
   `= /opt/data/skills/creative/manim-explainer` and
   `= /opt/data/skills/creative/manim-video`
5. Runnable today in this container: ffmpeg 7.1.5 (`/usr/bin/ffmpeg`) and
   Pillow 12.3.0 verified installed — the Pillow lane needs no GPU
   `= /usr/bin/ffmpeg` (and skill scripts under the animated-videos path)

`howItWorks` (4 steps):
1. Author scenes as code — Manim CE `Scene` classes, or Pillow section
   functions drawing frame-by-frame with progress `t ∈ [0,1]`.
2. Render frames headlessly — `manim` CLI via the MCP server, or Pillow PNG
   sequences at 24–30 fps.
3. Stitch with ffmpeg — libx264, `yuv420p` chroma for player compatibility.
4. Ship web-ready — re-mux with `+faststart` so the `moov` atom leads; scan
   bytes to verify before calling an MP4 browser-playable.

`limits` (4) — this is where the honesty lives:
- No GPU diffusion stack in this container: no `comfy` binary, no weights, no
  ComfyUI workspace — the ComfyUI skill (third-party, hardware-check +
  cloud-fallback design) is **offered**, not yet exercised locally.
- Manim is not currently importable in the container (verified
  2026-10-10); renders above date from 2026-07-10. Regeneration needs the
  environment reinstalled — stated, not hidden.
- Typography constrained to installed fonts (DejaVu/Liberation/Noto) — the
  same font reality as the portfolio itself.
- Frame pipelines are CPU-bound: ~100+ frames at 1280×720 PNG ≈ hundreds of
  MB of transient disk; frames are always cleaned up after stitching.

Cross-links: none available yet — the six existing posts do not cover video.
Schema fields are optional; the detail template must render the related
section as *absent*, never as an empty box (same honesty rule as R6-C C5).
This is the one subsection where `relatedPosts`/`relatedProjects` stay unset.

### 3.3 `/ai-engineering/smart-routing` — status: `shipped`

Story: making a fleet of MCP servers actually usable — deterministic NL→tool
planning with guardrails, measured per-tool latency, a same-process
orchestrator, FTS5 RAG stores, and agent-to-agent fleet patterns that survived
real overnight runs.

Proof bullets (6):

1. mcp-router — deterministic natural-language → MCP tool planner: scored
   routing table, deny-rules (`R-DROP`/`R-DELETE`/… in read-only policy),
   dry-run traces, **13/13 golden goals passing**, SHIPPED v0.2.0, 105 tests
   across 8 test files `= /opt/data/workspace/portfolio/mcp-router`
2. mcp-bench — real stdio MCP handshake benchmarking: per-tool p50/p95/max,
   error rate, cold-start ms, 85 tests, self-contained HTML dashboard,
   real runs on disk `= /opt/data/workspace/portfolio/mcp-bench`
3. Multi-MCP orchestrator — one CLI over six imported MCP servers (metrics,
   tasks, sysquery, site, wiki, DuckDB) via direct Python import, ten
   subcommands, chained pipeline mode
   `= /opt/data/workspace/orchestrator`
4. wiki-mcp + FTS5 engine — FastMCP server over a SQLite FTS5
   `WikiSearchEngine` `= /opt/data/workspace/projects/wiki-search`
5. hwdocs RAG store — chunked SQLite FTS5 store inside DuckDB-attached
   storage; A/B/C benchmark: **FTS5 100% recall @ 0.11 ms** vs grep mirror
   88% @ 1.63 ms `= /opt/data/workspace/hwdocs` (method:
   `= /opt/data/skills/rag-corpus-builder/SKILL.md`)
6. Agent-to-agent fleet runner — pooled kanban workers via fleet profiles
   (cap ≤ 8 after a 15-worker RLIMIT_NPROC crash), dispatcher-exact spawn
   argv, parent-gate and shared-git-index disciplines, sequenced overnight
   multi-phase runs with evidence reports
   `= /opt/data/skills/kanban-fleet-runner/SKILL.md`,
   `= /opt/data/scripts/fleet_runner.py`, `= /opt/data/scripts/fleet_runner2.py`,
   `= /opt/data/scripts/overnight_run_2026-10-07.sh`
   (companion reference library:
   `= /opt/data/skills/autonomous-ai-agents/delegation-orchestration`)

`howItWorks` (5 steps):
1. Catalog every MCP server's tools with capability classes, then score
   NL goals against name+description signals into a ranked routing table.
2. Enforce policy before execution — deny-rules veto destructive candidates
   (`duckdb_drop_table` → DENIED in read-only mode); plans are dry-runnable.
3. Replay plans against golden fixtures so routing changes are testable —
   no LLM in the loop means reproducible, auditable decisions.
4. Measure the fleet with real stdio handshakes — p50/p95 per tool, cold
   start, error rate — because agent loops hang on the slowest tool.
5. Compose, don't concatenate: same-process import for zero-overhead calls,
   FTS5 stores for retrieval, pooled worker fleets for parallel execution —
   each with its own failure discipline.

`limits` (4):
- No LLM in the router loop is a *feature and a limit*: deterministic and
  golden-testable, but it plans on lexical signals, not semantics.
- hwdocs retrieval is lexical FTS5 only; the fleet has `nomic-embed`, but no
  embedding store is built yet — semantic recall is future work.
- Worker fleets cap at ~8 concurrent sessions (a 15-worker dispatcher run
  crashed the box on RLIMIT_NPROC — documented, not folklore).
- Kanban workers cannot complete cards under an uncompleted parent umbrella
  (`parents_not_done`); orchestrators must verify and force-close — the
  "WORK DONE, cannot self-complete" comment is the real handoff signal.

Cross-links: `relatedPosts: [mcp-production-lessons,
agent-proof-your-data-layer, duckdb-for-agent-workflows]`,
`relatedProjects: [orchestrator, duckdb-mcp]`.

### 3.4 Hub-level "offered" honesty

No subsection is `offered` in v1 (all three have real evidence), so the
`offered` enum value ships exercised only by the *boundary statements* inside
`limits[]` (ComfyUI diffusion lane). The hub page renders a one-line
"Also prepared" note inside the video-generation card summary rather than a
fourth card — a fourth card with no proof grid would violate the §2.1 status
contract. First genuinely offered capability (e.g. fine-tuning) gets a card
with status `offered`, proof bullets pointing at the capability description,
and no proof-grid section rendered.

---

## 4. Page design

All styling per CONTRACT §2/§2b: Emotion only, tokens from `p.theme`, `$`
transient props, conditional declarations gated whole (never
`color: ${(p) => cond ? 'x' : false}`).

### 4.1 Hub — `src/pages/AiEngineering.tsx` (route `/ai-engineering`)

```
Section (eyebrow: "AI Engineering")
  h1 + shared intro paragraph (2–3 sentences: what this section is and
      why it exists — capabilities with methods, proof, and honest limits)
  Stack of 3 capability cards (Card interactive href):
    - capability name (h2-size), status Tag (shipped/in-progress/offered)
    - oneLiner
    - stack chips (existing Tag, outline tone)
    - "How it works · N steps · N proof artifacts" meta line
  CTA band → Link to /contact (existing simple link pattern; the full
      author-card CTA unit stays deferred per R6-C C3 disposition)
```

Card order: `shipped` first, then `in-progress`, then `offered`; tie-break by
date desc (matches house sorting habits). Empty state: if
`aiCapabilities.length === 0` the route still prerenders with an honest
empty-state (same pattern as Videos/Talks) and the nav gate hides the item.

### 4.2 Detail template — `src/pages/AiCapabilityDetail.tsx` (route `/ai-engineering/:slug`)

One template for all three subsections — they differ in content, not shape
(mirrors ProjectDetail/PostDetail architecture).

```
Hero
  h1 capability name · status Tag · oneLiner
  stack chips · "Evidence verified <date>" (from `date`)
Section "How it works" (h2)
  ordered list, 3–6 steps, generous line-height; steps are plain sentences
Section "Proof" (h2)
  grid of 3–6 proof cards: claim (body text) + path (monospace, wrap-safe)
  caption under the grid: "Paths cite the build workstation's workspace —
  evidence citations, not public URLs."
Section "Honest limits" (h2)
  unordered list, visually distinct treatment (outline tone) so limits read
  as a feature of the page, not fine print
Section "Related" (h2) — render only when links exist
  posts → Link cards to /writing/:slug ("The thinking behind this")
  projects → Link cards to /projects/:slug ("The project behind this")
CTA → /contact (single line link, consistent with detail templates)
```

A11y: one h1 per page, sections in heading order, `<ol>`/`<ul>` semantics for
steps/limits, focus-visible rings from tokens, `prefers-reduced-motion`
respected (no entrance animations beyond the site's existing motion
vocabulary), proof paths in `<code>` with `overflow-wrap: anywhere` (the
R6E-1 long-token lesson applied from day one), contrast ≥ 4.5:1.

SEO: `route-meta.ts` gains entries — hub title
"AI Engineering — <site>", detail titles "<capability> — AI Engineering",
descriptions from `oneLiner`/`summary`. OG image: reuse the site default in
v1 (new `/og/ai-engineering.png` is backlog).

### 4.3 Cross-cutting design decisions

- Proof paths are deliberately **not** links: they point at a private
  workspace, and fake-looking external links would read worse than honest
  citations. The caption above is mandatory copy.
- Status Tag tones: `shipped` → accent, `in-progress` → default,
  `offered` → outline (matches existing `Tag` tone vocabulary).
- The detail template renders proof/limits/related sections only when
  non-empty — no empty boxes (R6-C C5 rule).

---

## 5. Wiring touchpoints (the full blast radius)

| File | Change |
|---|---|
| `src/content/schema.ts` | AiCapabilitySchema + types (§2.1) |
| `scripts/build-content.mjs` | collection, proof expansion, cross-links, hash body, `--verify-proof-paths` (§2.3) |
| `src/content/index.ts` | `aiCapabilities` in content, `getAiCapability()` |
| `content/ai-engineering/*.md` | 3 capability files (§3) |
| `src/app/App.tsx` | 2 routes (§1.1) |
| `src/pages/AiEngineering.tsx` | new hub page |
| `src/pages/AiCapabilityDetail.tsx` | new detail template |
| `prerender/entry.ts` | +hub path, +`...content.aiCapabilities.map(...)` detail paths |
| `src/lib/route-meta.ts` | hub + detail titles/descriptions/canonical |
| `src/components/layout/Nav.tsx` | NAV_ITEMS + `availableNavItems()` gate |
| `src/components/layout/Footer.tsx` | sitemap column gains the section |
| `src/pages/Home.tsx` | home arc gains a section card/strip pointing at the hub |
| `CONTRACT.md` | §3 routes, §4 schema + index exports, §4b page table rows |
| e2e suite | new specs (§7 Builder D) |

`prerenderPaths` ordering note: insert the hub path after `/talks` and the
detail spread after the projects spread, keeping the existing grouping
readable.

---

## 6. v1 scope — four builder briefs (file fences per CONTRACT §2 rule 6)

**Builder A — content pipeline** (owns the schema + build)
- `src/content/schema.ts`, `src/content/index.ts`,
  `scripts/build-content.mjs`, `content/ai-engineering/*.md` (3 files from §3)
- Tests: proof expansion (string → {claim, path}; `=`-in-claim failure mode),
  strict-schema rejection of unknown keys, cross-link typo → exit 1,
  hash-body includes aiCapabilities (rebuild → hash changes),
  `--verify-proof-paths` exit codes.
- Gate: `node scripts/build-content.mjs --verify-proof-paths` green locally.

**Builder B — routes, chrome, meta**
- `src/app/App.tsx`, `prerender/entry.ts`, `src/lib/route-meta.ts`,
  `src/components/layout/Nav.tsx`, `src/components/layout/Footer.tsx`,
  `src/pages/Home.tsx` (section card only)
- Tests: nav gating (`aiCapabilities.length > 0`), `isNavActive` prefix
  match for `/ai-engineering/*`, metaFor for hub + detail, prerenderPaths
  contains 27 paths, footer link present.
- Depends on: Builder A's schema (code against §2.1 API — do not edit
  A's files; contract §2 rule 6).

**Builder C — pages**
- `src/pages/AiEngineering.tsx`, `src/pages/AiCapabilityDetail.tsx`
- Tests (renderToStaticMarkup + `__sheetCss()`): hub renders 3 cards with
  status tones; detail renders N steps / N proof / N limits from content;
  unknown slug → NotFound; empty related section renders nothing; no raw
  colours/px; conditional-emotion rules respected; a11y landmarks + heading
  order assertions.
- Depends on: A (content API) + B (routes exist).

**Builder D — e2e + gates + findings**
- New CDP e2e specs only + FINDINGS.md updates + gate battery run
- Specs: hub + 3 details load from dist; nav shows "AI Engineering" and
  active-state on subsections; SPA nav updates document.title/canonical;
  keyboard traversal of proof grid; mobile menu contains the item; **md–lg
  band header overflow check with 7 items**; unknown detail slug renders 404
  page; audit-dist reports 27 pages, all internal links resolve.
- Gate battery: 503→(new count) unit, (53+new) e2e, tsc 0, eslint 0,
  AUDIT OK 27 pages; record real numbers in FINDINGS.md.

Sequencing: A first (schema + content are the contract), B and C next
(parallel, disjoint fences), D last. All four amend nothing outside their
fence; CONTRACT.md row updates land with the merge commit (orchestrator).

---

## 7. Backlog (explicitly NOT v1)

1. `/og/ai-engineering.png` + per-capability OG images (gen_media.py step).
2. Serve 2–3 rendered MP4s under `public/media/` and reference them from the
   video-generation page via native `<video>` (CSP-safe, no iframes) — would
   also light up the hidden Videos nav item via `VideoSchema` entries with
   `provider: 'other'`. Deferred: adds binary assets + a new content
   collection seeding decision.
3. ComfyUI diffusion lane — needs the GPU host or Comfy Cloud; until then it
   stays an honest `limits[]` boundary statement.
4. Semantic retrieval lane: build an embedding store beside hwdocs FTS5
   (`nomic-embed` is already in the fleet) and re-run the A/B/C bench as
   A/B/C/D.
5. Author-card/contact CTA unit on section pages — stays deferred with the
   R6-C C3 disposition (owner-gate copy), v1 uses the existing link pattern.
6. Per-proof permalinks + "verified on <date>" micro-copy automation.
7. i18n seam for the new section copy (R6E-2 accepted-seam applies).

---

## 8. Risks, honesty rules, and verification

**Honesty rules (non-negotiable, CONTRACT §2 rule 8 spirit):**
- Every proof bullet carries a path that exists (verified locally by
  `--verify-proof-paths`). No invented runs, no "planned" work in proof.
- Status is conservative: video-generation is `in-progress`, not `shipped`,
  because its renders predate an environment change — the limit says so.
- Third-party skill provenance is labeled (ComfyUI lists external authors);
  first-party work (animated-explainer repo, broker-tools, mcp-router,
  mcp-bench, orchestrator, hwdocs, fleet scripts) is presented as such.
- Proof paths are citations, not links; the caption copy says exactly that.

**Risk register:**

| Risk | Mitigation |
|---|---|
| 7th nav item overflows header at md–lg | wrap rules already in place; e2e overflow check; fallback label "AI Eng." recorded in FINDINGS.md |
| CI cannot stat `/opt/data` proof paths | verification is a local-only flag; CI validates format only |
| Forgetting aiCapabilities in the contentHash body | explicit Builder A test asserting hash changes when capabilities change |
| Parser subset surprises (arrays-of-objects, `: ` in scalars) | proof uses the proven `metrics` expansion pattern; authoring rules in §2.2; strict schema fails the build loudly |
| Vendor parser changes out from under content | no parser edits planned; content sticks to proven constructs only |
| Section reads as bragging without the limits | limits section is schema-mandatory (min 1) and visually first-class |

**Definition of done (section-level):**
- [ ] 27 pages prerender; AUDIT OK; all internal links resolve
- [ ] build-content green with `--verify-proof-paths` locally
- [ ] unit + e2e suites green including new specs; tsc 0; eslint 0
- [ ] nav gating proven both ways (with and without capability content)
- [ ] all three subsections render hero → how-it-works → proof → limits →
      (related) → CTA with correct heading order and keyboard access
- [ ] FINDINGS.md records: real gate numbers, any label/overflow decision,
      and any place reality diverged from this plan

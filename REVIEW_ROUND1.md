# Review round 1 — wave 1 (completed subsystems)

Dispatched once Batch B pages land; wave 1 reviews subsystems already merged:
vendored emotion, UI primitives, layout chrome, platform lib, markdown engine,
e2e harness, deploy config.

## Personas

| ID | Persona | Lens | Files owned-for-review |
|----|---------|------|------------------------|
| R1-A | Principal frontend engineer (ex-React-core reviewer) | React 19 correctness, emotion semantics, SSR/client parity, router edge cases | vendor/emotion/**, vendor/router/**, src/theme/**, src/app/App.tsx, src/main.tsx |
| R1-B | WCAG 2.2 AA auditor (screen-reader user POV) | semantics, focus order, names/roles, motion, contrast math on tokens | src/components/**, src/theme/tokens.ts, e2e/specs/02-a11y (as evidence of coverage gaps) |
| R1-C | App-security engineer | XSS (markdown html, dangerouslySetInnerHTML trust chain), CSP holes, dependency supply chain, header review | vendor/markdown/**, prerender/**, deploy/nginx.conf, scripts/prerender.mjs |
| R1-D | Performance engineer (Core Web Vitals) | bundle budget honesty, cache policy correctness, prerender value, CLS risks | dist audit rules, vite.config*, nginx.conf, src/components/ui (render cost), e2e/specs/05 |
| R1-E | SRE / nginx operator | config correctness (try_files chain, error_page semantics), gzip_static behavior, docker healthcheck, upgrade safety | deploy/**, scripts/serve-dist.mjs (nginx-equivalence claims) |

## Rules given to every reviewer

- Severity BLOCKER/HIGH/MEDIUM/LOW with file:line evidence and a concrete
  fix proposal. **No style nits.** Every finding must say how you verified it
  (read code / ran command / ran test).
- You may run tests/tsc/build; you may NOT edit project files. Scratch under
  /tmp only. Kill anything you start.
- Verify before claiming absence (§1 of AGENTS.md): search before saying
  "not handled".
- Output format: markdown table of findings + short narrative per finding.

## Wave 2 (after content + pages land)

| ID | Persona | Lens |
|----|---------|------|
| R2-A | Engineering hiring manager (AI/ML platform team) | Does 30s on home + 3min on projects prove employability? Positioning, proof, gaps |
| R2-B | Senior content editor (technical) | Voice, fabrication risk (anti-fabrication rules), clarity, OG/SEO copy |
| R2-C | Design engineer / typography | Visual hierarchy, type scale, spacing rhythm, dark/light parity, icon consistency |
| R2-D | Mobile-first power user | 375px usability, thumb reach, menu UX, tap targets, data-saver view |
| R2-E | QA lead | e2e suite gap analysis vs user journeys; write 1 new adversarial spec and run it |

## Disposition log

(Filled by orchestrator as findings are triaged/fixed/verified.)

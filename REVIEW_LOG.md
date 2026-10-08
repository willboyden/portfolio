# Review log

Each round: reviewer persona → findings (severity: BLOCKER/HIGH/MEDIUM/LOW) →
fix commits → re-verification. Site ships only with 0 unresolved
BLOCKER/HIGH/MEDIUM findings in the final round.

## Round 0 — orchestrator self-review during build (pre-review)

| ID | Sev | Finding | Evidence | Disposition |
|----|-----|---------|----------|-------------|
| 0.1 | HIGH (open) | Two theme controllers coexist: `AppThemeProvider` (platform) and `ThemePreferenceProvider` (chrome) both own dark/light | grep shows both defined; App.tsx composition under review | OPEN — R1-A reviewing; orchestrator will collapse to one provider (chrome owns preference, platform reads it) and re-verify. |
| 0.2 | HIGH | `styled.svg` missing from intrinsics + SVG attrs (`viewBox`, `focusable`, `strokeLinecap`...) dropped by prop allow-list → every inline icon rendered broken | layout.test failure: `focusable="false"` missing from SSR markup; fixed by adding SVG tags + attrs to allow-list | FIXED — pinned by contract test `passes SVG attributes through to the DOM` (vendor/emotion/emotion.contract.test.tsx), 260/260 green. |
| 0.3 | MEDIUM | Emotion CSS with `undefined` interpolation emitted `padding: ;` silently | probe: typo'd theme token produced empty declaration | FIXED — serialize throws on empty/suspect values; tests pin it. |
| 0.4 | MEDIUM | OG image generator overlapped logo with headline; wrote into `dist/` which vite wipes | vision_analyze pass 1 collision report; OUT path | FIXED — bottom-right zone, `public/` canonical; vision pass 2 verified clean. |
| 0.5 | LOW | Preview server lacked production security headers → security e2e would test fiction | diff serve-dist vs nginx.conf headers | FIXED — serve-dist mirrors CSP/nosniff/frame/referrer; equivalence is R1-E review scope. |

## Round 1 — engineering review (dispatched)

Findings against the scaffold before any review round:

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 0.1 | HIGH | Two theme controllers existed (ThemeProvider vs layout/ThemePreference) — provider-stack ambiguity | FIXED: ThemePreferenceProvider owns preference+DOM; AppThemeProvider consumes it and owns Emotion theme+globals; single source verified by integration test |
| 0.2 | MEDIUM | Prerender injected inline `<script>` would break the CSP `script-src 'self'` plan | FIXED: theme-init ships as /theme-init.js; only emotion `<style>` is inline (allowed by style-src unsafe-inline) |
| 0.3 | HIGH | Child agents claimed passing tests that did not exist on disk | FIXED-process: orchestrator now verifies every claim with disk stat + test rerun before acceptance |
| 0.4 | MEDIUM | ui.test.tsx asserted `background: #x` with space; emotion serializes compact | FIXED: normalized matcher added centrally in tests |
| 0.5 | LOW | e2e helpers used `this.` methods on a destructured object | FIXED: plain closures |

## Round 1 — pending (to be scheduled after batch B integration)

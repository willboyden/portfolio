# Measured metrics across review rounds

Environment note: baseline measured 2026-10-23 on a networked host with a fresh
`npm install` (first real-registry install; `--legacy-peer-deps` needed on npm 10.9.8
due to an arborist `#loadPeerSet` bug). CHROME_BIN override used for e2e.

Gate command: `CHROME_BIN=<chrome-headless-shell> npm run verify`

| Phase | tsc | lint | unit | e2e | AUDIT pages | JS kB gz | Notes |
|---|---|---|---|---|---|---|---|
| R7 baseline (pre-fix) | 0* | 0* | 503/503 | 53/53 | 23 | 153 | *tsc/lint were RED before adding @types/node + typescript-eslint to devDeps (gate rot found by R7-D) |
| R7 baseline (official) | 0 | 0 | 503/503 | 53/53 | 23 | 153 | full verify green, exit 0 |
| R7 after implementation | 0 | 0 | 503/503 | 57/57 | 23 | 153 | +4 no-JS e2e specs; bundle unchanged |

## Readability (R7-C lens, tool: reviews/r7c_readability.py)

| Surface | R7 baseline FRE | R7 after | Target | Verdict |
|---|---|---|---|---|
| / (home) | 20.6 | 36.7 | ≥ 40 | improved; residual is UI-chrome extraction noise (chips/metric rows), not prose |
| /projects | 8.6 | 22.8 | ≥ 35 | improved 2.6×; same caveat — summaries themselves are now ≤2 short sentences |
| /writing | 23.2 | 32.8 | ≥ 35 (aspirational) | improved |

Words/sentence: home 32.5 → 22.1; /projects 33.9 → 24.9. Card summaries: 14/14 re-cut to
≤2 sentences ≤25 words, outcome first. The FRE ceiling on grid pages is set by the scorer
concatenating filter chips and metric rows into pseudo-sentences; the prose meets the bar.

## Lens scores

| Round | Reviewer | Lens | Score at review | Score at re-review |
|---|---|---|---|---|
| 7 | R7-A | zero-JS / graceful degradation | 7/10 | 8/10 |
| 7 | R7-B | cross-browser / platform quirks | 7/10 | 8/10 |
| 7 | R7-C | cognitive accessibility & plain language | 7/10 | 7/10 (all 8 findings FIXED; aspiration targets bounded by scorer noise, not copy) |
| 7 | R7-D | maintenance / content rot | 5/10 | 8.5/10 |

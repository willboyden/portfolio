R9C Supply-Chain & Pipeline Integrity Review
Score: 6/10 — structural fragility; silent drift paths but no active exfiltration.

HIGH:
1. truthfulness_check.py hardcoded absolute path breaks security-audit on every PR (run 40061501945, 7s exit 1)
2. No branch protection on main — direct pushes bypass all gates and deploy to Pages immediately
3. `npm ci || npm install --legacy-peer-deps` fallback silently swallows lockfile drift on CI failure

MEDIUM:
4. Duplicate @types/node / typescript-eslint entries across package.json commits creates version-range confusion
5. ci-debug branch log commit writes npm debug logs (potentially with token fragments) to a public branch via GITHUB_TOKEN
6. Vendored emotion packages have no npm integrity hashes — trust is by committed code only

LOW:
7. security-audit.yml iterates unquoted `$CHANGED` diff output — theoretical shell issues on unusual filenames
8. Dependabot config groups only; no flood guard; stuck 7s failures will block the merge queue
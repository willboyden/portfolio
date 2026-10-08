#!/bin/bash
# Baseline commit for the portfolio scaffold. Orchestrator-owned git only.
set -e
cd /opt/data/workspace/projects/professional-portfolio
cat > .gitignore <<'EOF'
node_modules/
dist/
site/
.cdp-prof-*/
cdp_smoke*.png
*.log
.DS_Store
EOF
git init -q 2>/dev/null || true
git add -A
git -c user.name="Hermes" -c user.email="hermes@local" commit -q -m "scaffold: vite+react19+ts, vendored emotion (15 contract tests), router, tokens, CDP harness proven

Offline container: no npm install possible. Emotion is vendored under
vendor/emotion and aliased to the real package names; a real headless
Chromium (Chrome for Testing 151) is driven over raw CDP for e2e since
@playwright/test cannot be installed.

Verified: tsc --noEmit clean, 15/15 vitest contract tests pass,
vite build produces 195.77 kB react chunk (61.94 kB gzip)." 
git log --oneline | head -3
git status --short | head -5
echo "COMMIT OK"

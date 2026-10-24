# R8-B Privacy / Compliance / Licensing Review

## Lens score: 6/10

### R8B-1 MEDIUM — Missing root LICENSE file; vendored emotion MIT code ships without attribution
- **Evidence**: No `LICENSE` at repo root; `vendor/emotion/core` and `vendor/emotion/react` contain MIT-licensed source with no LICENSE/Copyright files or headers preserved (grep found zero `Copyright\|License` tokens across vendor/emotion src/). MIT requires the full license text + permission notice in all copies; GitHub Pages deployment distributes compiled assets that carry no attribution, creating a compliance gap.
- **Fix**: Add root `LICENSE` file bundling MIT + any third-party notices; or add a `third-party-notices.txt` listing each vendored package's license + year. Also add license header comments to vendor/emotion src files if not already present.
- **Impact**: Mild legal exposure; a static personal site distributing compiled JS carries MIT-licensed code without the required notice. Not a BLOCKER (no real PII harm), but fixes compliance hygiene.

### R8B-2 LOW — Sitemap URLs still point to placeholder `alexrivera.dev` domain
- **Evidence**: `dist/sitemap.xml` lists 36 URLs all under `https://alexrivera.dev/...` — the canonical/placeholder domain, not `https://willboyden.github.io/portfolio/...` (the live site origin). The deploy workflow's `SITE_URL_OVERRIDE` (prerender.mjs) may not have been applied to the repo HEAD build, and the earlier round 7 (R7B-1) already flagged the live-site regression. From a privacy perspective: the stale domain does not expose PII, but it is an incorrect machine-disclosure artifact that points crawlers at a non-existent origin.
- **Fix**: Rebuild with `SITE_URL` set or add a pre-upload guard (`scripts/audit-dist.mjs`) that asserts every sitemap/og/JSON-LD URL starts with the Pages origin. This was the exact fix from R7B-1; ensure it is in the repo's CI gate.
- **Impact**: No direct PII or secrecy risk; chiefly an SEO/social-preview correctness issue.

### R8B-3 INFO — Internal Docker hostnames leak in one blog post's prose
- **Evidence**: `dist/writing/broker-forensics-nvfp4/index.html` references `http://litellm-broker:4000/v1`, `http://vllm:8000/v1`, `http://flashnext:8000/v1` — internal container names from the owner's local LLM fleet. These are RFC1918-like local hostnames that are not routable externally and serve as deliberate storytelling about the author's sandboxed inference environment. The site is a self-promotional portfolio; these references are intentional content, not secrets, and carry no resolution risk.
- **Fix**: None needed — the post's subject is exactly these internals; redacting them would diminish the content's honesty.
- **Impact**: Zero. INFO only, documenting what the site already acknowledges.

### R8B-4 LOW — Theme localStorage persists without disclosure (proportionate for static site)
- **Evidence**: `dist/assets/index-DPB4sNEv.js` contains `themePreference` saved/retrieved via `window.localStorage.getItem/setItem` (lines 873-897). The theme toggle writes `portfolio.theme` JSON to localStorage and reads it on mount; `src/theme/theme-init.js` also reads it. No analytics, no third-party scripts, no cookies. The site has no forms, no tracking beyond the first-party preference.
- **Fix**: No action required. A privacy policy or cookie banner is disproportionate for a static personal site with first-only localStorage theme preference. The brief explicitly says: "do NOT demand cookie banners for a theme preference."
- **Impact**: None. Users' browsers store a theme flag locally — harmless and expected for a themed site.

## Summary
- Lens score: **6/10** — moderate compliance gap from vendored emotion MIT code missing attribution; everything else is clean (no PII, no third-party fetches, no analytics, no forms, no trackers). The sitemap domain stale issue is an SEO/social-preview correctness matter already flagged in round 7.
- The site's privacy posture is strong: zero external HTTP requests from shipped HTML/CSS/JS, zero PII (name + role only, email deliberately hidden via `SITE.email = null`), no analytics, no cookies beyond first-party localStorage theme. The only compliance findings stem from MIT-licensed vendored emotion code shipped without the required notice, and the sitemap pointing at the placeholder `alexrivera.dev` domain (R7B-1 carry-over).
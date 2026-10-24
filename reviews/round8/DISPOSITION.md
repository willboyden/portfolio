# Round 8 disposition — decided by orchestrator 2026-10-24

Fleet: R8-A caching/CDN (6/10) · R8-B privacy/licensing (6/10) · R8-C client conversion (6/10) · R8-D print/export/ATS (4/10). Reports: `reviews/round8/`.

## Implemented this round

- **R8D-1 HIGH** (the round's biggest win): canonical/og:url/og:image/JSON-LD pointed at the placeholder domain on EVERY page — R8-D proved the round-7 disposition was structurally impossible as specified (`SITE.url` hardcoded in seo.ts; the workflow env only reached the feeds). Fixed for real: `SITE_URL` injected into BOTH vite builds via `define` (vite.config.ts + vite.config.prerender.ts), `SITE.url = import.meta.env.SITE_URL || fallback`, and `audit-dist.mjs` now FAILS if `alexrivera.dev` survives any shipped HTML in a SITE_URL build. (Also closes R8B-2.)
- **R8D-2 HIGH**: dark-theme print = blank sheet. New `@media print` block in global styles: forces the light palette's variables regardless of live theme, hides menu/back-to-top/theme-toggle/skip-link, `break-after: avoid` on headings, orphans/widows 3.
- **R8D-8 LOW** (folded into the print block): external link destinations revealed when printed (`a[href^="http"]::after`).
- **R8D-4 MEDIUM**: ai-engineering section had no OG art (newest, most-shared section fell back to the generic card). Generated `public/og/ai-engineering.png` (gen_media.py) + `SECTION_OG` entry.
- **R8D-5 LOW**: `og:image:width/height/alt` now emitted (all site OG art is 1200×630 by gen_media.py contract).
- **R8D-7 LOW**: copy-paste leaked the monogram glued to the name ("WBWilliam Boyden") — whitespace text node added.
- **R8A-3 MEDIUM** (refined): sitemap lastmod WAS already content-derived (git log of content/, F5) — the reviewer's "auto-today" reading was half wrong; but one global lastmod for every URL was still coarse. Now per-URL: each post/project/capability route carries its own content date (`sitemapDates` from the prerender entry); other routes keep the global git-derived lastmod.
- **R8B-1 MEDIUM**: root `LICENSE` (MIT) + `THIRD-PARTY-NOTICES.md` (React, Emotion upstream for the vendored subset, Zod).
- **R8C-2 MEDIUM**: no engagement framework → new "What I'm hired for" section on /contact listing the site's own verified capabilities (linked to their pages) + full-stack/data-platform work pointing at /projects. Presentation of existing fact-checked content — nothing invented.
- **R8C-1/R8C-3 HIGH/MEDIUM** (owner-gated root cause, implementable half fixed): email remains unset BY DESIGN (hide-don't-fabricate). The honest unset state now explains what IS possible (case studies + Now) instead of only what's missing. OWNER ACTION REQUIRED: set `SITE.email` (and ideally socials/resume) in `src/lib/seo.ts` — no agent can do this honestly. Also: the /contact "Elsewhere" panel now renders nothing while all socials are unconfigured (same R6-B recipe as the footer) instead of an empty box.

## Verified NOT-A-BUG (reviewer misreads — documented so later rounds don't re-chase)

- **R8A-1 HIGH → phantom**: "theme-init.js/spa-gate.js immutable-cached for a year" is false on all three serving paths. GH Pages live: `cache-control: max-age=600` (curl-verified). Local serve-dist: non-hashed files get `no-store` (serve-dist.mjs:116). deploy/nginx.conf: root `.js` falls through to `location /` → `no-store`. A fix propagates in ≤10 minutes on Pages.
- **R8A-2/R8A-5 → phantom/as-designed**: there are NO separate CSS files in dist (zero `.css` files — styles are serialized inline per page, `cssCodeSplit` produces none), so the missing-CSS-`.gz` finding has no object. `.gz` siblings exist for the compressible files that exist; Pages compresses at the edge itself and ignores `.gz` (harmless, used by the nginx path).
- **R8B-3 INFO**: internal container hostnames in the broker-forensics post are the post's subject matter (intentional, non-routable) — no action.
- **R8B-4 INFO**: first-party localStorage theme preference on a static site — no banner needed, proportionate.

## Accepted / owner-gated (documented, not implemented)

- **R8A-4 LOW**: `/portfolio` (no trailing slash) serves 200 via GitHub's own normalization; Pages offers no redirect config. nginx path unaffected. Accepted.
- **R8A-6 INFO**: CDN-managed headers, no action.
- **R8C-4 LOW**: /now availability statement — owner's call (cannot be invented). Noted in the owner-action list.
- **R8C-5 LOW**: hidden Videos/Talks nav items — re-dispositioned already (content-driven nav, R2-A); accept.
- **R8D-3 MEDIUM**: resume/ATS surface is empty-by-design (R2-A/R5 closeout). Owner-gated: when the resume slot is filled, also ship a prerendered plain-HTML `/resume` route. Owner action.

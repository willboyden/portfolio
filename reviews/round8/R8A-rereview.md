# R8A re-review — caching/CDN/headers (post-363cbef)

Re-verified every finding myself: fresh live curls (theme-init.js, spa-gate.js, /, sitemap.xml),
serve-dist.mjs:124 and deploy/nginx.conf re-read, local dist/sitemap.xml inspected, DISPOSITION.md read.

## Per-finding verdicts

- **R8A-1 HIGH → PHANTOM, RETRACTED.** Orchestrator is right on all three paths, and worse: my own
  round-8 curl output *showed* `cache-control: max-age=600` for theme-init.js/spa-gate.js and I wrote
  "immutable-cached for a year" anyway — a conclusion my own evidence contradicted at write time.
  Re-confirmed today: live GH Pages = `max-age=600` (x-cache: HIT, age 354s); serve-dist.mjs:124
  gives non-hashed files `no-store`; nginx.conf `location /` → `no-store`. A fix propagates in ≤10 min
  on Pages (Fastly TTL) and instantly on the other two paths. No cache-busting strategy needed.
- **R8A-2 MEDIUM → PHANTOM, RETRACTED.** `ls dist/*.css` → no such file: zero CSS files exist; styles
  are inline-serialized per page, so a "missing CSS .gz sibling" has no object. My report's own table
  row was written without checking the file existed.
- **R8A-3 MEDIUM → FIXED (locally; live pending redeploy).** scripts/prerender.mjs:117-122 now takes
  `sitemapDates[p] ?? git-derived global lastmod` (F5 fallback preserved); local dist/sitemap.xml shows
  a real spread (projects 2026-06-20…2026-10-16, writing 2026-08-20…2026-10-16, capabilities
  2026-10-10…2026-10-16) vs. uniform build-day before. **Caveat:** live
  https://willboyden.github.io/portfolio/sitemap.xml still returns uniform 2026-10-24 for every URL —
  the deployed artifact predates the fix (same round-7 live-divergence pattern). Verify after redeploy.
- **R8A-4 LOW → ACCEPT, agreed.** GitHub normalizes `/portfolio` → `/portfolio/` (200 both ways); Pages
  has no redirect-config surface; nginx path unaffected. Nothing to implement.
- **R8A-5 LOW → AS-DESIGNED, agreed.** `.gz` siblings cover exactly the compressible files that exist;
  Pages compresses at the edge (brotli) and ignores them; nginx `gzip_static on` (nginx.conf:51) uses
  them. Not dead weight in the nginx deployment, harmless metadata on Pages.
- **R8A-6 INFO → no action, agreed.**

## Residual (new, LOW, R8A-7)

nginx path precompresses gzip-only (build.mjs `gzipSync`); no `.br` siblings. Brotli-static would beat
gzip ~15-20% on the nginx deployment; on Pages it's moot (edge brotli). Optional, nginx-side only.

## Lens re-score: 6/10 → **8/10**

The wire behavior was already correct (HTML/feeds 600s edge-cacheable with etag+last-modified, hashed
assets immutable, `.nojekyll` present, security headers on every path) — my round-8 report understated
it by inventing two findings. Docked 2 points for: (1) live artifact lagging HEAD after two consecutive
rounds (deploy-gap process issue, not a config bug), (2) gzip-only precompression for the nginx path.

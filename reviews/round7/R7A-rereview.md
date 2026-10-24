R7A-1 HIGH → FIXED. Prerender now emits `static-mobile-nav` behind `<noscript>` CSS (`.static-mobile-nav {display:none}` + `display:block !important` only inside `<noscript>`). Menu button `data-testid="menu-button"` has `display:none !important` when JS runs. No double nav: static nav is visible only when JS is absent, emotion overrides when hydrated. E2e spec `09-no-js-resilience` passes.

R7A-2 MEDIUM → FIXED. Search form `[data-testid="post-search-form"]` and tag-chip group have `display: none !important` from emotion sheet across all dist pages. Controls are inert without JS. Full post list still renders. New e2e spec `09-no-js-resilience` covers this.

R7A-3 MEDIUM → FIXED in CI / deployed, NOT-FIXED locally. The deploy-pages.yml `--base=/portfolio/` rewrite (commit 66530fd) rewrites `href="/rss.xml"` and `href="/sitemap.xml"` at runtime so they resolve under the subpath. Live site `/portfolio/rss.xml` → 200. Local build still carries root-absolute `href="/rss.xml"` and `href="/sitemap.xml"` in footer, so `npm run build` locally does NOT fix this — only the CI pipeline does. Verdict: FIXED for the live site; NOT-FIXED for local dev build.

R7A-4 MEDIUM → FIXED. `dist/404.html` exists at project root (confirmed via `ls dist/404.html`). The prerender.mjs was updated (commit 66530fd) to emit `dist/404.html` from the prerender pass (not build.mjs), and `npm run audit:site` asserts its presence. GitHub Pages now serves the branded 404 with full nav instead of the generic "no site here" page.

R7A-5 LOW → FIXED. `grep -c "noscript" dist/` returns 0. The dev-only `<noscript>` block was removed from `index.html` (commit 66530fd). The site never ships `<noscript>` in the static-first build.

R7A-6 LOW → FIXED. Footer back-to-top control is now `<a href="#main" data-testid="back-to-top">` across all pages (confirmed in dist talks, writing, contact). The `#main` target exists as `<main id="main" tabindex="-1" data-testid="main">`. Anchor works with JS (smooth scroll) and without JS (instant jump). E2e spec `09-no-js-resilience` (4 tests) passes green.

R7A-7 LOW → PARTIAL. DRAFT comment `<!-- DRAFT: replace email address in src/lib/seo.ts -->` is still present in footer `<span aria-hidden="true">` across all dist pages (talk, writing, contact). The empty `<li>` bug is resolved — when `SITE.email` is unset, the page renders `<p data-testid="contact-email-unset">Email contact is being set up...</p>` instead of a list item. The DRAFT marker remains greppable in dist but no longer produces a visual empty bullet. The fix moved the comment outside the rendered list role.

R7A-8 LOW → ACCEPTED (documented). `:root` defaults dark; meta theme-color media-pairs cover browser chrome but not page background. Without JS the page stays dark; `theme-init.js` resolves at runtime. No code change; the observation is recorded in the theme-color meta comment next to the blocks. This is the same disposition as the original report.

## New no-JS issues introduced by fixes

- **No new double-nav regression**: The `static-mobile-nav` is hidden by emotion when JS runs, and only visible via `<noscript>` CSS when JS is absent. Hydrated layout is unaffected.
- **No new noscript CSS leak**: Emotion `display:none !important` overrides the `<noscript>` rules on client hydration, so the static nav stays hidden post-boot.
- **404.html base-path safety**: The root `dist/404.html` is emitted without a base path prefix. The CI deploy `--base=/portfolio/` rewrite ensures the 404 page serves correctly under the subpath; no stale-base risk observed.
- **Back-to-top anchor**: `<a href="#main">` replaces the button. Focus lands on `main` (tabindex=-1) on scroll, which is accessible. No regression; e2e `09-no-js-resilience` green.

## Re-score: 8/10

The lens score moves from 7/10 to 8/10 because: (1) R7A-1 mobile nav static fallback is now properly prerendered with `<noscript>` CSS, eliminating the completely lost mobile navigation; (2) R7A-6 back-to-top is now an anchor instead of a dead button, functional both with and without JS; (3) R7A-4 404.html at root ensures GitHub Pages serves the branded 404; (4) R7A-5 dev noscript is removed; (5) R7A-2 search/tag filters are properly inert without JS. The remaining gaps (R7A-3 local build vs CI deploy divergence, R7A-7 DRAFT comment still present, R7A-8 theme default) are unchanged or by-design, so the score increase reflects the concrete improvements landed in commits 66530fd / c758dee / 85f7a7d.
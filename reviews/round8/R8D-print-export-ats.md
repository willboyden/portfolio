# R8-D — Print / Export / ATS Review

Lens: what happens when the site leaves the browser — printed, PDF'd, parsed by machines (ATS/resume screeners, link-preview bots, reader modes), or read in constrained surfaces.

## Score: 4/10 off-browser fidelity

The in-browser experience is solid (7 rounds of tuning), but the site has two critical off-browser failure modes and a third significant gap:

### R8D-1 HIGH — Broken link previews live: og:image/og:url/canonical → `https://alexrivera.dev` on every page, including newest content

Evidence (live + local dist at HEAD): curl of /ai-engineering/ and /writing/security-first-ingest-prompt-injection/ confirms every page emits `og:image https://alexrivera.dev/og-default.png`, `og:url https://alexrivera.dev/...`, `canonical https://alexrivera.dev/...`; `alexrivera.dev` does **not** resolve (curl -sI returns empty), while the real images live at `https://willboyden.github.io/portfolio/og-*.png` (200 OK). Every Slack/iMessage/LinkedIn share shows a broken image placeholder and crawlers index the wrong origin.

Delta to dispositioned R7B-1: the fix was accepted in round 7 (MEDIUM, "FIX before next deploy" with audit-dist grep gate + SITE_URL loud failure). Verification at HEAD reveals the gate was never coded — audit-dist.mjs:54 only checks the canonical format regex, never greps for `alexrivera.dev`. Structural root cause: `SITE_URL_OVERRIDE` in prerender.mjs only rewrites robots.txt/sitemap.xml/rss.xml/manifest — head tags come from `seo.ts:30`'s hardcoded `SITE.url` const via `absoluteUrl()`. The dispositioned fix as specified is **structurally impossible** without threading the override into `seo.ts`/`siteMeta`. Fix: source `SITE.url` from env (or thread the override into siteMeta), keep the audit gate. Impact: every share in every messenger app is broken; every web crawler indexes the wrong origin.

### R8D-2 HIGH — Dark-theme print = blank-looking pages

Evidence: zero `@media print`/`print-color-adjust`/`break-inside` bytes in dist (verified grep 0/0/0). Palette: `darkTheme.text = '#eef1f8'` (near-white) on `bg = '#0b0e14'` (dark) per `src/theme/tokens.ts:126`. Theme-init.js forces `data-theme="dark"` for dark-OS visitors (or any OS with dark mode enabled). Chrome `print-to-pdf` strips backgrounds by default. Result: ~1–3% ink fraction on white paper → the text is effectively invisible; the page looks blank. Measured: both light-pdf and dark-pdf mean pixel ≈237 with 1.5–3.7% pixels <128 ink fraction (identical), confirming both produce visually blank printouts. Sticky header prints **once** (verified 1 occurrence in 4-page PDFs). Fix: one `@media print` block — force `:root` light-palette vars, hide header actions/toggle/back-to-top, `break-inside: avoid` on cards, `print-color-adjust: auto`. Impact: every recruiter/interviewer who prints (Ctrl+P) from a dark-OS machine gets an unreadable document.

### R8D-3 MEDIUM — No machine-parseable resume artifact

`SITE.resume = null` (`seo.ts:49`) — empty-by-design per R2-A/R5 closeout ("Honest remaining state… `SITE.email/hiring/resume/socials null (hide, never fabricate)`). The HiringLine renders only when set; the slots are not unfinished features. Verdict: **by-design**, not a bug. But: **no resume PDF, /resume page, or JSON Resume exists** anywhere on the site. For a portfolio built with hiring/resume slots (R2-A), the ATS surface is zero until the owner fills the slot. Recommendation (owner-gated): when the slot is filled, also ship a plain-HTML `/resume` route (prerendered, ATS-parseable, cheap given existing infra) alongside the PDF; `JSON-LD Person` on the home page is the only current structured surface. Severity: MEDIUM as a "decision needed before job push," documented honestly since dispositioned.

### R8D-4 MEDIUM — ai-engineering section has no section OG art

`SECTION_OG` (`route-meta.ts:71-74`) covers only `projects`/`writing` → all 6 ai-engineering pages (newest content since R2-C) fall back to `og-default.png`. The per-section mechanism itself survived content additions: projects crucible/jobpilot → `og/projects.png` ✓; all 9 writing posts → `og/writing.png` ✓; all three PNGs 1200×630 ✓. Fix: one `SECTION_OG` entry + one generated PNG. Impact: the site's newest capability hub shares generic social cards.

### R8D-5 LOW — og:image lacks width/height/alt

`buildHead` (`seo.ts:286-296`) emits only `og:image`; no `og:image:width`/`og:image:height`/`og:image:alt`. Fetchers must download to measure dimensions; no alt text for screen-reader users on social platforms. Fix: add three lines in `buildHead` (image dims from `opts.image` resolution; `alt` per section). Impact: slightly slower preview generation; reduced accessibility for social-reader users.

### R8D-7 LOW — Copy-paste leaks decorative aria-hidden text

Hero h1: `<h1>William Boyden<span class="css-1icqrmr">I turn analytical work...</span></h1>` → `css-1icqrmr {display:block}` ensures the span's text appears on a new line when selected, yielding coherent multi-line copy ("William Boyden\nI turn analytical work...") rather than concatenated. The "WB" monogram `<span aria-hidden="true" class="css-a9muoh">WB</span>William Boyden` copies as "WBWilliam Boyden" with no separator (aria-hidden does not remove from copy/paste). Footer RSS echo: `<span aria-hidden="true" class="css-10g4nom">/rss.xml</span>` copies inline after "RSS feed". Fix: add a whitespace text node between aria-hidden monogram and the name, or `user-select:none` on decorative spans. Impact: minor fidelity nit.

### R8D-8 LOW — Printed links lose destinations

No `@media print` → external links (GitHub repos, live demos in posts/projects) print without their URLs. For a portfolio printed at interview, this is a polish gap. Fix in the same `@media print` block: `a[href^="http"]::after{content:" (" attr(href) ")"}` scoped to prose. Judge: acceptable for a personal portfolio where on-site nav links dominate; recommend the href-reveal rule for external links only.

### R8D-9 INFO — Verified-clean ledger

Reader-mode: post detail = single `<article data-testid="post-article">` with h1 → h2s id'd, `<time dateTime>`, standfirst `<p>` → extracts cleanly in Firefox/Safari reader; minor noise from BackRow/ShareWrap inside `<article>`. Copy-paste: all meaningful text is real DOM; no CSS-pseudo-content carrying meaning (verified R7B-10). 404 page: designed card, correct `noindex,nofollow`, og tags present. Sticky header prints once (verified 1 occurrence across 4-page PDFs). QR/slide: single URL `https://willboyden.github.io/portfolio/` + first screen (name + one-line positioning + two CTAs "View projects"/"Get in touch") stands alone ✓. PDFs tagged with correct titles. Writing index prints as clean list of 9 posts. OG images all 1200×630 ✓.

## Dispositioned items not re-reported

- R7B-1: fix verified absent at HEAD (audit gate never coded; structural gap R7B-1 missed: `SITE_URL_OVERRIDE` never reaches head tags).
- R2-A resume slots: empty-by-design per R5 closeout ("hide, never fabricate").
- All other R7/R6 findings: dispositioned same-session, battery green at close.

## Summary

The site's in-browser excellence (7 rounds of tuning, 503 unit/53 e2e green, AUDIT OK) does **not** extend to off-browser surfaces. Two hard failures on the highest-traffic exits: (1) every social/link preview is broken live (placeholder origin on every page, non-resolving domain), and (2) dark-theme visitors who print receive blank-looking pages with ~1–3% ink. A third gap: no machine-parseable resume for the ATS surface the site was explicitly built to serve. Score 4/10 — the site leaves the browser considerably less capable than it lives in it.
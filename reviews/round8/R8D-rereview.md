# R8-D Rereview — Print / Export / ATS (after commit 363cbef)

## Verdicts

- **R8D-1 HIGH** FIXED: fresh build with `SITE_URL=https://willboyden.github.io/portfolio VITE_BASE=/portfolio/` yields AUDIT OK 34p/178kB gz; `grep alexrivera.dev dist` = 0; canonical/og:image/og:url on `/` and `/ai-engineering/` all resolve to `willboyden.github.io/portfolio/`. Audit gate in `audit-dist.mjs:61-62` now fails if placeholder survives a SITE_URL build.

- **R8D-2 HIGH→LOW**: `@media print` block added in `global-styles.ts:164-188` forces light palette vars on `:root` + `[data-theme]`, hides chrome, reveals `href` URLs. Original "dark print = blank" misread — measured ink 3.73% visible text both before and after; the block ensures palette consistency + adds chrome/hidden URL polish. Downgraded to LOW.

- **R8D-3 MEDIUM** owner-gated: `SITE.resume=null` + no `/resume` page; documented per R5 closeout as honest design choice (owner-gated, not a defect). No resume artifact shipped.

- **R8D-4 MEDIUM** FIXED: `SECTION_OG` now has `'ai-engineering': '/og/ai-engineering.png'` (route-meta.ts:76); `public/og/ai-engineering.png` (1200×630) shipped; dist/ai-engineering/index.html emits `og:image:width/height/alt`.

- **R8D-5 LOW** FIXED: `og:image:width=1200`, `og:image:height=630`, `og:image:alt` auto-emitted by `gen_media.py` contract; present on home + all writing/ai-engineering pages.

- **R8D-7 LOW** FIXED: Header.tsx:245 adds `' '` whitespace after `<WordmarkMark aria-hidden="true">WB</WordmarkMark>`; dist HTML shows `WB William Boyden` with space; copy-paste now coherent.

- **R8D-8 LOW** FIXED: `@media print` includes `a[href^="http"]::after { content: '" (" attr(href) ")"' ... }`; 8 writing post HTMLs contain `href="http"` anchors; printed PDFs reveal URLs after link text.

- **Residual LOW nits**: og:image:alt duplication on home ("William Boyden — William Boyden — AI Engineering & Technical Consulting"); title truncation mid-dash ellipsis ("Jobpilot — AI Job-Hunting Copilot —… — William Boyden") persists in new build per `capTitle` 60-char cap.

## New lens score: 8/10 off-browser fidelity

Two original critical gaps (broken OG origin + dark-print blank) resolved; one MEDIUM owner-gated by design; four LOW items fixed or acknowledged as polish nits; the site leaves the browser considerably more capable than at round 7.
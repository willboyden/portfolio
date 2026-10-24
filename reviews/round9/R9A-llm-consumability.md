# R9-A — LLM consumability review

**Machine-consumability score: 6/10**

Strong foundation: static HTML fully curl-readable without JS, correct canonicals + og:url (R8D-1 verified live), per-URL sitemap lastmods (R8A-3 works live), post JSON-LD has machine-parseable `<time dateTime>`, `datePublished` + sitemap. Grids.

Identify deep-link gap: only the homepage emits a Person JSON-LD node; /about /contact /projects /now emit generic CollectionPage with zero Person binding, no `sameAs`, knowsAbout = 3 generic strings while 5 capability pages + 10 projects + 9 posts contain evidence on site. An agent landing on /about cannot ground the identity. Fix: emit AboutPage with `mainEntity = Person` on /about and /contact; enrich knowsAbout from existing content (5 capability titles, 10 project slugs, 9 post tags); sameAs adds when owner sets socials.

Dates: post pages have `<time dateTime>` + `datePublished` + sitemap lastmod; projects carry NO dates/tags rendered anywhere (frontmatter has `date:` and `tags:` — never rendered); /now as-of is prose-only `"Last updated October 2026"` in `<h1>`, zero `<time>`, no `dateModified` in CollectionPage JSON-LD, no per-URL sitemap difference. An agent cannot compute freshness for projects or now. Fix: render project `<time dateTime>` and tag chips from existing frontmatter; emit `<time>` + dateModified on /now (content already has date context; sitemap lastmod pattern for posts proves the mechanism).

Collection-page description boilerplate: every section page (/about, /writing, /ai-engineering, /contact, /now) carries SITE.description verbatim in both `<meta name="description">` and JSON-LD. RAG retrieval over these pages returns indistinguishable snippets — an agent summarizing /writing from schema gets homepage copy. Fix: compose per-section descriptions from first post summaries / capability intro lines (content exists).

Headline/name chrome leakage: Article.headline = `"MCP in production: what the spec doesn't tell you — Writing"` (title suffix); CollectionPage.name on project detail = `"Code Quality Metrics MCP — Projects"`; same suffix appears in og:title metadata. LLMs quoting these include trailing nav text. Fix: seo.ts should emit JSON-LD from the *raw* pre-suffix title (already has `rawTitle`/`titlePlain` paths); keep `description` capped for meta but uncapped for Article schema.

Tags never surface: post frontmatter tags `[mcp, agents, python, duckdb, architecture]` and project tags `[mcp, duckdb, analytics, python, agents]` are invisible in HTML (no chips/links) and absent from Article/Project JSON-LD `keywords`. RAG topic extraction must re-derive from prose. Fix: render tag list on post cards + detail + emit `keywords` in Article JSON-LD.

No llms.txt / llms-full.txt: both 404. Emerging agent-discovery convention; the site already has all inputs (sitemap, content.json, per-route meta). Fix: generate at prerender: person summary, capabilities, canonical URL list, last-updated stamp.

Contact & availability: /contact emits CollectionPage (not ContactPage/contactPoint); /now "Available for" list is prose-only with no structured marker; email unset by design (R8C-1/3 owner-gated — reference only, not re-reported). When email lands, emit ContactPage + contactPoint; also emit structured availability as-of date alongside the prose statement.

Hallucination risks: (1) title suffix pollution in headlines/descriptions leads LLM citations to include nav chrome; (2) site-wide boilerplate description makes all section pages interchangeable in RAG; (3) prose-only Now as-of date makes agents assert staleness (or miss it); (4) knowsAbout only 3 generic strings underclaims the site's actual capability breadth.

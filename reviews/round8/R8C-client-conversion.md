R8C-client-conversion review — buyer decision journey

=== BUYER DECISION READINESS: 6/10 ===

FINDINGS:

R8C-1 HIGH — Email unset blocks the first step: SITE.email is null, Contact page renders "Email contact is being set up" placeholder with DRAFT comment. A recruiter/hiring manager clicking "Get in touch" or "Start the conversation" lands on an unset mailbox. Fix: set SITE.email in src/lib/seo.ts or add a clear "set up email" onboarding step.

R8C-2 MEDIUM — No explicit engagement framework or pricing: The site describes skills and projects but has no engagement types, scope, deliverables, or pricing visible. A buyer cannot determine "what I'm hiring him FOR" at a glance beyond reading the Now/About pages. Fix: add an "Engagement" or "Services" page with named consulting offerings.

R8C-3 MEDIUM — Contact path requires owner setup: No real email → buyer must compose blank email to a non-existent address. The "Start the conversation" CTA is honest but creates friction. Fix: either configure SITE.email or add a clear next-step instruction (e.g., "email williams@alexrivera.dev").

R8C-4 LOW — "Now" page availability signal ambiguous: /now says "Available for" with 4 items but doesn't say if currently accepting engagements or if the 2-6 month window is open. Fix: add a clear availability status (e.g., "Now accepting engagements from Nov 2026").

R8C-5 LOW — Videos/Talks nav items hidden: /videos and /talks are filtered out of nav because content counts are 0, making the site look incomplete. Fix: either seed content or hide those nav items entirely.

SUMMARY: The portfolio is technically strong with real metrics and honest content, but the conversion funnel breaks at the contact step (unset email) and lacks a clear engagement framework. A buyer can determine what he DOES and has PROOF it worked, but stalls on HOW to start and what the engagement looks like.
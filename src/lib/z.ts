/**
 * The one door to zod for code that ships to the browser.
 *
 * zod compiles its object parsers with `new Function` when the page allows
 * it, and it finds out by trying. This site's Content-Security-Policy does not
 * allow eval (`script-src 'self'`), so the attempt always failed here, and
 * every page load logged a policy violation for it: a browser "issue" that
 * site audits count against the page.
 *
 * `jitless` tells zod not to try. Parsing takes the path it already took
 * under this policy: same schemas, same results, no probe.
 *
 * Import `z` from this module, never from 'zod' (src/lib/z.test.ts checks).
 */
import { z } from 'zod';

z.config({ jitless: true });

export { z };

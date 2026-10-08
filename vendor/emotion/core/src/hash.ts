/**
 * Deterministic string hash.
 *
 * Mirrors the algorithm shape used by emotion's `@emotion/hash`: a djb2-family
 * rolling hash over UTF-16 code units, rendered base36. Byte-identical output
 * with the published package is NOT guaranteed and is not required — what
 * matters for us is that identical CSS always yields the same class name across
 * server prerender and client hydration, and that collisions are rare enough to
 * be ignorable.
 */
export function hash(input: string): string {
  let h = 5381;
  let i = input.length;

  while (i) {
    h = (h * 33) ^ input.charCodeAt(--i);
  }

  /* `>>> 0` coerces to an unsigned 32-bit integer. */
  return (h >>> 0).toString(36);
}

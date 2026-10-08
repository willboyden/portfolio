/**
 * Convert Emotion's object style syntax into nested CSS text.
 *
 * Handles the subset the codebase uses: camelCase property names, nested
 * selectors (including `&`), conditional at-rules keyed by `@media`/`@supports`,
 * arrays of style objects, and `null`/`false` entries for conditional styling.
 */

type StyleObject = {
  [key: string]: string | number | null | undefined | false | StyleObject | StyleObject[] | Array<string | StyleObject>;
};

const camelToKebabCache = new Map<string, string>();

export function camelToKebab(prop: string): string {
  const cached = camelToKebabCache.get(prop);
  if (cached) return cached;
  if (prop.startsWith('--') || prop.startsWith('-webkit-') || prop.startsWith('-moz-')) {
    camelToKebabCache.set(prop, prop);
    return prop;
  }
  const kebab = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  camelToKebabCache.set(prop, kebab);
  return kebab;
}

function isObjectStyle(value: unknown): value is StyleObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Serialize one style object into nested CSS text (no selector wrapping). */
export function objectToCss(style: StyleObject): string {
  let css = '';

  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined || value === false) continue;

    if (Array.isArray(value)) {
      /* Either a fallback list of values (`['-webkit-box', 'flex']`) or a list
       * of nested style objects. */
      if (value.length === 0) continue;
      if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
        css += `${camelToKebab(key)}:${value.join(',')};`;
        continue;
      }
      for (const entry of value) {
        if (isObjectStyle(entry)) css += objectToCss(entry);
      }
      continue;
    }

    /* Nested key: either an at-rule (`'@media (min-width: 40em)': {...}`) or a
     * nested selector (`'&:hover': {...}`); both take the same shape here. */
    if (isObjectStyle(value)) {
      css += `${key} {${objectToCss(value)}}`;
      continue;
    }

    css += `${camelToKebab(key)}:${String(value)};`;
  }

  return css;
}

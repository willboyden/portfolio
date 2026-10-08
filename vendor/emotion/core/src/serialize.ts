/**
 * A deliberately small nested-CSS preprocessor.
 *
 * Supports the subset of nesting that Emotion made standard, which is the subset
 * this codebase uses:
 *
 *   - declarations, including custom properties (`--gap: 1rem`)
 *   - nested rules with `&` substitution (`.a { & b {} }`, `&:hover`, `&.b`)
 *   - conditional at-rules: `@media`, `@supports`, `@container`, `@layer`
 *   - statement at-rules emitted verbatim: `@keyframes`, `@font-face`, `@page`
 *   - `@import` statements
 *   - `//` line comments (stripped); block comments are dropped from output
 *
 * Malformed input throws with a slice of the offending text rather than being
 * silently mangled.
 */

export type Node =
  | { kind: 'decl'; text: string }
  | { kind: 'rule'; selector: string; body: Node[] }
  | { kind: 'at'; name: string; body: Node[] | null; raw: string | null }
  | { kind: 'stmt'; text: string };

const CONDITIONAL_AT = /^@(media|supports|container|layer|scope)\b/;
const VERBATIM_AT = /^@(keyframes|-webkit-keyframes|font-face|page|viewport|counter-style|property)\b/;

/** Strip `//` line comments that live outside strings and block comments. */
export function stripLineComments(css: string): string {
  let out = '';
  let inString: string | null = null;
  let inComment = false;

  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1];

    if (inComment) {
      if (ch === '*' && next === '/') {
        i += 1;
        inComment = false;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i += 1;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 1;
      inComment = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < css.length && css[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    out += ch;
  }
  return out;
}

/** Skip whitespace and block comments starting at `i`; returns the new index. */
function skipTrivia(css: string, i: number): number {
  for (;;) {
    while (i < css.length && /\s/.test(css.charAt(i))) i += 1;
    if (css.charAt(i) === '/' && css.charAt(i + 1) === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    return i;
  }
}

/**
 * Read one statement: either `...;` or `... { ... }`.
 * Returns the head text (before `{` or `;`), the body text (for blocks), and the
 * next index. `body === null` means the statement ended with `;`.
 */
function readStatement(css: string, start: number): { head: string; body: string | null; next: number } {
  let i = start;
  let depth = 0;

  while (i < css.length) {
    const ch = css[i];

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < css.length) {
        if (css[i] === '\\') {
          i += 2;
          continue;
        }
        if (css[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    if (ch === '(' || ch === '[') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === ')' || ch === ']') {
      depth -= 1;
      i += 1;
      continue;
    }
    if (depth === 0 && ch === ';') {
      return { head: css.slice(start, i), body: null, next: i + 1 };
    }
    if (depth === 0 && ch === '{') {
      /* Find the matching close brace. */
      let j = i + 1;
      let braces = 1;
      while (j < css.length && braces > 0) {
        const c = css[j];
        if (c === '"' || c === "'") {
          const quote = c;
          j += 1;
          while (j < css.length) {
            if (css[j] === '\\') {
              j += 2;
              continue;
            }
            if (css[j] === quote) {
              j += 1;
              break;
            }
            j += 1;
          }
          continue;
        }
        if (c === '/' && css[j + 1] === '*') {
          const end = css.indexOf('*/', j + 2);
          j = end === -1 ? css.length : end + 2;
          continue;
        }
        if (c === '{') braces += 1;
        else if (c === '}') braces -= 1;
        j += 1;
      }
      if (braces !== 0) {
        throw new Error(`[css-mini] unbalanced braces near "${css.slice(start, start + 48)}"`);
      }
      return { head: css.slice(start, i), body: css.slice(i + 1, j - 1), next: j };
    }
    i += 1;
  }

  const head = css.slice(start, i);
  /* Legal CSS may omit the final semicolon before EOF or `}` — return the text
   * and let the caller validate it as a declaration. */
  return { head, body: null, next: i };
}

/** Parse a nested CSS string into a node tree. Declarations at this level are `decl` nodes. */
export function parse(css: string): Node[] {
  const cleaned = stripLineComments(css);
  const nodes: Node[] = [];
  let i = skipTrivia(cleaned, 0);

  while (i < cleaned.length) {
    const { head, body, next } = readStatement(cleaned, i);
    const trimmed = head.trim();
    const advanced = skipTrivia(cleaned, next);
    if (advanced <= i) {
      /* Defensive: never spin on a statement that made no progress. */
      if (!trimmed) break;
      i = cleaned.length;
    } else {
      i = advanced;
    }
    if (!trimmed) continue;

    if (body === null) {
      if (trimmed.startsWith('@')) {
        /* Statement at-rule: `@import url(...)`, `@charset "..."`. */
        nodes.push({ kind: 'stmt', text: trimmed });
        continue;
      }
      if (!trimmed.includes(':')) {
        throw new Error(`[css-mini] not a declaration (missing ':'): "${trimmed.slice(0, 48)}"`);
      }
      nodes.push({ kind: 'decl', text: trimmed.replace(/\s+/g, ' ') });
      continue;
    }

    if (trimmed.startsWith('@')) {
      if (VERBATIM_AT.test(trimmed)) {
        nodes.push({ kind: 'at', name: trimmed, body: null, raw: body });
      } else {
        nodes.push({ kind: 'at', name: trimmed, body: parse(body), raw: null });
      }
      continue;
    }

    nodes.push({ kind: 'rule', selector: trimmed, body: parse(body) });
  }

  return nodes;
}

/** Substitute `&` in a nested selector for its parent, Emotion-style. */
export function joinSelectors(parent: string, nested: string): string {
  if (!parent) return nested;
  return nested
    .split(',')
    .map((part) => {
      const p = part.trim();
      if (!p) return parent;
      if (p.includes('&')) return p.replace(/&/g, parent);
      return `${parent} ${p}`;
    })
    .join(', ');
}

function normalizeDecls(nodes: Node[]): string[] {
  return nodes.filter((n): n is { kind: 'decl'; text: string } => n.kind === 'decl').map((n) => n.text);
}

function indent(text: string, pad = '  '): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n');
}

/** Split a comma-separated selector list, respecting functional notation. */
function splitSelectors(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out.filter(Boolean);
}

function flattenNodes(nodes: Node[], selector: string): string {
  const out: string[] = [];
  let pending: string[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    const declBlock = `  ${pending.join('; ')};`;
    for (const sel of splitSelectors(selector)) {
      out.push(`${sel} {\n${declBlock}\n}`);
    }
    pending = [];
  };

  for (const node of nodes) {
    if (node.kind === 'decl') {
      pending.push(node.text);
      continue;
    }

    if (node.kind === 'at') {
      if (node.raw !== null) {
        flush();
        out.push(`${node.name} {\n${indent(node.raw.trim())}\n}`);
        continue;
      }
      /* Conditional at-rules keep the current selector context; everything
       * else (e.g. a nested `@layer name { ... }`) resets to no parent so that
       * its inner selectors are emitted verbatim. */
      const innerSelector = CONDITIONAL_AT.test(node.name) ? selector : '';
      const inner = flattenNodes(node.body ?? [], innerSelector);
      if (!inner.trim()) continue;
      flush();
      out.push(`${node.name} {\n${indent(inner)}\n}`);
      continue;
    }

    if (node.kind === 'stmt') {
      flush();
      out.push(`${node.text};`);
      continue;
    }

    const joined = joinSelectors(selector, node.selector);
    const own = normalizeDecls(node.body);
    const rest = node.body.filter((n) => n.kind !== 'decl');

    if (own.length > 0) {
      flush();
      const declBlock = `  ${own.join('; ')};`;
      for (const sel of splitSelectors(joined)) {
        out.push(`${sel} {\n${declBlock}\n}`);
      }
    }
    if (rest.length > 0) {
      flush();
      out.push(flattenNodes(rest, joined));
    }
  }

  flush();
  return out.filter(Boolean).join('\n');
}

/**
 * Flatten nested CSS into plain CSS rules. `selector` is the base selector that
 * `&` refers to. Declarations written at the root of a `css` template land on
 * `selector` itself.
 */
export function flatten(nested: string, selector: string): string {
  const nodes = parse(nested);
  const rootDecls = normalizeDecls(nodes);
  const rest = nodes.filter((n) => n.kind !== 'decl');
  const out: string[] = [];

  if (rootDecls.length > 0) {
    out.push(`${selector} {\n  ${rootDecls.join('; ')};\n}`);
  }
  if (rest.length > 0) {
    out.push(flattenNodes(rest, selector));
  }
  return out.filter(Boolean).join('\n').trim();
}

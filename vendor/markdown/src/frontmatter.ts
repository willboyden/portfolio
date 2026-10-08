/**
 * Frontmatter parser — a deliberately small, LOUD YAML subset.
 *
 * Accepted grammar (documented so failures are predictable):
 *   key: value                    scalars: string / number / boolean / null /
 *                                 ISO date (YYYY-MM-DD) / quoted string
 *   key: "quoted: keeps colon"    single or double quotes, escapes \" \\ \n
 *   key: [a, b, "c d"]            inline flow arrays (one level)
 *   key:                          followed by `- item` lines → string array
 *   key:                          followed by indented `k: v` lines → nested
 *                                 mapping (two-space indent, one level deep,
 *                                 values may be scalars or inline arrays)
 *   key: >- / key: |+             folded/literal block scalars (indented lines)
 *
 * Anything else — tabs, anchors, aliases, multi-document markers (`---`
 * inside), flow mappings `{...}`, nested flow collections — THROWS with the
 * offending line number. Guessing silently is how content pipelines rot.
 */

export type Frontmatter = { data: Record<string, unknown>; body: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFrontmatter(src: string): Frontmatter {
  const normalized = src.replace(/\r\n?/g, '\n');
  if (!normalized.startsWith('---\n')) return { data: {}, body: normalized };
  // find closing fence: a line that is exactly --- or ... at column 0
  const lines = normalized.slice(4).split('\n');
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\.\.\.|---)[ \t]*$/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error('parseFrontmatter: opening `---` has no closing `---` — malformed frontmatter');
  }
  const data = parseYamlSubset(lines.slice(0, end));
  const body = lines.slice(end + 1).join('\n').replace(/^\n/, '');
  return { data, body };
}

function fail(lineNo: number, text: string, msg: string): never {
  throw new Error(`parseFrontmatter: line ${lineNo + 1} (${JSON.stringify(text)}): ${msg}`);
}

export function parseYamlSubset(lines: string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }
    if (/^\t/.test(raw) || raw.includes('\t')) fail(i, raw, 'tabs are not supported (spaces only)');
    if (raw !== trimmed && trimmed.startsWith('- ')) {
      fail(i, raw, 'top-level block sequence item found where a mapping key was expected');
    }
    const m = /^([A-Za-z0-9_][A-Za-z0-9_.\- ]*):(?:[ \t]+(.*))?$/.exec(trimmed);
    if (!m) fail(i, raw, 'expected `key: value`');
    const key = m[1]!.trim();
    const valueText = m[2];
    i++;
    if (valueText !== undefined && valueText !== '') {
      if (/^[-+?*&|{}]/.test(valueText) && !/^>\+?-.?[\s]*$/.test(valueText)) {
        if (!/^(>|<|\|-?|\+)$/.test(valueText.trim()) && valueText.trim() !== '') {
          fail(i - 1, raw, `unsupported YAML construct ${JSON.stringify(valueText)} (subset: scalars, inline [arrays], >- folds)`);
        }
      }
      if (/^\S*[{}]\s*$|^\{/.test(valueText)) fail(i - 1, raw, 'flow mappings {...} are not supported');
      const folded = /^(>|<)([+-]?)([+-]?)$/.exec(valueText.trim());
      if (folded) {
        const collect: string[] = [];
        while (i < lines.length && (lines[i]!.trim() === '' || /^ {2,}\S/.test(lines[i]!))) {
          collect.push(lines[i]!.trim());
          i++;
        }
        const joiner = folded[1] === '>' ? ' ' : '\n';
        data[key] = collect.join(joiner).trim();
        continue;
      }
      data[key] = parseScalar(valueText, i - 1, raw);
      continue;
    }
    // empty value: look ahead for a block sequence or nested mapping
    const block: string[] = [];
    while (i < lines.length) {
      const l = lines[i]!;
      if (l.trim() === '') {
        // a blank line only continues the block if the next line is still indented
        const next = lines[i + 1];
        if (next !== undefined && (next.startsWith('  ') || /^\s+-\s/.test(next))) {
          block.push('');
          i++;
          continue;
        }
        break;
      }
      if (/^ {2,}\S/.test(l) || /^\s+-\s/.test(l) || /^\s+-[\S]/.test(l)) {
        block.push(l);
        i++;
        continue;
      }
      break;
    }
    if (block.length === 0) {
      data[key] = null;
      continue;
    }
    if (block.every((l) => l.trim() === '' || /^\s*-/.test(l))) {
      const seq: unknown[] = [];
      for (const l of block) {
        if (l.trim() === '') continue;
        const sm = /^\s*-\s*(.*)$/.exec(l);
        if (!sm) fail(i, l, 'malformed block sequence item');
        seq.push(parseScalar(sm[1]!.trim(), i, l));
      }
      data[key] = seq;
      continue;
    }
    if (block.some((l) => l.trim() !== '' && !/^\s*-/.test(l)) && block.every((l) => l.trim() === '' || /^\s*[A-Za-z0-9_][^:]*:/.test(l))) {
      const nested: Record<string, unknown> = {};
      for (const l of block) {
        if (l.trim() === '') continue;
        const nm = /^\s*([A-Za-z0-9_][A-Za-z0-9_.\- ]*):(?:[ \t]+(.*))?$/.exec(l);
        if (!nm) fail(i, l, 'malformed nested mapping line');
        nested[nm[1]!.trim()] = nm[2] !== undefined && nm[2] !== '' ? parseScalar(nm[2]!.trim(), i, l) : null;
      }
      data[key] = nested;
      continue;
    }
    fail(i, raw, `unsupported block construct under key ${JSON.stringify(key)}`);
  }
  return data;
}

function parseScalar(text: string, lineNo: number, rawLine: string): unknown {
  const t = text.trim();
  if (t === '') return null;
  if (t === 'null' || t === '~' || t === 'Null' || t === 'NULL') return null;
  if (/^(true|True|TRUE|yes|Yes|on|On)$/.test(t)) return true;
  if (/^(false|False|FALSE|no|No|off|Off)$/.test(t)) return false;
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    return decodeDoubleQuoted(t.slice(1, -1), lineNo, rawLine);
  }
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  if (t.startsWith('[')) {
    if (!t.endsWith(']')) fail(lineNo, rawLine, 'unterminated inline array');
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlow(inner, lineNo, rawLine).map((part) => parseScalar(part, lineNo, rawLine));
  }
  if (/[{}[\]]/.test(t)) fail(lineNo, rawLine, `unsupported inline structure ${JSON.stringify(t)}`);
  if (t.includes(': ') || t.endsWith(':')) {
    fail(lineNo, rawLine, 'unquoted value contains `: ` — quote the string');
  }
  if (ISO_DATE.test(t)) {
    const d = new Date(t + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) fail(lineNo, rawLine, 'invalid ISO date');
    return t; // keep dates as canonical strings — JSON has no date type
  }
  if (/^[-+]?\d+$/.test(t)) return parseInt(t, 10);
  if (/^[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?$/.test(t)) return parseFloat(t);
  return t;
}

function splitFlow(inner: string, lineNo: number, raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (const c of inner) {
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === '[') depth++;
    if (c === ']') {
      fail(lineNo, raw, 'nested inline arrays are not supported');
    }
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function decodeDoubleQuoted(s: string, lineNo: number, raw: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '\\') {
      const n = s[++i];
      if (n === '"') out += '"';
      else if (n === '\\') out += '\\';
      else if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else fail(lineNo, raw, `unknown escape \\${String(n)}`);
      continue;
    }
    if (c === '"') fail(lineNo, raw, 'unescaped double quote inside quoted scalar');
    out += c;
  }
  return out;
}

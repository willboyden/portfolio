/**
 * Block-level markdown parsing for vendor/markdown.
 *
 * Supported blocks: ATX headings (#..######, closing ## optional, id attrs via
 * deriveHeadingId), paragraphs, fenced code (``` and ~~~, info-string →
 * language-* class), indented code (4 spaces), blockquotes, thematic breaks
 * (***, ---, ___), ordered + unordered lists with arbitrary nesting, and GFM
 * pipe tables with alignment. Setext headings are deliberately unsupported
 * (they collide with frontmatter/paginated content) — `===` under a line stays
 * a paragraph.
 *
 * SECURITY: raw HTML lines are not a block type here on purpose — they fall
 * through to paragraph parsing where the inline engine escapes them, so HTML
 * from untrusted markdown is never emitted as markup (see inline.ts header).
 */

import { escapeText, renderInline } from './inline.ts';

export type HeadingIdFn = (text: string) => string;

type Para = { kind: 'para'; lines: string[] };
type Heading = { kind: 'heading'; level: number; text: string };
type Code = { kind: 'code'; info: string; lines: string[] };
type Quote = { kind: 'quote'; lines: string[] };
type Rule = { kind: 'rule' };
type Table = { kind: 'table'; header: string[]; align: (string | null)[]; rows: string[][] };
type ListItem = { lines: string[] };
type List = { kind: 'list'; ordered: boolean; start: number; items: ListItem[]; loose: boolean };
type Blk = Para | Heading | Code | Quote | Rule | Table | List;

const RE_ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RE_FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^`\n]*)$/;
const RE_UL = /^( {0,3})([-+*])(?:([ \t]+)|$)/;
const RE_OL = /^( {0,3})(\d{1,9})([.)])(?:([ \t]+)|$)/;
const RE_QUOTE = /^ {0,3}>/;
const RE_TABLE_DELIM = /^ {0,3}\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/;

function isThematicBreak(line: string): boolean {
  const t = line.replace(/[ \t]/g, '');
  return t.length >= 3 && (/^\*+$/.test(t) || /^-+$/.test(t) || /^_+$/.test(t));
}

/** Block start that interrupts a paragraph, per CommonMark (loosened). */
function isBlockStart(line: string): boolean {
  return (
    RE_ATX.test(line) ||
    RE_FENCE.test(line) ||
    isThematicBreak(line) ||
    RE_UL.test(line) ||
    RE_OL.test(line) ||
    RE_QUOTE.test(line)
  );
}

const indentOf = (line: string): number => /^ */.exec(line)![0].replace(/\t/g, '    ').length;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (c === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function tableAligns(delims: string[]): (string | null)[] {
  return delims.map((d) => {
    const t = d.trim();
    const l = t.startsWith(':');
    const r = t.endsWith(':');
    if (l && r) return 'center';
    if (r) return 'right';
    if (l) return 'left';
    return null;
  });
}

function looksLikeTable(lines: string[], i: number): boolean {
  const head = lines[i];
  const delim = lines[i + 1];
  if (head === undefined || delim === undefined) return false;
  return head.includes('|') && RE_TABLE_DELIM.test(delim) && splitRow(head).length === splitRow(delim).length;
}

function parseBlocks(lines: string[]): Blk[] {
  const blocks: Blk[] = [];
  let i = 0;
  const n = lines.length;
  while (i < n) {
    const line = lines[i]!;
    if (line.trim() === '') {
      i++;
      continue;
    }
    let m = RE_ATX.exec(line);
    if (m) {
      blocks.push({ kind: 'heading', level: m[1]!.length, text: (m[2] ?? '').trim() });
      i++;
      continue;
    }
    if (isThematicBreak(line)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }
    m = RE_FENCE.exec(line);
    if (m) {
      const fence = m[2]!;
      const info = m[3]!.trim();
      const fenceIndent = m[1]!.length;
      const exactClose = new RegExp('^ {0,3}' + fence[0]!.repeat(fence.length) + '[ \\t]*$');
      const body: string[] = [];
      i++;
      while (i < n && !exactClose.test(lines[i]!)) {
        // CommonMark: strip at most the FENCE's own indentation from body
        // lines — blindly removing up to 3 spaces corrupted indented code.
        body.push(lines[i]!.slice(fenceIndent));
        i++;
      }
      i++; // consume closing fence (or run off the end — tolerate unclosed)
      blocks.push({ kind: 'code', info, lines: body });
      continue;
    }
    if (RE_QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < n && lines[i]!.trim() !== '' && (RE_QUOTE.test(lines[i]!) || !isBlockStart(lines[i]!))) {
        inner.push(lines[i]!.replace(/^ {0,3}> ?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', lines: inner });
      continue;
    }
    if (looksLikeTable(lines, i)) {
      const header = splitRow(lines[i]!);
      const align = tableAligns(splitRow(lines[i + 1]!));
      i += 2;
      const rows: string[][] = [];
      while (i < n && lines[i]!.trim() !== '' && lines[i]!.includes('|') && !isBlockStart(lines[i]!)) {
        const cells = splitRow(lines[i]!);
        while (cells.length < align.length) cells.push('');
        rows.push(cells.slice(0, align.length));
        i++;
      }
      blocks.push({ kind: 'table', header, align, rows });
      continue;
    }
    const listRe = RE_UL.test(line) ? RE_UL : RE_OL.test(line) && !isHrDashLine(line) ? RE_OL : null;
    if (listRe) {
      const first = listRe.exec(line)!;
      const ordered = listRe === RE_OL;
      const startNum = ordered ? parseInt(first[2]!, 10) : 1;
      const baseIndent = first[1]!.length;
      const markerWidth = first[0].length - baseIndent;
      const items: ListItem[] = [];
      let loose = false;
      let sawBlank = false;
      while (i < n) {
        const l = lines[i]!;
        if (l.trim() === '') {
          const next = lines[i + 1];
          const isItemStart = next !== undefined && ((ordered && RE_OL.test(next)) || (!ordered && RE_UL.test(next))) && indentOf(next) === baseIndent;
          // After a blank line the list continues only with an indented line (more of the item) or a new item.
          // An unindented paragraph ends the list (CommonMark); it used to be folded into the last item.
          if (next !== undefined && (indentOf(next) >= baseIndent + markerWidth || isItemStart)) {
            sawBlank = true;
            loose = true;
            i++;
            continue;
          }
          break;
        }
        if (sawBlank) {
          loose = true;
          sawBlank = false;
        }
        const im = (ordered ? RE_OL : RE_UL).exec(l);
        if (im && im[1]!.length === baseIndent) {
          const w = im[0].length - im[1]!.length;
          const rest = l.slice(im[0].length);
          items.push({ lines: [rest.trimStart() === '' ? '' : rest.replace(/^[ \t]+/, '')] });
          void w;
          i++;
          continue;
        }
        if (indentOf(l) >= baseIndent + markerWidth) {
          const strip = Math.min(indentOf(l), baseIndent + markerWidth);
          items[items.length - 1]!.lines.push(l.slice(strip));
          i++;
          continue;
        }
        if (!isBlockStart(l)) {
          // lazy paragraph continuation
          items[items.length - 1]!.lines.push(l.trimStart());
          i++;
          continue;
        }
        break;
      }
      blocks.push({ kind: 'list', ordered, start: startNum, items, loose });
      continue;
    }
    if (indentOf(line) >= 4 && (blocks.length === 0 || blocks[blocks.length - 1]!.kind !== 'para')) {
      const body: string[] = [];
      while (i < n && lines[i]!.trim() !== '' && indentOf(lines[i]!) >= 4) {
        body.push(lines[i]!.slice(4));
        i++;
      }
      blocks.push({ kind: 'code', info: '', lines: body });
      continue;
    }
    // paragraph
    {
      const body: string[] = [line];
      i++;
      while (
        i < n &&
        lines[i]!.trim() !== '' &&
        !isBlockStart(lines[i]!) &&
        !(indentOf(lines[i]!) >= 4) &&
        !looksLikeTable(lines, i)
      ) {
        body.push(lines[i]!);
        i++;
      }
      blocks.push({ kind: 'para', lines: body });
    }
  }
  return blocks;
}

function isHrDashLine(line: string): boolean {
  return /^ {0,3}(?:- ){3,}$/.test(line) || /^ {0,3}---+$/.test(line);
}

function renderBlocks(blocks: Blk[], headingId: HeadingIdFn): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': {
        const inline = renderInline(b.text);
        const id = headingId(plainText(b.text));
        parts.push(`<h${b.level} id="${id}">${inline}</h${b.level}>`);
        break;
      }
      case 'para':
        parts.push(`<p>${renderInline(b.lines.join('\n'))}</p>`);
        break;
      case 'code': {
        const lang = b.info.split(/\s+/)[0];
        const cls = lang ? ` class="language-${escapeText(lang)}"` : '';
        parts.push(`<pre><code${cls}>${escapeText(b.lines.join('\n'))}\n</code></pre>`);
        break;
      }
      case 'quote':
        parts.push(`<blockquote>\n${renderBlocks(parseBlocks(b.lines), headingId)}\n</blockquote>`);
        break;
      case 'rule':
        parts.push('<hr />');
        break;
      case 'table': {
        const th = b.header
          .map((c, i) => `<th${alignAttr(b.align[i])}>${renderInline(c)}</th>`)
          .join('');
        const body = b.rows
          .map((r) => `<tr>${r.map((c, i) => `<td${alignAttr(b.align[i])}>${renderInline(c)}</td>`).join('')}</tr>`)
          .join('\n');
        parts.push(
          `<table>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`,
        );
        break;
      }
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        const startAttr = b.ordered && b.start !== 1 ? ` start="${b.start}"` : '';
        const items = b.items.map((it) => renderItem(it, b.loose, headingId)).join('\n');
        parts.push(`<${tag}${startAttr}>\n${items}\n</${tag}>`);
        break;
      }
    }
  }
  return parts.join('\n');
}

function alignAttr(a: string | null | undefined): string {
  return a ? ` style="text-align:${a}"` : '';
}

function renderItem(item: ListItem, loose: boolean, headingId: HeadingIdFn): string {
  const blocks = parseBlocks(item.lines);
  const out: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.kind === 'para' && !loose && i === 0) {
      out.push(renderInline(b.lines.join('\n')));
    } else if (b.kind === 'list') {
      out.push(renderBlocks([b], headingId));
    } else {
      out.push(renderBlocks([b], headingId));
    }
  }
  return `<li>${out.join(' ')}</li>`;
}

/** Rough markdown→plain text (for heading slugs + word counts). */
export function plainText(src: string): string {
  return src
    .replace(/<[^>]*>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/[*_]{1,3}/g, '')
    .replace(/\\([\\!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g, '$1')
    .trim();
}

/** Parse + render a body (frontmatter already stripped) to HTML. */
export function renderBody(src: string, headingId: HeadingIdFn): string {
  const normalized = src.replace(/\r\n?/g, '\n').replace(/ {2,}\n/g, '  \n');
  return renderBlocks(parseBlocks(normalized.split('\n')), headingId);
}

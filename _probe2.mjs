// scratch probe 2 — delete before finishing
import { renderMarkdown, parseFrontmatter, deriveHeadingId, readingMinutes, plainText } from './vendor/markdown/src/index.ts';

const show = (name, fn) => {
  let v;
  try { v = fn(); } catch (e) { v = 'THROWS: ' + String(e).slice(0, 80); }
  console.log('=== ' + name + ' ===\n' + JSON.stringify(v) + '\n');
};

show('em nesting', () => renderMarkdown('*a **b** c*'));
show('strong em', () => renderMarkdown('***both***'));
show('em simple', () => renderMarkdown('*em* and **strong**'));
show('bold then newline', () => renderMarkdown('**bold**\nmore'));
show('bold then space', () => renderMarkdown('**bold** more'));
show('em then newline', () => renderMarkdown('*em*\nmore'));
show('snake', () => renderMarkdown('snake_case_word and _italic_'));
show('em math', () => renderMarkdown('2 * 3 * 4 is 12'));
show('trailing stars', () => renderMarkdown('wow***'));
show('unbalanced', () => renderMarkdown('a * b c * d'));
show('3 in middle', () => renderMarkdown('foo *bar* baz'));
show('bold italic sep', () => renderMarkdown('**a *b* c**'));
show('nested quote in quote', () => renderMarkdown('> outer\n> > inner'));
show('heading inline', () => renderMarkdown('## The `fast` way [x](https://e.io)'));
show('der', () => [deriveHeadingId('Hello, World!'), deriveHeadingId('  Multiple   Spaces  '), deriveHeadingId('Café Ünicode 123'), deriveHeadingId('')]);
show('reading', () => [readingMinutes('word '.repeat(200)), readingMinutes('word '.repeat(450)), readingMinutes('hi'), readingMinutes('word '.repeat(300) + '\n\n```\n' + 'code word '.repeat(2000) + '\n```\n')]);
show('plainText', () => plainText('# Head\n\nsome **bold** and `code` [link](http://x) ![i](y)'));
show('frontmatter', () => parseFrontmatter('---\ntitle: My Post\nday: 2026-08-16\ncount: 42\nratio: 1.5\nflag: true\nnothing: null\nevent: "quoted: keeps colon"\ntags: [a, b, "c d"]\nlinks:\n  source: https://x.dev\n  demo: [1, 2]\nitems:\n  - one\n  - two\nsummary: >-\n  folded line one\n  folded line two\n---\n\n# body\n'));
show('fm unclosed', () => parseFrontmatter('---\na: 1\n'));
show('fm tab', () => parseFrontmatter('---\ntab:\tbad\n---\n'));
show('fm colon', () => parseFrontmatter('---\nx: unquoted: colon\n---\n'));
show('no fm', () => parseFrontmatter('# just body'));
show('fm --- body', () => parseFrontmatter('---\n---\na: 1'));
show('fm dots close', () => parseFrontmatter('---\na: 1\n...\nbody'));
show('indented code', () => renderMarkdown('para\n\n    code & <b>\n    line2'));
show('setext unsupported', () => renderMarkdown('Title\n====='));
show('list with code', () => renderMarkdown('- item\n\n  ```js\n  const a = 1;\n  ```'));
show('tight list', () => renderMarkdown('- one\n- two'));

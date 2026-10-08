// scratch probe — delete before finishing
import { renderMarkdown, parseFrontmatter, deriveHeadingId, readingMinutes, plainText } from './vendor/markdown/src/index.ts';

const show = (name, v) => console.log('=== ' + name + ' ===\n' + JSON.stringify(v) + '\n');

show('script escape', renderMarkdown('<script>alert(1)</script>'));
show('js href', renderMarkdown('[x](javascript:alert(1))'));
show('data href', renderMarkdown('[x](data:text/html;base64,PHNjcmlwdD4=)'));
show('rel href', renderMarkdown('[docs](./pages/a) and [ext](https://example.com) and [mail](mailto:a@b.c)'));
show('protocol rel', renderMarkdown('[x](//evil.example)'));
show('autolink', renderMarkdown('<https://example.com> <a@b.com>'));
show('title attr', renderMarkdown('[t](https://e.com "He said \\"hi\\"")'));
show('img', renderMarkdown('![alt <x>](/img/a.png "t")'));
show('inline code', renderMarkdown('use `a < b && c > d` now'));
show('nested list', renderMarkdown('- one\n  - nested a\n  - nested b\n- two'));
show('ol start', renderMarkdown('3. c\n4. d'));
show('loose list', renderMarkdown('- one\n\n- two'));
show('fence py', renderMarkdown('```python\ndef f(x):\n    return x < 2\n```'));
show('fence none', renderMarkdown('~~~\nplain & <code>\n~~~'));
show('quote', renderMarkdown('> quoted **bold**\n> more'));
show('quote nested', renderMarkdown('> a\n>\n> b'));
show('link+img+code', renderMarkdown('See [docs](https://d.io) ![pic](p.png) `x()` ok'));
show('heading id', renderMarkdown('## Hello, World!'));
show('dup headings', renderMarkdown('# Test\n\n# Test\n\n# Test'));
show('em nesting', renderMarkdown('*a **b** c*'));
show('strong em', renderMarkdown('***both***'))
show('snake', renderMarkdown('snake_case_word and _italic_'));
show('em math', renderMarkdown('2 * 3 * 4 is 12'));
show('rule', renderMarkdown('---'));
show('hr after para', renderMarkdown('para\n\n***\n\nnext'));
show('table', renderMarkdown('| a | b |\n|:--|--:|\n| 1 | 2 |'));
show('hard break', renderMarkdown('line1  \nline2'));
show('backslash', renderMarkdown('a\\*b'));
show('html comment', renderMarkdown('<!-- hidden -->'));
show('der', [deriveHeadingId('Hello, World!'), deriveHeadingId('  Multiple   Spaces  '), deriveHeadingId('Café Ünicode 123'), deriveHeadingId('')]);
show('reading', [readingMinutes('word '.repeat(200)), readingMinutes('word '.repeat(450)), readingMinutes('hi'), readingMinutes('word '.repeat(300) + '\n\n```\n' + 'code word '.repeat(2000) + '\n```\n')]);
show('plainText', plainText('# Head\n\nsome **bold** and `code` [link](http://x) ![i](y)'));
const fm = parseFrontmatter('---\ntitle: My Post\nday: 2026-08-16\ncount: 42\nratio: 1.5\nflag: true\nnothing: null\nevent: "quoted: keeps colon"\ntags: [a, b, "c d"]\nlinks:\n  source: https://x.dev\n  demo: [1, 2]\nitems:\n  - one\n  - two\nsummary: >-\n  folded line one\n  folded line two\n---\n\n# body\n');
show('frontmatter', fm);
try { parseFrontmatter('---\na: 1\n'); } catch (e) { show('fm throws unclosed', String(e).slice(0, 90)); }
try { parseFrontmatter('---\ntab:\tbad\n---\n'); } catch (e) { show('fm throws tab', String(e).slice(0, 110)); }
try { parseFrontmatter('---\nx: unquoted: colon\n---\n'); } catch (e) { show('fm throws colon', String(e).slice(0, 120)); }
show('no fm', parseFrontmatter('# just body'));

import { renderMarkdown, deriveHeadingId, readingMinutes, parseFrontmatter } from './src/index.ts';

const cases = [
  '# Hello World',
  '## Hello `World`',
  'Some **bold** and *ital* and ***both*** and `code`.',
  '[link](https://x.com) [bad](javascript:alert(1)) ![img](/a.png)',
  'text [a](https://a.io) mid [b](https://b.io) tail',
  'before <https://auto.link> after <script>alert(1)</script> and me@x.com',
  '- a\n- b\n  - b1\n  - b2\n- c',
  '1. one\n2. two',
  '> quote\n> more\n>\n> second para',
  '```js\nconst x = 1 < 2 && 3 > 2;\n```',
  '~~~\ntilde fence\n~~~',
    '    indented code\n    line2',
  '---',
  '| a | b |\n|:--|--:|\n| 1 | 2 |',
  'line  \nhard break',
  'a_b_c snake *and **nested** emph*',
  '*a **b** c*',
  '**foo****bar**',
  'snake_case_word stays',
  '# Test\n# Test\n# Test',
  'Para one\n\nPara two',
  '![bad](javascript:x) after',
  '<javascript:alert(1)> blocked',
  'esc \\*not emph\\* and \\# not head',
  '`` code ` with backtick ``',
];
for (const c of cases) {
  console.log('=== ' + JSON.stringify(c));
  console.log(renderMarkdown(c));
}
console.log('slug:', deriveHeadingId('Hello, World! (v2)'));
console.log('read400:', readingMinutes('word '.repeat(400)), 'readCode:', readingMinutes('```py\n' + 'code '.repeat(1000) + '\n```'), 'readMin:', readingMinutes('tiny'));
console.log(JSON.stringify(parseFrontmatter('---\ntitle: Hi\ncount: 3\nok: true\nwhen: 2026-08-16\nnothing: null\nq: "quoted: colon"\ntags: [a, b, "c d"]\nnested:\n  x: 1\n  y: two\nfold: >-\n  one\n  two\n---\nBody *here*'), null, 1));
try { parseFrontmatter('---\ntitle: Hi\nno closing'); } catch (e) { console.log('ERR1:', (e as Error).message); }
try { parseFrontmatter('---\nbad line here\n---\n'); } catch (e) { console.log('ERR2:', (e as Error).message); }

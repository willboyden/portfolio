import { renderMarkdown, deriveHeadingId, readingMinutes, parseFrontmatter } from './src/index.ts';

const cases = [
  '# Hello World',
  '## Hello `World`',
  'Some **bold** and *ital* and ***both*** and `code`.',
  '[link](https://x.com) [bad](javascript:alert(1)) ![img](/a.png)',
  '- a\n- b\n  - b1\n  - b2\n- c',
  '1. one\n2. two',
  '> quote\n> more',
  '```js\nconst x = 1 < 2 && 3 > 2;\n```',
  '---',
  '| a | b |\n|:--|--:|\n| 1 | 2 |',
  'line  \nnested hard break',
  '<script>alert(1)</script> plain',
  'a_b_c snake *and **nested* emph*',
  '# Test\n# Test\n# Test',
  'Para one\n\nPara two',
];
for (const c of cases) {
  console.log('=== ' + JSON.stringify(c));
  console.log(renderMarkdown(c));
}
console.log('slug:', deriveHeadingId('Hello, World! (v2)'));
console.log('read:', readingMinutes('word '.repeat(400)), readingMinutes('```py\n' + 'code '.repeat(1000) + '\n```'));
console.log(parseFrontmatter('---\ntitle: Hi\ntags: [a, b]\nnested:\n  x: 1\n---\nBody *here*'));

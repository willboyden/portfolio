/**
 * Unit tests for vendor/markdown — the dependency-free CommonMark-subset
 * engine behind scripts/build-content.mjs.
 *
 * These were written against the engine's ACTUAL behaviour (probed first,
 * not wished for). Several assertions encode deliberate security decisions:
 * raw HTML is escaped, not passed through, and dangerous URL schemes produce
 * inert literal text instead of anchors.
 */
import { describe, expect, it } from 'vitest';
import {
  renderMarkdown,
  parseFrontmatter,
  deriveHeadingId,
  readingMinutes,
  plainText,
} from './src/index.ts';

/* ------------------------------------------------------------------ *
 * SECURITY — XSS surface
 * ------------------------------------------------------------------ */

describe('security: escaping and URL hygiene', () => {
  it('escapes a raw <script> tag instead of passing it through', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('escapes raw HTML closing tags and HTML comments as literal text', () => {
    const html = renderMarkdown('a <img src=x onerror=alert(1)> b <!-- c -->');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;!-- c --&gt;');
  });

  it('neutralizes javascript: link destinations to inert escaped text', () => {
    const html = renderMarkdown('[x](javascript:alert(1))');
    // The dangerous scheme never reaches an href; the markdown stays as
    // fully-escaped literal text (safe, visible, inert).
    expect(html).not.toContain('<a');
    expect(html).not.toMatch(/href=/);
    expect(html).toBe('<p>[x](javascript:alert(1))</p>');
  });

  it('neutralizes data: URIs and protocol-relative //host URLs', () => {
    expect(renderMarkdown('[x](data:text/html;base64,PHNjcmlwdD4=)')).not.toContain('<a');
    expect(renderMarkdown('[x](//evil.example)')).not.toContain('<a');
  });

  it('neutralizes javascript: inside image destinations', () => {
    const html = renderMarkdown('![a](javascript:alert(1))');
    expect(html).not.toContain('<img');
    expect(html).toBe('<p>![a](javascript:alert(1))</p>');
  });

  it('escapes &, <, >, " inside text, code spans and hrefs', () => {
    expect(renderMarkdown('AT&T & C')).toBe('<p>AT&amp;T &amp; C</p>');
    expect(renderMarkdown('use `a < b && c > d` now')).toBe(
      '<p>use <code>a &lt; b &amp;&amp; c &gt; d</code> now</p>',
    );
    expect(renderMarkdown('[ok](https://ex.com/a?d=1&e=2)')).toBe(
      '<p><a href="https://ex.com/a?d=1&amp;e=2">ok</a></p>',
    );
  });

  it('cannot be broken out of a title attribute by an embedded quote', () => {
    // A raw " aborts the link match entirely -> fully escaped literal text;
    // no anchor element and no unescaped quote can exist in any attribute.
    const html = renderMarkdown('[x]("onmouseover=alert(1) on")');
    expect(html).not.toContain('<a');
    expect(html).not.toMatch(/"/); // every quote came out as &quot;
  });

  it('allows only http/https/mailto/relative destinations', () => {
    const html = renderMarkdown('[a](./pages/x) [b](https://e.io) [c](mailto:a@b.com)');
    expect(html).toContain('<a href="./pages/x">');
    expect(html).toContain('<a href="https://e.io">');
    expect(html).toContain('<a href="mailto:a@b.com">');
  });

  it('renders <https://…> autolinks and e-mail autolinks, escaped', () => {
    expect(renderMarkdown('<https://example.com> <a@b.com>')).toBe(
      '<p><a href="https://example.com">https://example.com</a> <a href="mailto:a@b.com">a@b.com</a></p>',
    );
  });
});

/* ------------------------------------------------------------------ *
 * Blocks
 * ------------------------------------------------------------------ */

describe('blocks', () => {
  it('renders fenced code with a language-* class and escaped body', () => {
    expect(renderMarkdown('```python\ndef f(x):\n    return x < 2\n```')).toBe(
      '<pre><code class="language-python">def f(x):\n    return x &lt; 2\n</code></pre>',
    );
  });

  it('renders tilde fences and untagged fences without a class', () => {
    expect(renderMarkdown('~~~\nplain & <code>\n~~~')).toBe(
      '<pre><code>plain &amp; &lt;code&gt;\n</code></pre>',
    );
  });

  it('renders nested unordered lists with correct nesting', () => {
    expect(renderMarkdown('- one\n  - nested a\n  - nested b\n- two')).toBe(
      '<ul>\n<li>one <ul>\n<li>nested a</li>\n<li>nested b</li>\n</ul></li>\n<li>two</li>\n</ul>',
    );
  });

  it('honours ordered-list start numbers', () => {
    expect(renderMarkdown('3. c\n4. d')).toBe('<ol start="3">\n<li>c</li>\n<li>d</li>\n</ol>');
  });

  it('wraps tight list items bare and loose items in <p>', () => {
    expect(renderMarkdown('- one\n- two')).toBe('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    expect(renderMarkdown('- one\n\n- two')).toBe('<ul>\n<li><p>one</p></li>\n<li><p>two</p></li>\n</ul>');
  });

  it('renders blockquotes with inline markup and lazy continuation', () => {
    expect(renderMarkdown('> quoted **bold**\n> more')).toBe(
      '<blockquote>\n<p>quoted <strong>bold</strong>\nmore</p>\n</blockquote>',
    );
  });

  it('splits paragraph blocks inside a blockquote on blank quote lines', () => {
    expect(renderMarkdown('> a\n>\n> b')).toBe(
      '<blockquote>\n<p>a</p>\n<p>b</p>\n</blockquote>',
    );
  });

  it('nests a list inside a blockquote', () => {
    expect(renderMarkdown('> - a\n> - b')).toBe(
      '<blockquote>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n</blockquote>',
    );
  });

  it('renders thematic breaks', () => {
    expect(renderMarkdown('---')).toBe('<hr />');
    expect(renderMarkdown('para\n\n***\n\nnext')).toBe('<p>para</p>\n<hr />\n<p>next</p>');
  });

  it('renders GFM pipe tables with alignment styles', () => {
    const html = renderMarkdown('| a | b |\n|:--|--:|\n| 1 | 2 |');
    expect(html).toContain('<th style="text-align:left">a</th>');
    expect(html).toContain('<th style="text-align:right">b</th>');
    expect(html).toContain('<td style="text-align:right">2</td>');
  });

  it('supports a fenced code block inside a loose list item', () => {
    expect(renderMarkdown('- item\n\n  ```js\n  const a = 1;\n  ```')).toContain(
      '<pre><code class="language-js">const a = 1;\n</code></pre>',
    );
  });
});

/* ------------------------------------------------------------------ *
 * Headings + ids
 * ------------------------------------------------------------------ */

describe('headings and heading ids', () => {
  it('assigns GitHub-style ids to headings', () => {
    expect(renderMarkdown('## Hello, World!')).toBe('<h2 id="hello-world">Hello, World!</h2>');
  });

  it('deduplicates repeated heading ids with numeric suffixes', () => {
    expect(renderMarkdown('# Test\n\n# Test\n\n# Test')).toBe(
      '<h1 id="test">Test</h1>\n<h1 id="test-1">Test</h1>\n<h1 id="test-2">Test</h1>',
    );
  });

  it('renders inline markup inside headings', () => {
    expect(renderMarkdown('## The `fast` way [x](https://e.io)')).toBe(
      '<h2 id="the-way-x">The <code>fast</code> way <a href="https://e.io">x</a></h2>',
    );
  });

  it('accepts h1-h6 but not seven hashes', () => {
    expect(renderMarkdown('###### deep')).toBe('<h6 id="deep">deep</h6>');
    expect(renderMarkdown('####### nope')).toBe('<p>####### nope</p>');
  });

  it('deriveHeadingId: lowercases, strips punctuation, hyphenates whitespace', () => {
    expect(deriveHeadingId('Hello, World!')).toBe('hello-world');
    expect(deriveHeadingId('  Multiple   Spaces  ')).toBe('multiple-spaces');
    expect(deriveHeadingId('Café Ünicode 123')).toBe('café-ünicode-123');
    expect(deriveHeadingId('***')).toBe('');
  });
});

/* ------------------------------------------------------------------ *
 * Inlines
 * ------------------------------------------------------------------ */

describe('inline constructs', () => {
  it('renders links, images and inline code together', () => {
    expect(renderMarkdown('See [docs](https://d.io) ![pic](p.png) `x()` ok')).toBe(
      '<p>See <a href="https://d.io">docs</a> <img src="p.png" alt="pic" /> <code>x()</code> ok</p>',
    );
  });

  it('renders image alt/title with escaping', () => {
    expect(renderMarkdown('![alt <x>](/img/a.png "t")')).toBe(
      '<p><img src="/img/a.png" alt="alt &lt;x&gt;" title="t" /></p>',
    );
  });

  it('renders a link title attribute', () => {
    expect(renderMarkdown('[t](https://e.com "note")')).toBe(
      '<p><a href="https://e.com" title="note">t</a></p>',
    );
  });

  it('handles emphasis edge cases', () => {
    expect(renderMarkdown('*a **b** c*')).toBe('<p><em>a <strong>b</strong> c</em></p>');
    expect(renderMarkdown('***both***')).toBe('<p><em><strong>both</strong></em></p>');
    expect(renderMarkdown('**a *b* c**')).toBe('<p><strong>a <em>b</em> c</strong></p>');
    expect(renderMarkdown('**use `code` here**')).toBe('<p><strong>use <code>code</code> here</strong></p>');
  });

  it('keeps underscores inside snake_case words literal', () => {
    expect(renderMarkdown('snake_case_word and _italic_')).toBe(
      '<p>snake_case_word and <em>italic</em></p>',
    );
  });

  it('does not treat spaced arithmetic asterisks as emphasis', () => {
    expect(renderMarkdown('2 * 3 * 4 is 12')).toBe('<p>2 * 3 * 4 is 12</p>');
    expect(renderMarkdown('a * b c * d')).toBe('<p>a * b c * d</p>');
  });

  it('treats backslash-escaped punctuation as literal, never a delimiter', () => {
    expect(renderMarkdown('a\\*b \\_c\\_')).toBe('<p>a*b _c_</p>');
  });

  it('emits <br /> on two-space hard breaks', () => {
    expect(renderMarkdown('line1  \nline2')).toBe('<p>line1<br />\nline2</p>');
  });
});

/* ------------------------------------------------------------------ *
 * readingMinutes / plainText
 * ------------------------------------------------------------------ */

describe('readingMinutes + plainText', () => {
  it('counts ~200 wpm with a floor of 1', () => {
    expect(readingMinutes('word '.repeat(50))).toBe(1);
    expect(readingMinutes('word '.repeat(200))).toBe(1);
    expect(readingMinutes('word '.repeat(450))).toBe(2);
  });

  it('excludes fenced code from the word count', () => {
    const prose = 'word '.repeat(250);
    const withCode = prose + '\n```\n' + 'code word '.repeat(2000) + '\n```\n';
    expect(readingMinutes(withCode)).toBe(readingMinutes(prose));
  });

  it('plainText strips markdown scaffolding', () => {
    expect(plainText('some **bold** and `code` [link](http://x) ![i](y)')).toBe(
      'some bold and  link i',
    );
  });
});

/* ------------------------------------------------------------------ *
 * Frontmatter
 * ------------------------------------------------------------------ */

describe('parseFrontmatter', () => {
  const FM = [
    '---',
    'title: My Post',
    'day: 2026-08-16',
    'count: 42',
    'ratio: 1.5',
    'flag: true',
    'nothing: null',
    'event: "quoted: keeps colon"',
    "note: 'single ''quoted'''",
    'tags: [a, b, "c d"]',
    'links:',
    '  source: https://x.dev',
    '  demo: [1, 2]',
    'items:',
    '  - one',
    '  - two',
    'summary: >-',
    '  folded line one',
    '  folded line two',
    '---',
    '',
    '# body',
    '',
  ].join('\n');

  it('parses scalars (string/int/float/bool/null/ISO date) with correct types', () => {
    const { data } = parseFrontmatter(FM);
    expect(data['title']).toBe('My Post');
    expect(data['day']).toBe('2026-08-16'); // ISO dates stay canonical strings
    expect(data['count']).toBe(42);
    expect(data['ratio']).toBe(1.5);
    expect(data['flag']).toBe(true);
    expect(data['nothing']).toBeNull();
  });

  it('parses quoted strings that keep colons and escaped quotes', () => {
    const { data } = parseFrontmatter(FM);
    expect(data['event']).toBe('quoted: keeps colon');
    expect(data['note']).toBe("single 'quoted'");
  });

  it('parses inline arrays, block sequences, nested mappings and folded scalars', () => {
    const { data } = parseFrontmatter(FM);
    expect(data['tags']).toEqual(['a', 'b', 'c d']);
    expect(data['items']).toEqual(['one', 'two']);
    expect(data['links']).toEqual({ source: 'https://x.dev', demo: [1, 2] });
    expect(data['summary']).toBe('folded line one folded line two');
  });

  it('returns the body after the closing fence', () => {
    const { body } = parseFrontmatter(FM);
    expect(body).toBe('# body\n');
  });

  it('passes through documents without frontmatter', () => {
    expect(parseFrontmatter('# just body')).toEqual({ data: {}, body: '# just body' });
  });

  it('normalizes CRLF input', () => {
    expect(parseFrontmatter('---\r\ntitle: t\r\n---\r\nbody')).toEqual({
      data: { title: 't' },
      body: 'body',
    });
  });

  it('accepts `...` as a closing fence', () => {
    expect(parseFrontmatter('---\na: 1\n...\nbody')).toEqual({ data: { a: 1 }, body: 'body' });
  });

  it('throws on an unclosed opening fence', () => {
    expect(() => parseFrontmatter('---\na: 1\n')).toThrow(/no closing/);
  });

  it('throws (with line number) on tabs and unquoted `: ` values', () => {
    expect(() => parseFrontmatter('---\ntab:\tbad\n---\n')).toThrow(/line 1/);
    expect(() => parseFrontmatter('---\nx: unquoted: colon\n---\n')).toThrow(/quote the string/);
  });
});

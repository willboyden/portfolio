/**
 * Every theme, on the pages people actually read.
 *
 * src/theme/contrast.test.ts gates each theme's TOKEN pairs. This spec gates
 * what the browser really painted: under every theme, every piece of visible
 * text on the main page types is measured against the background it sits on
 * (the same question an accessibility audit asks), and must clear WCAG AA:
 * 4.5:1, or 3:1 for large text. A theme that passes the token matrix but puts
 * some text on a surface nobody listed fails here.
 *
 * The theme list is read from the shipped pre-paint script (the table every
 * visitor's browser gets), so a theme cannot ship unswept.
 */
import { readFileSync } from 'node:fs';
import { describe, test } from '../harness/framework.mjs';

const initScript = readFileSync(new URL('../../public/theme-init.js', import.meta.url), 'utf8');
const MODES = JSON.parse(/var MODES = (\{[^}]*\});/.exec(initScript)?.[1] ?? '{}');
const THEMES = Object.keys(MODES);

const generated = JSON.parse(
  readFileSync(new URL('../../src/content/generated/content.json', import.meta.url), 'utf8'),
);
const newestPost = [...generated.posts].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
const featuredProject = generated.projects.find((p) => p.featured) ?? generated.projects[0];

/** One of each kind of page, plus the two pages with the most distinct surfaces. */
const PAGES = [
  '/',
  '/projects/',
  featuredProject ? `/projects/${featuredProject.slug}/` : null,
  '/writing/',
  newestPost ? `/writing/${newestPost.slug}/` : null,
  '/ai-engineering/',
  '/ai-engineering/local-inference/',
  '/ai-engineering/local-recipes/',
  '/videos/',
  '/graph/',
  '/about/',
  '/now/',
  '/contact/',
  '/this-page-does-not-exist/',
].filter(Boolean);

/**
 * In-page: every visible text node whose contrast against its effective
 * background is below AA. Backgrounds are composited up the ancestor chain;
 * a node over a background IMAGE cannot be judged and is counted as skipped.
 */
const SWEEP = `
  return (() => {
    const parse = (css) => {
      const m = /rgba?\\(([^)]+)\\)/.exec(css);
      if (!m) return null;
      const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
    };
    const over = (top, under) => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    });
    const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

    const background = (el) => {
      const layers = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
        const c = parse(cs.backgroundColor);
        if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
      }
      let base = { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of layers.reverse()) base = over(layer, base);
      return base;
    };

    const hidden = (el) => {
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return true;
        if (cs.clipPath && cs.clipPath !== 'none') return true; /* visually-hidden text */
        if (n.hasAttribute('disabled') || n.getAttribute('aria-disabled') === 'true') return true; /* inactive: exempt */
      }
      return false;
    };
    const opacity = (el) => {
      let o = 1;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      return o;
    };

    const failures = [];
    let checked = 0;
    let skipped = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      const el = node.parentElement;
      if (!text || !el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(el.tagName)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if ([...range.getClientRects()].every((r) => r.width === 0 || r.height === 0)) continue;
      if (hidden(el)) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const bg = background(el);
      if (!fg || !bg) { skipped += 1; continue; }
      const ink = over({ ...fg, a: fg.a * opacity(el) }, bg);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const got = ratio(ink, bg);
      checked += 1;
      if (got + 0.005 < need) {
        failures.push(
          '"' + text.slice(0, 28) + '" ' + got.toFixed(2) + ':1 (needs ' + need + ') ' +
          el.tagName.toLowerCase() + ' ' + cs.color + ' on rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(', ') + ')'
        );
      }
    }
    return { checked, skipped, failures: failures.slice(0, 6), total: failures.length };
  })()
`;

/** Colours must be read at rest: links and controls fade between colours, and
 * a reading taken mid-fade is of neither theme. */
async function freezeMotion(page) {
  await page.evaluate(`
    (() => {
      if (document.getElementById('e2e-no-motion')) return;
      const style = document.createElement('style');
      style.id = 'e2e-no-motion';
      style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    })()
  `);
}

async function setTheme(page, theme) {
  await freezeMotion(page);
  /* Apply the theme the way the app does when another tab picks it: the
   * stored preference changes and a `storage` event arrives. That is the
   * real code path (the attribute, the colour scheme, and, for a theme the
   * stylesheet does not hold, its colours as inline variables); 02-a11y
   * drives the visible control once, this sweeps all of them fast. */
  await page.evaluate(`
    (() => {
      const value = JSON.stringify({ theme: ${JSON.stringify(theme)} });
      localStorage.setItem('portfolio.theme', value);
      window.dispatchEvent(new StorageEvent('storage', { key: 'portfolio.theme', newValue: value }));
    })()
  `);
  await page.waitForFunction(`return document.documentElement.getAttribute('data-theme') === ${JSON.stringify(theme)}`);
}

/** Leave no stored theme behind for the next test. */
async function forgetTheme(page) {
  await page.evaluate(`localStorage.removeItem('portfolio.theme')`);
}

describe('themes', () => {
  test('the shipped theme table lists a real choice: defaults plus many more', async () => {
    if (!THEMES.includes('dark') || !THEMES.includes('light')) throw new Error('the two defaults are missing');
    if (THEMES.length < 10) throw new Error(`only ${THEMES.length} themes shipped`);
    for (const mode of Object.values(MODES)) {
      if (mode !== 'light' && mode !== 'dark') throw new Error(`a theme has mode "${mode}"`);
    }
  });

  test('every theme has its own palette in the page (no theme falls through to the default)', async ({
    page,
    goto,
  }) => {
    await goto('/');
    const seen = new Map();
    for (const theme of THEMES) {
      await setTheme(page, theme);
      const paint = await page.evaluate(`
        return (() => {
          const cs = getComputedStyle(document.documentElement);
          return {
            bg: cs.getPropertyValue('--c-bg').trim(),
            text: cs.getPropertyValue('--c-text').trim(),
            mark: cs.getPropertyValue('--c-mark').trim(),
            body: getComputedStyle(document.body).backgroundColor,
          };
        })()
      `);
      if (!paint.bg || !paint.text || !paint.mark) throw new Error(`${theme}: colour variables missing`);
      const key = `${paint.bg}|${paint.mark}`;
      if (seen.has(key)) throw new Error(`${theme} paints exactly like ${seen.get(key)} (${key})`);
      seen.set(key, theme);
    }
    await forgetTheme(page);
  });

  test('a theme the stylesheet does not hold is its colours on <html>, and leaves none behind', async ({
    page,
    goto,
  }) => {
    await goto('/about/');
    const inline = () =>
      page.evaluate(`
        return (() => {
          const style = document.documentElement.style;
          const names = [];
          for (let i = 0; i < style.length; i += 1) if (style[i].startsWith('--c-')) names.push(style[i]);
          return { count: names.length, bg: style.getPropertyValue('--c-bg').trim() };
        })()
      `);
    await setTheme(page, 'blueprint');
    const blueprint = await inline();
    if (blueprint.bg !== '#0f2542' || blueprint.count < 20) {
      throw new Error(`blueprint should be inline variables on <html>: ${JSON.stringify(blueprint)}`);
    }
    await setTheme(page, 'ledger');
    const ledger = await inline();
    if (ledger.bg !== '#edf3e6' || ledger.count !== blueprint.count) {
      throw new Error(`ledger should replace blueprint exactly: ${JSON.stringify(ledger)}`);
    }
    /* Paper is in the stylesheet: nothing inline may be left to outrank it. */
    await setTheme(page, 'light');
    const paper = await inline();
    if (paper.count !== 0) throw new Error(`inline colours left after returning to Paper: ${JSON.stringify(paper)}`);
    const painted = await page.evaluate(`return getComputedStyle(document.body).backgroundColor`);
    if (painted !== 'rgb(251, 251, 249)') throw new Error(`Paper should paint #fbfbf9, got ${painted}`);
    await forgetTheme(page);
  });

  for (const path of PAGES) {
    test(`text contrast is AA under every theme: ${path}`, async ({ page, goto }) => {
      await goto(path);
      const problems = [];
      for (const theme of THEMES) {
        await setTheme(page, theme);
        const result = await page.evaluate(SWEEP);
        if (result.checked < 20) throw new Error(`${theme} ${path}: only ${result.checked} text nodes measured`);
        if (result.total > 0) problems.push(`${theme} (${result.total}): ${result.failures.join(' | ')}`);
      }
      await forgetTheme(page);
      /* One line: the runner prints only the first line of a failure. */
      if (problems.length > 0) throw new Error(`${path} ;; ${problems.join(' ;; ')}`);
    });
  }

  test('the open theme list and the open phone menu are AA under every theme', async ({ page, goto, goto375 }) => {
    const problems = [];
    await goto('/');
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForSelector('[data-testid="theme-panel"]');
    for (const theme of THEMES) {
      await setTheme(page, theme);
      const result = await page.evaluate(SWEEP);
      if (result.total > 0) problems.push(`panel ${theme}: ${result.failures.join(' | ')}`);
    }
    await page.pressKey('Escape');

    await goto375('/');
    await page.click('[data-testid="menu-button"]');
    await page.waitForSelector('[role="dialog"]');
    for (const theme of THEMES) {
      await setTheme(page, theme);
      const result = await page.evaluate(SWEEP);
      if (result.total > 0) problems.push(`menu ${theme}: ${result.failures.join(' | ')}`);
    }
    await page.pressKey('Escape');
    await forgetTheme(page);
    if (problems.length > 0) throw new Error(problems.join(' ;; '));
  });

  test('printing uses Paper whatever theme is on screen, including a dark one set as inline variables', async ({
    page,
    goto,
  }) => {
    await goto('/about/');
    const problems = [];
    try {
      for (const theme of ['darkroom', 'dark', 'blueprint', 'legal']) {
        await setTheme(page, theme);
        await page.send('Emulation.setEmulatedMedia', { media: 'print' });
        const printed = await page.evaluate(`
          return {
            bg: getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim(),
            text: getComputedStyle(document.documentElement).getPropertyValue('--c-text').trim(),
            ink: getComputedStyle(document.querySelector('main h1')).color,
          }
        `);
        await page.send('Emulation.setEmulatedMedia', { media: '' });
        /* Browsers do not print backgrounds: a dark theme's light ink on white
         * paper would be a blank sheet. */
        if (printed.bg !== '#fbfbf9' || printed.text !== '#16161a' || printed.ink !== 'rgb(22, 22, 26)') {
          problems.push(`${theme}: ${JSON.stringify(printed)}`);
        }
      }
    } finally {
      await page.send('Emulation.setEmulatedMedia', { media: '' });
      await forgetTheme(page);
    }
    if (problems.length > 0) throw new Error(problems.join(' ;; '));
  });

  test('picking a theme with the pointer re-themes the page and survives a reload', async ({ page, goto }) => {
    await page.evaluate(`localStorage.removeItem('portfolio.theme')`);
    await goto('/writing/');
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForSelector('[data-testid="theme-panel"]');
    await page.click('[data-testid="theme-option-chalkboard"]');
    await page.waitForFunction(`return document.documentElement.getAttribute('data-theme') === 'chalkboard'`);
    const first = await page.evaluate(`return getComputedStyle(document.body).backgroundColor`);
    await goto('/about/');
    const state = await page.evaluate(`
      return {
        attr: document.documentElement.getAttribute('data-theme'),
        bg: getComputedStyle(document.body).backgroundColor,
        scheme: document.documentElement.style.colorScheme,
        label: document.querySelector('[data-testid="theme-toggle"]').getAttribute('aria-label'),
      }
    `);
    if (state.attr !== 'chalkboard' || state.bg !== first) {
      throw new Error(`after reload: ${JSON.stringify(state)} (picked background was ${first})`);
    }
    if (state.scheme !== 'dark') throw new Error(`chalkboard is dark, color-scheme was "${state.scheme}"`);
    if (state.label !== 'Theme: Chalkboard. Choose a theme') throw new Error(`label after reload: ${state.label}`);
    await page.evaluate(`localStorage.removeItem('portfolio.theme')`);
  });

  test('a press outside the theme list closes it', async ({ page, goto }) => {
    await goto('/');
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForSelector('[data-testid="theme-panel"]');
    await page.click('main h1');
    await page.waitForFunction(`return !document.querySelector('[data-testid="theme-panel"]')`);
    const expanded = await page.attribute('[data-testid="theme-toggle"]', 'aria-expanded');
    if (expanded !== 'false') throw new Error(`aria-expanded="${expanded}" after an outside press`);
  });
});

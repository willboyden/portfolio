/**
 * Accessibility as behavior, not intention: assertions run against the live
 * DOM the same way an assistive tech would encounter it.
 */
import { describe, test } from '../harness/framework.mjs';

const PRIMARY = [
  ['/', 'home'],
  ['/about', 'about'],
  ['/projects', 'projects'],
  ['/writing', 'writing'],
  ['/videos', 'videos'],
  ['/talks', 'talks'],
  ['/contact', 'contact'],
];

describe('a11y', () => {
  test('skip link is first focusable and points at main', async ({ goto, page }) => {
    await goto('/');
    await page.focus('body');
    await page.pressKey('Tab');
    const info = await page.activeElementInfo();
    if (!info || !/skip/i.test(`${info.text} ${info.href ?? ''}`)) {
      throw new Error(`first tab stop was "${info?.text}" (${info?.href}), expected a skip link`);
    }
  });

  test('exactly one h1 per page and headings never skip levels', async ({ goto, page }) => {
    for (const [path] of PRIMARY) {
      await goto(path);
      const report = await page.evaluate(`
        return (() => {
          const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1]);
          const h1s = hs.filter(l => l === 1).length;
          let jumps = 0;
          for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) jumps++;
          return { h1s, jumps };
        })()
      `);
      if (report.h1s !== 1) throw new Error(`${path}: ${report.h1s} <h1> elements, expected exactly 1`);
      if (report.jumps > 0) throw new Error(`${path}: ${report.jumps} heading level skip(s)`);
    }
  });

  test('every link has an accessible name', async ({ goto, page }) => {
    for (const [path] of PRIMARY) {
      await goto(path);
      const unnamed = await page.evaluate(`
        return [...document.querySelectorAll('a[href]')]
          .filter(a => !((a.textContent || '').trim() || a.getAttribute('aria-label') || a.querySelector('img[alt]:not([alt=""])')))
          .map(a => a.getAttribute('href')).slice(0, 5)
      `);
      if (unnamed.length > 0) throw new Error(`${path}: links without accessible name: ${unnamed.join(', ')}`);
    }
  });

  test('every image has a non-empty alt (or is decorative)', async ({ goto, page }) => {
    await goto('/');
    await goto('/projects');
    const missing = await page.evaluate(`
      return [...document.querySelectorAll('img')].filter(i => i.getAttribute('alt') === null).length
    `);
    if (missing > 0) throw new Error(`${missing} <img> without alt attribute`);
  });

  test('interactive controls are keyboard reachable and operable', async ({ goto, page }) => {
    await goto('/');
    /* Tab through the header: reach nav links and the theme toggle. */
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      await page.pressKey('Tab');
      const info = await page.activeElementInfo();
      if (info) seen.add(info.tag.toLowerCase());
      if (seen.has('button') && [...seen].length >= 3 && seen.has('a')) break;
    }
    if (!seen.has('a')) throw new Error('no links reachable by Tab in the first 12 stops');
    if (!seen.has('button')) throw new Error('no buttons (theme toggle/menu) reachable by Tab');
  });

  test('landmarks: header, nav, main present; skip link target exists', async ({ goto, page }) => {
    await goto('/');
    const shape = await page.evaluate(`
      return {
        header: !!document.querySelector('header'),
        nav: !!document.querySelector('nav'),
        main: !!document.querySelector('main'),
        skipHref: document.querySelector('a[href^="#"]')?.getAttribute('href') ?? '',
      }
    `);
    if (!shape.header || !shape.nav || !shape.main) throw new Error(`missing landmark: ${JSON.stringify(shape)}`);
    const target = await page.evaluate(
      `return !!document.getElementById((document.querySelector('a[href^="#"]')?.getAttribute('href') ?? '#').slice(1))`,
    );
    if (!target) throw new Error(`skip link target for "${shape.skipHref}" not found in document`);
  });

  test('theme control: names the theme, opens a list, picks by keyboard, Escape returns focus', async ({
    goto,
    page,
  }) => {
    await page.evaluate(`localStorage.removeItem('portfolio.theme')`);
    await goto('/');
    const toggle = '[data-testid="theme-toggle"]';
    const label = () => page.attribute(toggle, 'aria-label');
    const before = await label();
    if (!before || !/^Theme: /.test(before)) throw new Error(`theme button label was "${before}"`);
    if ((await page.attribute(toggle, 'aria-expanded')) !== 'false') throw new Error('panel open before any press');

    /* Open: the list appears, is the element the button controls, and focus
     * lands on the option in effect so arrow keys work at once. */
    await page.click(toggle);
    await page.waitForSelector('[data-testid="theme-panel"]');
    if ((await page.attribute(toggle, 'aria-expanded')) !== 'true') throw new Error('aria-expanded not true when open');
    const controls = await page.attribute(toggle, 'aria-controls');
    const owned = await page.evaluate(
      `return document.getElementById(${JSON.stringify(controls)})?.getAttribute('data-testid') ?? null`,
    );
    if (owned !== 'theme-panel') throw new Error(`aria-controls="${controls}" does not point at the panel`);
    const focused = await page.evaluate(
      `return (() => { const a = document.activeElement; return a?.tagName === 'INPUT' && a.type === 'radio' && a.checked ? a.value : null; })()`,
    );
    if (focused !== 'system') throw new Error(`focus should start on the checked option, was ${focused}`);

    /* Every option is a labelled radio in ONE group. */
    const group = await page.evaluate(`
      return (() => {
        const radios = [...document.querySelectorAll('[data-testid="theme-panel"] input[type=radio]')];
        const unnamed = radios.filter(r => !(r.closest('label')?.textContent || '').trim()).length;
        return { count: radios.length, names: new Set(radios.map(r => r.name)).size, unnamed };
      })()
    `);
    if (group.count < 11 || group.names !== 1 || group.unnamed !== 0) {
      throw new Error(`theme options malformed: ${JSON.stringify(group)}`);
    }

    /* Arrow keys move through the group and apply as they go. */
    await page.pressKey('ArrowDown');
    await page.waitForFunction(`return document.documentElement.getAttribute('data-theme') === 'light'`);
    await page.pressKey('ArrowDown');
    await page.waitForFunction(`return document.documentElement.getAttribute('data-theme') === 'legal'`);
    const after = await label();
    if (after !== 'Theme: Legal pad. Choose a theme') throw new Error(`label after picking: "${after}"`);
    const announced = await page.textContent('[data-testid="theme-announcement"]');
    if (!/Legal pad/.test(announced ?? '')) throw new Error(`live region said "${announced}"`);
    const stored = await page.evaluate(`return localStorage.getItem('portfolio.theme')`);
    if (stored !== JSON.stringify({ theme: 'legal' })) throw new Error(`stored preference was ${stored}`);

    /* Escape closes and hands focus back: no trap, no lost focus. */
    await page.pressKey('Escape');
    if ((await page.attribute(toggle, 'aria-expanded')) !== 'false') throw new Error('Escape did not close the panel');
    if (await page.exists('[data-testid="theme-panel"]')) throw new Error('panel still in the page after Escape');
    const back = await page.activeElementInfo();
    if (back?.testid !== 'theme-toggle') {
      throw new Error(`focus did not return to the theme button after Escape (it is on ${back?.tag} ${back?.testid})`);
    }

    /* "Match device" forgets the choice. */
    await page.click(toggle);
    await page.waitForSelector('[data-testid="theme-panel"]');
    await page.click('[data-testid="theme-option-system"] input', { force: true });
    await page.waitForFunction(`return localStorage.getItem('portfolio.theme') === null`);
    const followed = await label();
    if (!/matching your device/.test(followed ?? '')) throw new Error(`label after Match device: "${followed}"`);
    await page.pressKey('Escape');
  });
});

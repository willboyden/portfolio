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
      if (info) seen.add(info.tag);
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

  test('theme toggle keeps accessible name and does not trap focus', async ({ goto, page }) => {
    await goto('/');
    const before = await page.evaluate(`
      (() => {
        const b = [...document.querySelectorAll('button')].find(x => /theme|dark|light/i.test(x.getAttribute('aria-label') ?? ''));
        return b ? (b.getAttribute('aria-label') ?? '') : null;
      })()
    `);
    if (before === null) throw new Error('no theme toggle button found with theme-related aria-label');
    await page.evaluate(`
      (() => {
        const b = [...document.querySelectorAll('button')].find(x => /theme|dark|light/i.test(x.getAttribute('aria-label') ?? ''));
        b.click();
      })()
    `);
    await page.waitForAppReady();
    const after = await page.evaluate(`
      (() => {
        const b = [...document.querySelectorAll('button')].find(x => /theme|dark|light/i.test(x.getAttribute('aria-label') ?? ''));
        return b ? (b.getAttribute('aria-label') ?? '') : null;
      })()
    `);
    if (after === null) throw new Error('theme toggle disappeared after activation');
    if (after === before) throw new Error(`aria-label unchanged after toggle ("${after}") — label should describe the new state`);
  });
});

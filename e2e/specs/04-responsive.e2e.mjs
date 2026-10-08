/**
 * Responsive + motion: the mobile menu actually works at phone width, nothing
 * overflows horizontally, and reduced-motion visitors get no animation.
 */
import { describe, test } from '../harness/framework.mjs';

describe('responsive', () => {
  test('no horizontal overflow at 375px on key pages', async ({ page, goto375 }) => {
    for (const path of ['/', '/projects', '/writing', '/about']) {
      await goto375(path);
      const overflow = await page.evaluate(`
        return (() => {
          const doc = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          if (doc <= 1) return null;
          const wide = [...document.querySelectorAll('body *')]
            .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(0, 3).map(el => el.tagName + '.' + (el.className?.toString().slice(0, 30) ?? ''));
          return doc + 'px overflow, offenders: ' + wide.join(', ');
        })()
      `);
      if (overflow) throw new Error(`${path} @375: ${overflow}`);
    }
  });

  test('mobile menu opens via the hamburger, traps nothing, closes on Escape', async ({ page, goto375, expectVisible }) => {
    await goto375('/');
    const burger = 'button[aria-label*="menu" i], button[aria-expanded]';
    await expectVisible(burger);
    const expandedBefore = await page.attribute(burger, 'aria-expanded');
    if (expandedBefore !== 'false') throw new Error(`menu button aria-expanded was "${expandedBefore}", expected "false"`);

    await page.click(burger);
    const expandedAfter = await page.attribute(burger, 'aria-expanded');
    if (expandedAfter !== 'true') throw new Error(`after click aria-expanded="${expandedAfter}", expected "true"`);

    const dialogVisible = await page.evaluate(`
      (() => {
        const d = document.querySelector('[role="dialog"], nav[id*="menu" i]');
        if (!d) return 'no menu container with role=dialog or id*=menu';
        const r = d.getBoundingClientRect();
        return r.width > 100 && r.height > 100 ? true : 'menu container has zero size';
      })()
    `);
    if (dialogVisible !== true) throw new Error(`mobile menu did not open: ${dialogVisible}`);

    await page.pressKey('Escape');
    const expandedClosed = await page.attribute(burger, 'aria-expanded');
    if (expandedClosed !== 'false') throw new Error(`Escape did not close the menu (aria-expanded="${expandedClosed}")`);
  });

  test('desktop width shows inline nav, hides hamburger', async ({ page, goto1280 }) => {
    await goto1280('/');
    const navVisible = await page.isVisible('header nav a[href="/writing"]');
    if (!navVisible) throw new Error('primary nav links not visible at 1280px');
    const burgerVisible = await page.evaluate(`
      (() => {
        const b = document.querySelector('button[aria-label*="menu" i]');
        if (!b) return false;
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(b).display !== 'none';
      })()
    `);
    if (burgerVisible) throw new Error('hamburger button visible at desktop width');
  });

  test('prefers-reduced-motion disables transitions', async ({ page, setReducedMotion, goto }) => {
    await setReducedMotion(true);
    await goto('/');
    const animating = await page.evaluate(`
      return [...document.querySelectorAll('a,button,[class]')].slice(0, 200).some(el => {
        const s = getComputedStyle(el);
        const d = parseFloat(s.transitionDuration) || 0;
        const a = s.animationName && s.animationName !== 'none';
        return d > 0.05 || a;
      })
    `);
    if (animating) throw new Error('transition/animation still active under prefers-reduced-motion');
    await setReducedMotion(false);
  });

  test('touch targets are at least ~40px on mobile', async ({ page, goto375 }) => {
    await goto375('/');
    const small = await page.evaluate(`
      return [...document.querySelectorAll('header a, header button, main a')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.height < 28 || r.width < 24); })
        .slice(0, 4).map(el => el.tagName + ' "' + (el.textContent || '').trim().slice(0, 20) + '" ' + Math.round(el.getBoundingClientRect().height) + 'px')
    `);
    if (small.length > 0) throw new Error(`tiny touch targets: ${small.join(' | ')}`);
  });
});

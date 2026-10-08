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

  test('touch targets meet 44px on interactive controls at phone width', async ({ page, goto320 }) => {
    /* R3-D blind spot: this spec used to sweep `main a` only and a forgiving
     * 28px threshold — filter BUTTONS (the primary mobile control on
     * /projects and /writing) slipped through at 36px. Sweep anchors AND
     * buttons, on the filter pages, at the narrowest device, at the WCAG
     * 2.5.5 bar. Inline prose links are exempt (2.5.8 exception: their size
     * is determined by the line height of the text). */
    await goto320('/projects/');
    const check = async (path) => {
      if (path !== '/projects/') await goto320(path);
      const small = await page.evaluate(`
        (() => {
          const sel = 'header a, header button, main a, main button, footer a';
          const small = [...document.querySelectorAll(sel)]
            .filter(el => {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) return false;                    /* hidden */
              if (el.closest('p, li.prose, [data-prose]')) return false;           /* inline prose */
              const s = getComputedStyle(el);
              if (s.clipPath && s.clipPath !== 'none') return false;               /* a11y-hidden */
              return r.height < 43.5; /* subpixel tolerance */
            })
            .slice(0, 5)
            .map(el => el.tagName + ' "' + (el.textContent || '').trim().slice(0, 18) + '" ' + Math.round(el.getBoundingClientRect().height) + 'px');
          return small;
        })()
      `);
      if (small.length > 0) throw new Error(`${path} tiny touch targets: ${small.join(' | ')}`);
    };
    await check('/projects/');
    await check('/writing/');
    await check('/');
  });

  /* ---- Extreme mobile: 320x568 (narrowest phone in the wild) ------------- */

  test('no horizontal overflow at 320px, even on content-heavy pages', async ({ page, goto320 }) => {
    for (const path of ['/', '/projects', '/writing', '/about', '/contact', '/now']) {
      await goto320(path);
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
      if (overflow) throw new Error(`${path} @320: ${overflow}`);
    }
  });

  test('mobile chrome works at 320x568: menu opens, all its links are thumb-sized', async ({ page, goto320 }) => {
    await goto320('/');
    const burger = 'button[aria-label*="menu" i], button[aria-expanded]';
    await page.click(burger);
    const report = await page.evaluate(`
      (() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return 'dialog never opened at 320px';
        const links = [...dialog.querySelectorAll('a')];
        if (links.length === 0) return 'dialog has no links';
        const small = links
          .filter(a => a.getBoundingClientRect().height < 43.5 /* subpixel tolerance */)
          .map(a => a.textContent.trim().slice(0, 16) + ' @' + Math.round(a.getBoundingClientRect().height) + 'px');
        const close = dialog.querySelector('button');
        const cr = close?.getBoundingClientRect();
        if (!cr || cr.bottom > window.innerHeight + 1) return 'close button off-screen at 320x568';
        return small.length ? 'sub-44px menu links: ' + small.join(', ') : true;
      })()
    `);
    if (report !== true) throw new Error(String(report));
    await page.pressKey('Escape');
  });

  test('CTAs are above the fold at 320x568 (no orphaned hero)', async ({ page, goto320 }) => {
    await goto320('/');
    const ctaInView = await page.evaluate(`
      (() => {
        const cta = document.querySelector('[data-testid="home-cta-projects"]');
        if (!cta) return 'hero CTA missing';
        const r = cta.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight ? true
          : 'hero CTA below the fold at 320x568 (top=' + Math.round(r.top) + ' of ' + window.innerHeight + ')';
      })()
    `);
    if (ctaInView !== true) throw new Error(String(ctaInView));
  });

  test('sticky header stays a sliver in phone landscape (844x390)', async ({ page, gotoLandscape }) => {
    await gotoLandscape('/');
    const share = await page.evaluate(`
      return (() => {
        const h = document.querySelector('header');
        return h.getBoundingClientRect().height / window.innerHeight;
      })()
    `);
    if (share > 0.25) throw new Error(`header eats ${Math.round(share * 100)}% of a 390px-tall landscape viewport`);
  });

  test('text never overflows its own clipped box at 320px', async ({ page, goto320 }) => {
    await goto320('/projects');
    const clipped = await page.evaluate(`
      return (() => {
        const offenders = [];
        for (const el of document.querySelectorAll('h1,h2,h3,p,a,span,li,button')) {
          const s = getComputedStyle(el);
          /* Skip a11y-hidden elements (the clip+1px technique legitimately
           * "clips" long labels for screen-reader-only text). */
          if (s.clipPath !== 'none' || (s.width && parseFloat(s.width) <= 2)) continue;
          if (s.overflow === 'hidden' || s.overflowX === 'hidden') {
            /* line-clamped or scrollable text is fine; accidental clipping is not */
            if (el.scrollWidth > el.clientWidth + 2 && s.webkitLineClamp === 'none' && !s.textOverflow.includes('ellipsis') && !el.hasAttribute('data-allow-scroll')) {
              offenders.push(el.tagName + ' "' + (el.textContent || '').trim().slice(0, 18) + '"');
            }
          }
        }
        return offenders.slice(0, 4);
      })()
    `);
    if (clipped.length > 0) throw new Error(`clipped text at 320px: ${clipped.join(' | ')}`);
  });

  test('tablet breakpoint (768) shows neither broken desktop nav nor cramped mobile menu', async ({ page, goto768 }) => {
    await goto768('/');
    const state = await page.evaluate(`
      return (() => {
        const burger = document.querySelector('button[aria-label*="menu" i]');
        const navLinks = document.querySelectorAll('#primary-nav-list a');
        const r = burger?.getBoundingClientRect();
        const burgerVisible = !!r && r.width > 0 && getComputedStyle(burger).display !== 'none';
        return { burgerVisible, navCount: navLinks.length };
      })()
    `);
    /* One and only one navigation affordance is active at the tablet width. */
    const navUsable = (state.burgerVisible && state.navCount === 0) ||
                      (!state.burgerVisible && state.navCount > 0);
    if (!navUsable) throw new Error(`tablet nav broken: burgerVisible=${state.burgerVisible}, inline links=${state.navCount}`);
  });
});

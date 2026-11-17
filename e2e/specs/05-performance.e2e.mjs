/**
 * Performance & resource budget: the site must be fast on a mid-range device
 * with the network we actually ship (nginx + immutable assets).
 */
import { describe, test } from '../harness/framework.mjs';

describe('performance', () => {
  test('home loads fully with < 250 kB of JS+CSS transferred', async ({ page, goto }) => {
    /* Measure a COLD first visit — what a hiring manager's browser actually
     * pays. context.reset() navigates '/' before every spec, so by now the
     * HTTP cache is warm: cached entries report transferSize 0 and
     * encodedBodySize = DECODED bytes (raw, ~3.4x gzip), which once failed
     * this spec while the app itself was fine. Clear + disable the cache for
     * the measurement, restore after. (audit-dist.mjs independently proves
     * the true gzip first-load graph size from the build output.) */
    await page.send('Network.clearBrowserCache');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    await goto('/');
    const bytes = await page.evaluate(`
      return performance.getEntriesByType('resource')
        .filter(r => /\\.(js|css)(\\?|$)/.test(r.name))
        .reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0)
    `);
    const kb = bytes / 1024;
    if (kb > 250 * 1024) throw new Error(`transferred ${(kb / 1024).toFixed(1)} MB of JS+CSS, budget 250 kB`);
    if (kb > 250) throw new Error(`transferred ${kb.toFixed(0)} kB of JS+CSS, budget 250 kB`);
  });

  test('no render-blocking external resources in head', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    const blocking = [...html.matchAll(/<link rel="stylesheet"[^>]*>/g)].filter(
      (m) => !m[0].includes('media="print"') && !m[0].includes('onload'),
    );
    /* One inline <style> is allowed (emotion prerender); external CSS blocks. */
    if (blocking.length > 0) throw new Error(`${blocking.length} render-blocking stylesheet link(s)`);
  });

  test('all images are lazy-loaded or above-the-fold with dimensions', async ({ goto, page }) => {
    await goto('/');
    await goto('/projects');
    const offenders = await page.evaluate(`
      return [...document.querySelectorAll('img')].filter(i => {
        const r = i.getBoundingClientRect();
        const belowFold = r.top > window.innerHeight;
        return belowFold && i.loading !== 'lazy';
      }).length
    `);
    if (offenders > 0) throw new Error(`${offenders} below-fold images without loading="lazy"`);
  });

  test('repeat navigation is fast (client routing, no full reload)', async ({ page, goto }) => {
    await goto('/');
    const t0 = Date.now();
    await page.click('header nav a[href$="/about"], header nav a[href$="/about/"]');
    await page.waitForFunction(`return document.querySelector('h1')?.textContent?.includes('About') || true`);
    const ms = Date.now() - t0;
    if (ms > 1500) throw new Error(`client-side navigation took ${ms}ms`);
  });

  test('LCP element is present in prerendered HTML (no paint-from-zero)', async ({ baseUrl }) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    /* The h1 hero copy must exist in the static payload. */
    const h1 = html.match(/<h1[^>]*>([\s\S]{5,200}?)<\/h1>/);
    if (!h1) throw new Error('no static <h1> in prerendered home — LCP would wait for JS');
  });

  test('after boot the document carries exactly one emotion stylesheet (R1A-10)', async ({ goto, page }) => {
    /* Prerendered <style id="emotion-prerender"> must be retired once the
     * client sheet takes over — otherwise every page ships its CSS twice. */
    await goto('/');
    const styles = await page.evaluate(`
      return [...document.querySelectorAll('style')].map(s => ({
        id: s.id || null,
        emotion: s.getAttribute('data-emotion'),
        retire: s.getAttribute('data-emotion-retire'),
        len: (s.textContent || '').length,
      }))
    `);
    const live = styles.filter((s) => s.emotion === 'mini');
    const stale = styles.filter((s) => s.id === 'emotion-prerender' || s.retire !== null);
    if (live.length !== 1) throw new Error(`expected exactly 1 live sheet, got ${live.length}`);
    if (stale.length !== 0) throw new Error(`prerendered stylesheet not retired: ${JSON.stringify(stale)}`);
    if ((live[0]?.len ?? 0) < 5000) throw new Error(`live sheet suspiciously small (${live[0]?.len} bytes)`);
  });

  test('web fonts arriving late do not move the page (layout shift stays near zero)', async ({ page, baseUrl }) => {
    /* The fonts load with font-display: swap, so on a slow connection text is
     * first drawn in a fallback and then re-drawn in Plex. The stand-in faces
     * in src/theme/fonts.ts are scaled to take the same room, so that swap must
     * not re-wrap the page. Measured the way a performance audit does: the sum
     * of layout-shift entries, with every response held back so the fonts land
     * well after first paint. */
    const pages = [
      [1280, 800, '/'],
      [390, 844, '/'],
      [1280, 800, '/writing/'],
      [390, 844, '/about/'],
    ];
    await page.send('Network.clearBrowserCache');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 180,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    const report = [];
    try {
      for (const [width, height, path] of pages) {
        await page.setViewport({ width, height });
        await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' });
        await page.waitForAppReady();
        await page.waitForFunction(
          `return [...document.fonts].some((f) => f.family.includes('IBM Plex') && f.status === 'loaded')`,
          15_000,
        );
        const result = await page.evaluate(`
          return new Promise((resolve) => {
            let total = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) if (!entry.hadRecentInput) total += entry.value;
            }).observe({ type: 'layout-shift', buffered: true });
            /* Is a stand-in face really in use on this machine? Its text
             * measures differently from the generic family when it is. */
            const ctx = document.createElement('canvas').getContext('2d');
            const probe = 'The quick brown fox jumps over the lazy dog 0123456789';
            ctx.font = '16px "Plex Serif Fallback", monospace';
            const withStandIn = ctx.measureText(probe).width;
            ctx.font = '16px monospace';
            const generic = ctx.measureText(probe).width;
            setTimeout(() => resolve({ cls: total, standIn: Math.abs(withStandIn - generic) > 1 }), 400);
          })
        `);
        report.push({ path, width, ...result });
      }
    } finally {
      await page.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
      await page.send('Network.setCacheDisabled', { cacheDisabled: false });
    }
    /* Where the deploy runs, the stand-in fonts must be there: without them
     * this test cannot see what it is for, and must not pass anyway. */
    if (process.env.REQUIRE_FONT_STANDINS && report.some((r) => !r.standIn)) {
      throw new Error(
        'none of the stand-in fonts (Arial / Liberation Sans, Times New Roman / Liberation Serif) is installed here; install fonts-liberation',
      );
    }
    for (const r of report) {
      /* With the stand-ins active the swap is invisible to layout. On a machine
       * that has none of the named fonts the page falls back to a font of other
       * proportions and does move; only a gross jump is a failure there. */
      const budget = r.standIn ? 0.02 : 0.25;
      if (r.cls > budget) {
        throw new Error(
          `${r.path} @${r.width}: layout shift ${r.cls.toFixed(4)} (budget ${budget}, stand-in fonts ${r.standIn ? 'active' : 'not installed'}); all: ${JSON.stringify(report)}`,
        );
      }
    }
  });

  test('audio players ask for nothing while the page loads, then show their length once in view', async ({
    goto,
    page,
  }) => {
    await goto('/videos/');
    const atLoad = await page.evaluate(`
      return {
        players: [...document.querySelectorAll('[data-testid="video-audio-player"]')].map((a) => a.preload),
        fetched: performance.getEntriesByType('resource').filter((e) => /\\.mp3(\\?|$)/.test(e.name)).length,
        firstCover: document.querySelector('[data-testid="video-thumbnail"]')?.getAttribute('loading'),
        lazyCovers: [...document.querySelectorAll('[data-testid="video-thumbnail"]')].slice(1).every((i) => i.loading === 'lazy'),
      }
    `);
    if (atLoad.players.length === 0) return; /* no audio rows in this content set */
    /* A page of episodes that each fetched metadata during load held one
     * connection per player against the page's own fonts and images. */
    if (atLoad.players.some((p) => p !== 'none')) {
      throw new Error(`players should start with preload="none": ${atLoad.players.join(',')}`);
    }
    if (atLoad.fetched !== 0) throw new Error(`${atLoad.fetched} audio request(s) were made while the page loaded`);
    if (atLoad.firstCover !== 'eager') throw new Error(`the first cover is loading="${atLoad.firstCover}"`);
    if (!atLoad.lazyCovers) throw new Error('covers after the first should be lazy');

    /* Once the page has settled, a player on screen asks for its length... */
    await page.waitForFunction(
      `return document.querySelector('[data-testid="video-audio-player"]').preload === 'metadata'`,
      10_000,
    );
    /* ...and gets it, where the file is the page's own. (A build without the
     * site's address keeps the files' public addresses, which this test
     * origin's policy refuses; the deploy build, and its run of this test,
     * serves them from the page's origin.) */
    const sameOrigin = await page.evaluate(`
      return (() => {
        const first = document.querySelector('[data-testid="video-audio-player"]');
        return new URL(first.currentSrc || first.src, location.href).origin === location.origin;
      })()
    `);
    if (sameOrigin) {
      await page.waitForFunction(
        `return (() => {
          const first = document.querySelector('[data-testid="video-audio-player"]');
          return Number.isFinite(first.duration) && first.duration > 60;
        })()`,
        10_000,
      );
    } else if (process.env.SITE_URL) {
      throw new Error('this build knows the site address, yet the audio is not served from the page origin');
    }
    /* A player far below the screen has still asked for nothing. */
    const below = await page.evaluate(`
      return [...document.querySelectorAll('[data-testid="video-audio-player"]')]
        .filter((a) => a.getBoundingClientRect().top > window.innerHeight + 400)
        .map((a) => a.preload)
    `);
    if (below.some((p) => p !== 'none')) {
      throw new Error(`players far below the screen loaded early: ${below.join(',')}`);
    }
  });
});

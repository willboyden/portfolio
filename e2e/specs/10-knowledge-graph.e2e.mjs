/**
 * /graph — the site's knowledge graph, in a real browser: the canvas draws,
 * the graph file is fetched once under the site base, and every way of
 * interacting (search, the panel, topics) ends in links to the site's pages
 * that navigate. Console errors and failed requests fail any test (harness).
 */
import { describe, test } from '../harness/framework.mjs';

const PANEL = '[data-testid="graph-panel"]';

describe('knowledge graph', () => {
  test('draws the graph and fetches its file once, under the base', async ({ goto, page }) => {
    await goto('/graph');
    await page.waitForSelector('[data-testid="graph-canvas"]');
    await page.waitForFunction(
      `const c = document.querySelector('[data-testid="graph-canvas"]');
       if (!c || c.width < 50) return false;
       const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
       let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
       return n > 200;`,
    );
    const fetched = await page.evaluate(
      `return performance.getEntriesByType('resource').map(e => new URL(e.name)).filter(u => u.pathname.endsWith('/knowledge-graph.json')).map(u => u.pathname + u.search)`,
    );
    if (fetched.length !== 1) throw new Error(`graph file fetched ${fetched.length} times: ${fetched.join(', ')}`);
    /* The site base, read from the nav's own Graph link ("/graph" or "/portfolio/graph"). */
    const base = await page.evaluate(`return (document.querySelector('nav a[href$="/graph"]')?.getAttribute('href') ?? '/graph').replace(/graph$/, '')`);
    if (!fetched[0].startsWith(`${base}knowledge-graph.json?v=`)) {
      throw new Error(`graph file not under the site base ${base}: ${fetched[0]}`);
    }
  });

  test('search selects a page, and the panel links it and every connected page', async ({ goto, page }) => {
    await goto('/graph');
    await page.waitForSelector('[data-testid="graph-canvas"]');
    await page.fill('[data-testid="graph-search"]', 'nemo console');
    await page.waitForSelector('[data-testid="graph-results"] button');
    await page.click('[data-testid="graph-results"] li:first-child button');
    await page.waitForSelector('[data-testid="graph-selected-title"]');
    const title = (await page.textContent('[data-testid="graph-selected-title"]'))?.trim() ?? '';
    if (!/nemo console/i.test(title)) throw new Error(`selected "${title}", expected Nemo Console`);
    const open = await page.attribute('[data-testid="graph-open-link"]', 'href');
    if (!open?.endsWith('/projects/nemo-console')) throw new Error(`open link was ${open}`);
    const links = await page.evaluate(`return [...document.querySelectorAll('${PANEL} a')].map(a => a.getAttribute('href'))`);
    if (links.length < 4) throw new Error(`only ${links.length} links in the panel: ${links.join(', ')}`);
    const post = await page.evaluate(`return document.querySelector('[data-testid="graph-links-post"] a')?.getAttribute('href') ?? null`);
    if (!post) throw new Error('no connected post linked from the panel');
    /* The harness clicks at the element's on-screen centre, like a user who
     * has scrolled to it: the link sits lower in the panel. */
    await page.evaluate(`document.querySelector('[data-testid="graph-links-post"] a').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await page.click(`[data-testid="graph-links-post"] a[href="${post}"]`);
    await page.waitForFunction(`return location.pathname.endsWith(${JSON.stringify(post.replace(/^.*(?=\/writing\/)/, ''))})`);
    await page.waitForSelector('article');
  });

  test('a topic lists every page about it, as links', async ({ goto, page }) => {
    await goto('/graph');
    await page.waitForSelector(`${PANEL} button`);
    const topic = await page.evaluate(
      `const b = [...document.querySelectorAll('${PANEL} button')].find(x => x.getAttribute('aria-label')?.match(/: \\d+ pages$/)); if (!b) return null; b.click(); return b.textContent.trim()`,
    );
    if (!topic) throw new Error('no topic chip in the starting panel');
    /* textContent, not innerText: the group titles are text-transform: uppercase. */
    await page.waitForFunction(`return document.querySelector('${PANEL}')?.textContent.includes('Pages about ${topic}')`);
    const n = await page.evaluate(`return document.querySelectorAll('${PANEL} a').length`);
    if (n < 2) throw new Error(`topic "${topic}" links only ${n} page(s)`);
  });

  test('the home page shows the graph and its links, without the full page list', async ({ goto, page }) => {
    await goto('/');
    await page.waitForSelector('[data-testid="home-graph"] [data-testid="graph-canvas"]');
    /* The scene draws only while it is on screen, and it sits below the fold. */
    await page.evaluate(`document.querySelector('[data-testid="graph-canvas"]').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await page.waitForFunction(
      `const c = document.querySelector('[data-testid="graph-canvas"]');
       if (!c || c.width < 50) return false;
       const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
       let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
       return n > 200;`,
    );
    if (await page.exists('[data-testid="graph-list"]')) throw new Error('the full page list is on the home page');
    const above = await page.evaluate(
      `return !!(document.querySelector('[data-testid="home-graph-section"]').compareDocumentPosition(document.querySelector('#featured')) & Node.DOCUMENT_POSITION_FOLLOWING)`,
    );
    if (!above) throw new Error('the graph is not above Selected work on the home page');
    const full = await page.attribute('[data-testid="home-graph-cta"]', 'href');
    if (!full?.endsWith('/graph')) throw new Error(`"Open the full graph" points at ${full}`);
    /* A section link in the starting panel navigates. */
    const href = await page.evaluate(`return document.querySelector('${PANEL} a[href$="/projects"]')?.getAttribute('href') ?? null`);
    if (!href) throw new Error('no Projects link in the home graph panel');
    await page.evaluate(`document.querySelector('${PANEL} a[href$="/projects"]').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await page.click(`${PANEL} a[href="${href}"]`);
    await page.waitForFunction(`return location.pathname.replace(/\\/$/, '').endsWith('/projects')`);
    await goto('/graph');
    await page.waitForSelector('[data-testid="graph-list"]');
  });

  test('with reduced motion the graph does not turn on its own', async ({ goto, page, setReducedMotion }) => {
    await setReducedMotion(true);
    await goto('/graph');
    await page.waitForSelector('[data-testid="graph-canvas"]');
    await page.waitForFunction(`return [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Rotate')`);
  });
});

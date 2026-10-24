/**
 * Vite SSR build for the prerender pass: bundles prerender/entry.mjs (which
 * imports .tsx/.ts app code) into a single node-loadable module.
 *
 * Emits prerender/dist-entry.mjs; scripts/prerender.mjs imports that.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  /* R8: prerender runs in plain node; import.meta.env does not exist there.
   * Inject BASE_URL at bundle time from the env (VITE_BASE is job-level in
   * CI, defaults to '/' for nginx root hosting). Without this define the
   * prerendered pages emit root-absolute hrefs and every link 404s on
   * GitHub Pages. */
  define: {
    'import.meta.env.BASE_URL': JSON.stringify(process.env.VITE_BASE ?? '/'),
    /* R8D-1: SITE.url was hardcoded to the placeholder domain, so every
     * og:url/canonical/og:image/JSON-LD id shipped pointing at a domain that
     * does not resolve (broken share cards, wrong crawl origin) — the
     * workflow's SITE_URL only reached the feeds, not the head tags. Inject
     * the same job-level SITE_URL here so BOTH bundles bake the real origin. */
    'import.meta.env.SITE_URL': JSON.stringify(process.env.SITE_URL ?? ''),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@emotion/react': r('./vendor/emotion/react/src/index.ts'),
      '@emotion/styled': r('./vendor/emotion/styled/src/index.ts'),
      '@emotion-mini/core': r('./vendor/emotion/core/src/index.ts'),
      '@portfolio/router': r('./vendor/router/src/index.tsx'),
      app: r('./src'),
    },
  },
  build: {
    ssr: r('prerender/entry.ts'),
    outDir: r('prerender-built'),
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: {
      output: { entryFileNames: 'entry.mjs' },
      /* Node built-ins stay external automatically for ssr target; react is
       * bundled in so the emotion aliases above apply inside it. */
    },
  },
});

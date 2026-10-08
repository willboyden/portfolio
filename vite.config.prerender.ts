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

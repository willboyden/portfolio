import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Vendored Emotion is wired through `resolve.alias` rather than node_modules
 * symlinks, so the real package names are used in source and swapping to the
 * published packages later is a delete-and-`npm install`, not a code change.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@emotion\/react$/, replacement: r('./vendor/emotion/react/src/index.ts') },
      { find: /^@emotion\/styled$/, replacement: r('./vendor/emotion/styled/src/index.ts') },
      { find: /^@emotion-mini\/core$/, replacement: r('./vendor/emotion/core/src/index.ts') },
      { find: /^@emotion-mini\/react$/, replacement: r('./vendor/emotion/react/src/index.ts') },
      { find: /^@emotion-mini\/styled$/, replacement: r('./vendor/emotion/styled/src/index.ts') },
      { find: /^@portfolio\/router$/, replacement: r('./vendor/router/src/index.tsx') },
      { find: /^app$/, replacement: r('./src/index.ts') },
      { find: /^app\//, replacement: r('./src/') },
    ],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2022',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        /* Two chunks: our app and shared react runtime, for cache friendliness. */
        manualChunks(id) {
          if (id.includes('node_modules') || id.includes('/vendor/')) {
            if (/react|scheduler/.test(id)) return 'react';
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, strictPort: false },
});

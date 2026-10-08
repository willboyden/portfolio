import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

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
  test: {
    globals: true,
    /* 'node' is the only environment available offline (no jsdom package).
     * Component tests render via react-dom/server to HTML strings, and
     * behavior is covered in real Chromium by the CDP e2e suite. */
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'vendor/**/*.test.ts', 'vendor/**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    /* Cap parallelism: the container is CPU-pressure sensitive under fleets. */
    maxWorkers: 4,
    minWorkers: 1,
    testTimeout: 15000,
    reporters: ['default'],
  },
});

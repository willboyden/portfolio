import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'prerender-built/**', 'e2e/screenshots/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'vendor/**/*.{ts,tsx}', 'prerender/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-explicit-any': 'off', /* vendored shim layer uses any at its edges */
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'vendor/**/*.test.{ts,tsx}'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', 'e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  {
    /* public/*.js — pre-paint snippets (theme-init). Deliberately ES5 +
     * dependency-free so they run BEFORE any module and in every engine,
     * including the empty-catch private-mode fallbacks. R3-C: this file used
     * to fall outside the linted set entirely — the config now covers every
     * JS file in the repo, and `npm run lint` is `eslint .`. */
    files: ['public/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-var': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { caughtErrors: 'none', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['*.config.ts', '*.config.mjs', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
);

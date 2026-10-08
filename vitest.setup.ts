/**
 * Vitest global setup. No jsdom available offline, so component tests use
 * react-dom/server. This file keeps shared fixtures and matchers.
 */

import { afterEach } from 'vitest';
import { __resetSheet } from './vendor/emotion/core/src/index';

afterEach(() => {
  /* Registered CSS accumulates across tests; reset so per-test CSS assertions
   * stay meaningful and the sheet does not grow without bound. */
  __resetSheet();
});

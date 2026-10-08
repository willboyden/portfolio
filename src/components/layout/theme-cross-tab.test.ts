/**
 * Cross-tab theme sync (R3C-05) — the `storage`-event path that only fires in
 * OTHER tabs, so a same-tab toggle can never exercise it. We stub the browser
 * globals for the WHOLE test (vitest's node-env teardown restores `document`
 * to undefined right after import, so a handler invoked later must run while
 * our stub is still installed), capture the module's listener, deliver a real
 * StorageEvent-shaped payload, and assert the visible consequences:
 * snapshot flips, document flips, and storage is NOT re-written (no ping-pong).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Env {
  store: Record<string, string>;
  attrs: Record<string, string>;
  handlers: Map<string, (e: unknown) => void>;
}

function makeEnv(): Env {
  const env: Env = { store: {}, attrs: {}, handlers: new Map() };
  const doc = {
    documentElement: {
      setAttribute(k: string, v: string) { env.attrs[k] = v; },
      style: {} as Record<string, string>,
    },
    querySelector: () => null,
    createElement: () => ({ setAttribute: () => {} }),
    head: { appendChild: () => {} },
  };
  const win = {
    localStorage: {
      getItem: (k: string) => env.store[k] ?? null,
      setItem: (k: string, v: string) => { env.store[k] = v; },
    },
    addEventListener: (t: string, h: (e: unknown) => void) => { env.handlers.set(t, h); },
    removeEventListener: () => {},
    matchMedia: (q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
  };
  (env as Env & { doc: unknown; win: unknown }).doc = doc;
  (env as Env & { doc: unknown; win: unknown }).win = win;
  return env;
}

type BrowserEnv = Env & { doc: object; win: object };

function storageEvent(key: string | null, newValue: string | null): unknown {
  return { key, newValue };
}

describe('cross-tab storage sync (R3C-05)', () => {
  let env: BrowserEnv;

  beforeEach(async () => {
    env = makeEnv() as BrowserEnv;
    /* stub BEFORE import so the module-load attach sees both globals */
    vi.resetModules();
    vi.stubGlobal('window', env.win);
    vi.stubGlobal('document', env.doc);
    await import('./ThemePreference');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('a storage event for the theme key flips this tab without writing back', async () => {
    const mod = await import('./ThemePreference');
    const listener = env.handlers.get('storage');
    expect(listener, 'module attach registers a storage listener').toBeTypeOf('function');

    /* pin a deterministic start: this tab is dark (its own explicit choice,
     * which DOES write storage — captured as the baseline afterwards) */
    mod.setThemePreference('dark', 'user');
    const writesBefore = JSON.stringify(env.store);

    listener!(storageEvent('portfolio.theme', JSON.stringify({ theme: 'light' })));

    expect(mod.getThemePreferenceSnapshot().themeName).toBe('light');
    expect(env.attrs['data-theme']).toBe('light');
    /* NO write-back: re-storing would echo the event toward the origin tab */
    expect(JSON.stringify(env.store)).toBe(writesBefore);
  });

  it('legacy bare-string values from the other tab are parsed too', async () => {
    const mod = await import('./ThemePreference');
    mod.setThemePreference('dark', 'user');
    env.handlers.get('storage')!(storageEvent('portfolio.theme', 'light'));
    expect(mod.getThemePreferenceSnapshot().themeName).toBe('light');
    expect(env.attrs['data-theme']).toBe('light');
  });

  it('events for other keys or unparseable values are ignored', async () => {
    const mod = await import('./ThemePreference');
    mod.setThemePreference('dark', 'user');
    const before = mod.getThemePreferenceSnapshot().themeName;
    const l = env.handlers.get('storage')!;
    l(storageEvent('other.key', '"dark"'));
    l(storageEvent('portfolio.theme', 'not-json'));
    expect(mod.getThemePreferenceSnapshot().themeName).toBe(before);
    /* stays on the deterministic start — ignored events changed nothing */
    expect(env.attrs['data-theme']).toBe(before);
  });

  it('a same-value event is a no-op (no spurious emits)', async () => {
    const mod = await import('./ThemePreference');
    /* this tab already light via the store's own set → adopt short-circuits */
    mod.setThemePreference('light', 'user');
    const snapshotBefore = mod.getThemePreferenceSnapshot();
    env.handlers.get('storage')!(storageEvent('portfolio.theme', JSON.stringify({ theme: 'light' })));
    expect(mod.getThemePreferenceSnapshot()).toBe(snapshotBefore);
  });
});

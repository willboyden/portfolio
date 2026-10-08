/**
 * Unit tests for src/lib/storage.ts.
 *
 * There is no jsdom, so we install a MINIMAL fake `window` onto globalThis
 * BEFORE importing the module (dynamic import — ESM imports are hoisted) and
 * tear it down after. The module must be SSR-safe either way; the "no window"
 * assertions run first, before the fake exists.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

type FakeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  map: Map<string, string>;
};

function makeFakeStorage(opts: { throwsOnSet?: boolean; throwsOnAccess?: boolean } = {}): FakeStorage & {
  listeners: Array<(e: { key: string | null; newValue: string | null }) => void>;
} {
  const map = new Map<string, string>();
  const storage: FakeStorage = {
    map,
    getItem(key) {
      if (opts.throwsOnAccess) throw new Error('SecurityError: storage disabled');
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem(key, value) {
      if (opts.throwsOnAccess) throw new Error('SecurityError: storage disabled');
      if (opts.throwsOnSet) throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
      map.set(key, String(value));
    },
    removeItem(key) {
      if (opts.throwsOnAccess) throw new Error('SecurityError: storage disabled');
      map.delete(key);
    },
  };
  return Object.assign(storage, { listeners: [] as FakeStorageWindow['storageListeners'] });
}

interface FakeStorageWindow {
  localStorage: FakeStorage;
  addEventListener(type: string, listener: (e: { key: string | null; newValue: string | null }) => void): void;
  removeEventListener(): void;
  storageListeners: Array<(e: { key: string | null; newValue: string | null }) => void>;
}

function makeFakeWindow(storage: FakeStorage): FakeStorageWindow {
  const storageListeners: FakeStorageWindow['storageListeners'] = [];
  return {
    localStorage: storage,
    storageListeners,
    addEventListener(type, listener) {
      if (type === 'storage') storageListeners.push(listener);
    },
    removeEventListener() {
      /* not needed for these tests */
    },
  };
}

const NumberSchema = z.object({ n: z.number() });
type NumberBox = z.infer<typeof NumberSchema>;

/* --------------------------------------------------------------------------- */
/* SSR behaviour: window is genuinely undefined in this env (node).            */
/* Imported FIRST (module registry freshly reset) so the module's               */
/* `typeof window` guard is exercised with no fake present.                    */
/* --------------------------------------------------------------------------- */

vi.resetModules();
const storageSsr = await import('app/lib/storage');

describe('storage — SSR (window undefined)', () => {
  /* beforeAll installs a fake window for the browser-behaviour tests; this
   * describe must run its assertions with the fake REMOVED, since the module
   * reads `typeof window` at CALL time, not import time. */
  let savedWindow: unknown;
  beforeEach(() => {
    savedWindow = (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).window;
  });
  afterEach(() => {
    if (savedWindow !== undefined) (globalThis as Record<string, unknown>).window = savedWindow;
  });

  it('hasLocalStorage is false', () => {
    expect(storageSsr.hasLocalStorage()).toBe(false);
  });
  it('get returns undefined, set returns false, remove is a no-op — nothing throws', () => {
    expect(storageSsr.getItem('k', NumberSchema)).toBeUndefined();
    expect(storageSsr.setItem('k', { n: 1 })).toBe(false);
    expect(() => storageSsr.removeItem('k')).not.toThrow();
  });
});

/* --------------------------------------------------------------------------- */
/* Browser behaviour via the fake window.                                      */
/* --------------------------------------------------------------------------- */

let storage: typeof import('app/lib/storage');
let fakeStorage: ReturnType<typeof makeFakeStorage>;
let fakeWindow: FakeStorageWindow;

beforeAll(async () => {
  fakeStorage = makeFakeStorage();
  fakeWindow = makeFakeWindow(fakeStorage);
  (globalThis as Record<string, unknown>).window = fakeWindow;
  /* Fresh module instance so its top-level storage-event listener registers
   * (the SSR import above cached an instance created with no window). */
  vi.resetModules();
  storage = await import('app/lib/storage');
});

afterAll(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('storage — getItem/setItem/removeItem round-trip', () => {
  it('round-trips JSON through the zod schema', () => {
    const store = storage.createStore('test.box', NumberSchema);
    expect(store.get()).toBeUndefined();
    expect(storage.setItem('test.box', { n: 41 })).toBe(true);
    expect(storage.getItem('test.box', NumberSchema)).toEqual({ n: 41 });
    expect(store.key).toBe('test.box');
    store.remove();
    expect(storage.getItem('test.box', NumberSchema)).toBeUndefined();
  });

  it('invalid JSON is swallowed AND the corrupt key is evicted', () => {
    fakeStorage.map.set('bad.json', '{not json');
    expect(storage.getItem('bad.json', NumberSchema)).toBeUndefined();
    expect(fakeStorage.map.has('bad.json')).toBe(false); /* evicted */
  });

  it('valid JSON failing zod is treated as absent', () => {
    storage.setItem('wrong.shape', { n: 'nope', extra: 1 } as unknown as NumberBox);
    expect(storage.getItem('wrong.shape', NumberSchema)).toBeUndefined();
  });

  it('a themeStore value written by the init-script contract parses', () => {
    storage.setItem(storage.THEME_STORAGE_KEY, { theme: 'light' });
    expect(storage.themeStore.get()).toEqual({ theme: 'light' });
    const bogus = storage.createStore('bogus.theme', storage.ThemePrefSchema);
    storage.setItem('bogus.theme', { theme: 'neon' });
    expect(bogus.get()).toBeUndefined();
  });

  it('set survives a quota error: returns false, never throws', () => {
    const quota = makeFakeStorage({ throwsOnSet: true });
    const win = makeFakeWindow(quota);
    (globalThis as Record<string, unknown>).window = win;
    expect(storage.setItem('q', { n: 1 })).toBe(false);
    expect(storage.getItem('q', NumberSchema)).toBeUndefined();
    (globalThis as Record<string, unknown>).window = fakeWindow; /* restore */
  });

  it('private mode (access itself throws): every API degrades quietly', () => {
    const hostile = makeFakeStorage({ throwsOnAccess: true });
    (globalThis as Record<string, unknown>).window = makeFakeWindow(hostile);
    expect(storage.hasLocalStorage()).toBe(false);
    expect(storage.getItem('anything', NumberSchema)).toBeUndefined();
    expect(storage.setItem('anything', { n: 1 })).toBe(false);
    expect(() => storage.removeItem('anything')).not.toThrow();
    const store = storage.createStore('p.box', NumberSchema);
    expect(store.get()).toBeUndefined();
    expect(() => store.set({ n: 2 })).not.toThrow(); /* notify still fires */
    (globalThis as Record<string, unknown>).window = fakeWindow;
  });
});

describe('createStore — subscribe/notify', () => {
  it('notifies on set and remove, unsubscribe stops it', () => {
    const store = storage.createStore('sub.box', NumberSchema);
    const seen: Array<NumberBox | undefined> = [];
    const off = store.subscribe((v) => seen.push(v));
    store.set({ n: 1 });
    store.remove();
    off();
    store.set({ n: 2 });
    expect(seen).toEqual([{ n: 1 }, undefined]);
  });

  it('set persists even when notify listeners can see the new value via get()', () => {
    const store = storage.createStore('persist.box', NumberSchema);
    let valueAtNotify: NumberBox | undefined;
    store.subscribe(() => {
      valueAtNotify = store.get();
    });
    store.set({ n: 7 });
    expect(valueAtNotify).toEqual({ n: 7 });
    expect(store.get()).toEqual({ n: 7 });
  });

  it('a listener that unsubscribes mid-fan-out does not break the loop', () => {
    const store = storage.createStore('fanout.box', NumberSchema);
    const seen: number[] = [];
    const offA = store.subscribe(() => {
      seen.push(1);
      offA(); /* unsubscribe self during dispatch */
    });
    store.subscribe(() => seen.push(2));
    store.set({ n: 1 });
    store.set({ n: 2 });
    expect(seen).toEqual([1, 2, 2]);
  });

  it('cross-tab storage events replay into subscribers', () => {
    const store = storage.createStore(storage.THEME_STORAGE_KEY, storage.ThemePrefSchema);
    const seen: Array<{ theme: string } | undefined> = [];
    store.subscribe((v) => seen.push(v));
    /* Simulate the OTHER tab writing, then the browser firing `storage` here. */
    fakeStorage.map.set(storage.THEME_STORAGE_KEY, JSON.stringify({ theme: 'dark' }));
    const event = { key: storage.THEME_STORAGE_KEY, newValue: JSON.stringify({ theme: 'dark' }) };
    expect(fakeWindow.storageListeners.length).toBeGreaterThan(0);
    for (const listener of fakeWindow.storageListeners) listener(event);
    expect(seen).toEqual([{ theme: 'dark' }]);
    /* Removal event clears it. */
    for (const listener of fakeWindow.storageListeners) listener({ key: storage.THEME_STORAGE_KEY, newValue: null });
    expect(seen[1]).toBeUndefined();
  });

  it('getSnapshot is referentially stable while the raw value is unchanged', () => {
    const store = storage.createStore('stable.box', NumberSchema);
    store.set({ n: 5 });
    expect(store.get()).toBe(store.get()); /* useSyncExternalStore requirement */
  });
});

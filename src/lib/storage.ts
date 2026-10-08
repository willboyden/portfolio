/**
 * Typed, SSR-safe localStorage wrapper.
 *
 * Three rules govern this file:
 * 1. A read NEVER throws. Private-mode Safari throws on `localStorage`
 *    *property access itself*, let alone getItem; quota errors throw on set.
 *    Everything is wrapped and failures degrade to "no stored value".
 * 2. A stored value is only trusted after JSON.parse AND a zod parse. Stale
 *    or corrupt data (schema drift, a user pasting junk into devtools) is
 *    treated as absent — and removed, so it can't poison later reads.
 * 3. Nothing touches `window` unless `typeof window !== 'undefined'`. The
 *    site is prerendered in Node; a bare reference during render would crash
 *    the build.
 */

import { z } from 'zod';

export type ThemePreference = 'system' | 'dark' | 'light';

/** The preference record persisted by AppThemeProvider (pinned shape). */
export const ThemePrefSchema = z.object({
  theme: z.enum(['system', 'dark', 'light']),
});
export type ThemePref = z.infer<typeof ThemePrefSchema>;

/** Storage key used for the theme preference (shared with themeInitScript). */
export const THEME_STORAGE_KEY = 'portfolio.theme';

/** Internal slot shape: a store carries its own fan-out hook for tab sync. */
interface StoreSlot<T> {
  readonly store: Store<T>;
  readonly schema: z.ZodType<T>;
  notify(value: T | undefined): void;
}

const registry = new Map<string, StoreSlot<unknown>>();

/** True only in a browser where localStorage is actually reachable. */
export function hasLocalStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const probe = '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Read + JSON.parse + zod-validate. Any failure (including absent) → undefined. */
export function getItem<T>(key: string, schema: z.ZodType<T>): T | undefined {
  if (typeof window === 'undefined') return undefined;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return undefined; /* private mode: access itself throws */
  }
  if (raw === null) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    removeItem(key); /* unparsable junk: evict so it can't poison later reads */
    return undefined;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    /* Corrupt/stale entry: evict it so we don't re-parse it on every load. */
    removeItem(key);
    return undefined;
  }
  return parsed.data;
}

/** Returns false (never throws) on quota errors / private-mode blocks. */
export function setItem(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* inaccessible storage — nothing to remove anyway */
  }
}

export interface Store<T> {
  readonly key: string;
  get(): T | undefined;
  /** Persists (when possible) and notifies subscribers even if persistence failed. */
  set(value: T): void;
  remove(): void;
  /** Unsubscribe. Listeners are called with `undefined` on remove(). */
  subscribe(listener: (value: T | undefined) => void): () => void;
}

/**
 * A single keyed slot with reactive subscribers — the bridge between
 * localStorage (imperative, same-tab silent) and React (needs notifications).
 * `set`/`remove` notify synchronously; `get` re-validates every time so an
 * external devtools edit is caught, not cached blindly.
 */
export function createStore<T>(key: string, schema: z.ZodType<T>): Store<T> {
  const listeners = new Set<(value: T | undefined) => void>();
  const notify = (value: T | undefined): void => {
    /* Copy first: a listener may unsubscribe during the fan-out. */
    for (const listener of [...listeners]) listener(value);
  };
  /* Snapshot cache keyed by the RAW stored string. useSyncExternalStore
   * requires getSnapshot to be referentially stable between calls — parsing
   * afresh every call would spawn an infinite re-render loop on the client. */
  let cachedRaw: string | null | undefined;
  let cachedValue: T | undefined;
  const invalidate = (): void => {
    cachedRaw = undefined;
  };
  const store: Store<T> = {
    key,
    get: () => {
      if (typeof window === 'undefined') return undefined;
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(key);
      } catch {
        return cachedValue;
      }
      if (raw === cachedRaw) return cachedValue;
      cachedValue = getItem(key, schema);
      cachedRaw = raw;
      return cachedValue;
    },
    set: (value) => {
      setItem(key, value);
      invalidate();
      notify(value);
    },
    remove: () => {
      removeItem(key);
      invalidate();
      notify(undefined);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  registry.set(key, { store, schema, notify: notify as (value: unknown) => void });
  return store;
}

/** The one store the app ships with: theme preference. */
export const themeStore: Store<ThemePref> = createStore(THEME_STORAGE_KEY, ThemePrefSchema);

/* Cross-tab sync: localStorage fires `storage` only in OTHER tabs; replay the
 * event into the matching store's subscribers so open tabs converge. Registered
 * once per module load, browser-only, and never throws. */
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (!event.key) return;
      const slot = registry.get(event.key);
      if (!slot) return;
      slot.notify(event.newValue === null ? undefined : getItem(event.key, slot.schema));
    });
  } catch {
    /* addEventListener unavailable — degrade to same-tab only */
  }
}

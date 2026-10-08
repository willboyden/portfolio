/**
 * SSR-safe React hooks for behaviour the site needs but the platform doesn't
 * give us for free (there is no @testing-library, no react-use, no date-fns —
 * CONTRACT §0 says roll our own).
 *
 * SSR SAFETY IS THE LOAD-BEARING RULE: the site is prerendered in Node with
 * react-dom/server. Any hook here may render ONCE on the server with no
 * window, then hydrate in the browser. Therefore:
 * - initial state is the SERVER-SAFE value (false / null / undefined);
 * - browser state arrives in an effect after hydration (never during render);
 * - every window/document/matchMedia access sits behind
 *   `typeof window !== 'undefined'` and try/catch.
 * The cost is one frame of "unknown → known" for interactive affordances
 * (mount-gated UI), which is invisible for these hooks.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { RefObject } from 'react';
import type { ThemeName } from 'app/theme/tokens';
import { themeStore, THEME_STORAGE_KEY, ThemePrefSchema, getItem } from './storage';
import type { ThemePref, ThemePreference } from './storage';

/* -------------------------------------------------------------------------- */
/* Isomorphic layout effect                                                    */
/* -------------------------------------------------------------------------- */

/**
 * useLayoutEffect on the client, useEffect on the server. Using bare
 * useLayoutEffect during SSR makes React log a warning on every prerendered
 * page; this silences it without changing client semantics.
 */
export const useIsomorphicLayoutEffect: typeof useEffect =
  typeof window !== 'undefined' && typeof window.document !== 'undefined'
    ? useLayoutEffect
    : useEffect;

/* -------------------------------------------------------------------------- */
/* useSyncExternalStore helpers (React 19, no use-sync-external-store shim)   */
/* -------------------------------------------------------------------------- */

/**
 * Subscribe to a `store` (src/lib/storage) with React 19's useSyncExternalStore.
 * On the server the snapshot is always `undefined`, so server HTML renders the
 * "no stored preference" state; the client picks up the stored value on mount.
 */
export function useStore<T>(store: {
  get(): T | undefined;
  subscribe(listener: (value: T | undefined) => void): () => void;
}): T | undefined {
  return useSyncExternalStore(
    (onChange) => store.subscribe(() => onChange()),
    () => store.get(),
    /* Server snapshot: never stored, matching the prerender shell. */
    () => undefined,
  );
}

/* -------------------------------------------------------------------------- */
/* Media queries                                                               */
/* -------------------------------------------------------------------------- */

/** Read a media query, never throwing (SSR, old browsers, locked-down iframes). */
export function readMediaQuery(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

/**
 * Live `window.matchMedia(query)` result. SSR-safe: false on the server and on
 * the first client paint, corrected in the effect, updated on every change.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      let mql: MediaQueryList;
      try {
        mql = window.matchMedia(query);
      } catch {
        return () => {};
      }
      const handler = (): void => onChange();
      /* addEventListener is modern Safari 14+; addListener is the legacy fallback. */
      try {
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
      } catch {
        try {
          mql.addListener(handler);
          return () => mql.removeListener(handler);
        } catch {
          return () => {};
        }
      }
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => readMediaQuery(query),
    () => false,
  );
}

/** True when the user asked the OS to reduce motion. Used by every animation. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/* -------------------------------------------------------------------------- */
/* Mount / scroll / clipboard                                                  */
/* -------------------------------------------------------------------------- */

/**
 * false on the server AND the first client render, true after mount. Gate any
 * UI whose appearance depends on browser-only state to avoid hydration mismatch.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    /* Mount commit happened — re-render so browser-only UI can appear.
     * eslint-disable-next-line react-hooks/set-state-in-effect -- this is the
     * canonical mounted-flag pattern; the alternative (useSyncExternalStore)
     * is what useThemeNameState uses, but a boolean mount flag does not
     * warrant a store. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  return mounted;
}

export interface ScrollProgress {
  /** 0..1 through the scrollable document. */
  progress: number;
  /** Pixels scrolled. */
  scrolled: number;
  /** Total scrollable height (scrollHeight - viewport). */
  total: number;
}

/** Pure math: derive progress from raw scroll metrics. Exported for tests. */
export function computeScrollProgress(scrollY: number, scrollHeight: number, viewport: number): ScrollProgress {
  const total = Math.max(0, scrollHeight - viewport);
  const scrolled = Math.min(Math.max(0, scrollY), total);
  return { progress: total <= 0 ? 0 : scrolled / total, scrolled, total };
}

/** Frozen server snapshot — referentially stable for useSyncExternalStore. */
const SERVER_SCROLL_PROGRESS: ScrollProgress = Object.freeze({ progress: 0, scrolled: 0, total: 0 });

/**
 * Document scroll progress for the reading-progress bar, throttled to one
 * calculation per animation frame. Passive listeners; SSR snapshot is 0.
 */
export function useScrollProgress(): ScrollProgress {
  const snapshotRef = useRef<ScrollProgress>(SERVER_SCROLL_PROGRESS);
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
    let raf = 0;
    const measure = (): void => {
      raf = 0;
      const doc = document.documentElement;
      snapshotRef.current = computeScrollProgress(
        window.scrollY || doc.scrollTop || 0,
        doc.scrollHeight || 0,
        window.innerHeight || doc.clientHeight || 0,
      );
      onChange();
    };
    const schedule = (): void => {
      /* rAF-throttle: many scroll events, one measurement+render per frame. */
      if (raf === 0) raf = window.requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    measure();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf !== 0) window.cancelAnimationFrame(raf);
    };
  }, []);
  return useSyncExternalStore(subscribe, () => snapshotRef.current, () => SERVER_SCROLL_PROGRESS);
}

/** Pure: modern API vs execCommand fallback (older/insecure-origins browsers). */
export async function writeClipboardText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand (permissions denied / non-secure context) */
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copy-to-clipboard with success/failed state and auto-reset. Returns
 * `copy(text)` + whether the last copy succeeded. Never throws.
 */
export function useCopyToClipboard(resetMs = 2000): {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
  failed: boolean;
} {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const ok = await writeClipboardText(text);
      setCopied(ok);
      setFailed(!ok);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        setFailed(false);
        timerRef.current = null;
      }, resetMs);
      return ok;
    },
    [resetMs],
  );

  return { copy, copied, failed };
}

/* -------------------------------------------------------------------------- */
/* DOM interaction                                                             */
/* -------------------------------------------------------------------------- */

/** Call `handler` when a pointer/touch event lands outside `ref`. Ignores SSR. */
export function useOnClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled = true,
): void {
  const savedHandler = useRef(handler);
  useIsomorphicLayoutEffect(() => {
    savedHandler.current = handler;
  }, [handler]);
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const listener = (event: MouseEvent | TouchEvent): void => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node | null)) return;
      savedHandler.current(event);
    };
    /* pointerdown covers mouse+touch+pen in one listener; mousedown/touchstart
     * are registered too because Safari <14 and some AT paths skip pointer events. */
    document.addEventListener('pointerdown', listener, true);
    document.addEventListener('mousedown', listener, true);
    document.addEventListener('touchstart', listener, true);
    return () => {
      document.removeEventListener('pointerdown', listener, true);
      document.removeEventListener('mousedown', listener, true);
      document.removeEventListener('touchstart', listener, true);
    };
  }, [ref, enabled]);
}

/** Debounced mirror of a fast-changing value (search inputs). Leading-edge free by design. */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/* -------------------------------------------------------------------------- */
/* Theme                                                                       */
/* -------------------------------------------------------------------------- */

/** Resolve a preference + system setting to a concrete theme. Pure, testable. */
export function resolveTheme(pref: ThemePreference | undefined, systemDark: boolean): ThemeName {
  if (pref === 'dark' || pref === 'light') return pref;
  return systemDark ? 'dark' : 'light';
}

export interface ThemeNameState {
  /** Concrete theme in effect. Server renders 'dark' (the shell default). */
  themeName: ThemeName;
  /** The persisted preference ('system' default) — for toggle UI state. */
  preference: ThemePreference;
  /** Persist a new preference and switch immediately. Never throws. */
  setThemeName: (name: ThemeName) => void;
  /** Cycle system → light → dark → system (for a single-button toggle). */
  cycle: () => void;
  /** Raw preference store for advanced consumers. */
  store: typeof themeStore;
}

/**
 * The concrete theme + preference, wired to localStorage AND the OS setting.
 * Derived from the store: theme-init.js already fixed `data-theme` before
 * paint, so server and first client paint agree without an effect-sync pass.
 */
export function useThemeNameState(): ThemeNameState {
  const stored = useStore<ThemePref>(themeStore);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const preference: ThemePreference = stored?.theme ?? 'system';
  /* Derived, not staged into state (no effect-sync, no cascading render).
   * The server always reports 'dark' — CONTRACT pins prerender markup to the
   * dark theme; the client derives from store + media query immediately
   * (theme-init.js already fixed data-theme before this runs). */
  const themeName = typeof window === 'undefined' ? 'dark' : resolveTheme(preference, systemDark);

  const setThemeName = useCallback((name: ThemeName): void => {
    const pref: ThemePref = { theme: name };
    themeStore.set(pref); /* store write re-renders via useStore above */
    if (typeof document !== 'undefined') {
      try {
        document.documentElement.setAttribute('data-theme', name);
        document.documentElement.style.colorScheme = name;
      } catch {
        /* detached document during unmount */
      }
    }
  }, []);

  const cycle = useCallback((): void => {
    const next: ThemePreference =
      preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system';
    if (next === 'system') {
      themeStore.remove();
      if (typeof document !== 'undefined') {
        try {
          const name = resolveTheme('system', systemDark);
          document.documentElement.setAttribute('data-theme', name);
          document.documentElement.style.colorScheme = 'dark light';
        } catch {
          /* ignore */
        }
      }
    } else {
      setThemeName(next);
    }
  }, [preference, systemDark, setThemeName]);

  return { themeName, preference, setThemeName, cycle, store: themeStore };
}

/**
 * Read the persisted preference without React state (init scripts, analytics).
 * SSR-safe: returns undefined on the server.
 */
export function readStoredThemePref(): ThemePref | undefined {
  return getItem(THEME_STORAGE_KEY, ThemePrefSchema);
}

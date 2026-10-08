/**
 * ThemePreference — owns *which* theme the visitor wants (dark | light) and the
 * DOM side effects that go with it. It does NOT own the Emotion theme itself.
 *
 * WHY THE SPLIT
 * `src/theme/ThemeProvider.tsx` (owned by platform-primitives, CONTRACT §4)
 * renders `<ThemeProvider theme={...}>` from `@emotion/react`. Someone still
 * has to answer three questions that are awkward to answer inside an Emotion
 * provider: where does the preference come from, where is it persisted, and how
 * does the document (`data-theme`, `color-scheme`) learn about it before and
 * after hydration. That is this file. It is deliberately dependency-free apart
 * from tokens, so it can be mounted above the Emotion provider.
 *
 * SSR SAFETY
 * This site is prerendered. No browser global is touched unguarded:
 *  - storage / matchMedia reads go through `readStoredTheme()` /
 *    `readSystemPreference()`, both `typeof window` guarded and try/catch'd;
 *  - the React value comes from `useSyncExternalStore`, whose *server* snapshot
 *    is `defaultTheme` — so prerender markup and the first hydration render
 *    agree, and the stored preference is applied in a follow-up render. That is
 *    the canonical React pattern for "client knows something the server did not"
 *    and it avoids the hydration mismatch a naive lazy `useState` would cause.
 *  - document mutation happens in effects / event handlers only.
 *
 * See README.md for the (short) public API and how the platform provider wires
 * `activeTheme` into `<ThemeProvider>`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useTheme } from '@emotion/react';
import { themes, type ThemeName, type Tokens } from 'app/theme/tokens';

/* Re-exported so consumers of the preference module have the theme types to
 * hand without importing tokens directly. */
export type { ThemeName, Tokens };

/* -------------------------------------------------------------------------- */
/* Pure helpers — unit tested directly (no DOM, no globals)                    */
/* -------------------------------------------------------------------------- */

/** Key used for the persisted preference. Namespaced to survive sibling apps. */
export const THEME_STORAGE_KEY = 'portfolio.theme';

/** What the prerender and the first hydration render both see. */
export const DEFAULT_THEME: ThemeName = 'dark';

export type ThemeSource = 'default' | 'storage' | 'system' | 'user';

export function isThemeName(value: unknown): value is ThemeName {
  return value === 'dark' || value === 'light';
}

/**
 * Preference order: explicit storage → OS `prefers-color-scheme` → default.
 * `system: undefined` means "unknown" (server, or a browser without
 * matchMedia) and must not override the default.
 */
export function resolveThemeName(input: {
  stored?: string | null;
  system?: boolean | null;
  defaultTheme?: ThemeName;
}): ThemeName {
  if (isThemeName(input.stored)) return input.stored;
  if (input.system === true) return 'dark';
  if (input.system === false) return 'light';
  return input.defaultTheme ?? DEFAULT_THEME;
}

/**
 * The document attributes a theme implies. Kept as data (not DOM calls) so it
 * can be asserted in a node-environment unit test and reused by the prerender.
 */
export function themeDocumentAttributes(name: ThemeName): {
  rootAttributes: Record<string, string>;
  metaContent: string;
} {
  return {
    rootAttributes: { 'data-theme': name, 'data-emotion-theme': name },
    metaContent: name,
  };
}

/* -------------------------------------------------------------------------- */
/* Guarded browser access                                                      */
/* -------------------------------------------------------------------------- */

function readStoredTheme(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === null) return null;
    /* Same key and shape as lib/storage themeStore ({theme: 'dark'|'light'});
     * tolerate a bare string written by older builds or other tabs. */
    if (raw === 'dark' || raw === 'light') return raw;
    const parsed = JSON.parse(raw) as { theme?: unknown };
    return parsed && (parsed.theme === 'dark' || parsed.theme === 'light') ? parsed.theme : null;
  } catch {
    /* Private mode / disabled storage: treat as "no preference". */
    return null;
  }
}

function writeStoredTheme(name: ThemeName): void {
  if (typeof window === 'undefined') return;
  try {
    /* JSON shape shared with themeStore + public/theme-init.js — all three
     * readers must agree or the pre-paint script silently ignores choices. */
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: name }));
  } catch {
    /* Quota / private mode: the session still works, it just will not persist. */
  }
}

/** true = prefers dark, false = prefers light, undefined = cannot tell. */
function readSystemPreference(): boolean | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return undefined;
  }
}

function watchSystemPreference(onChange: (name: ThemeName) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  let query: MediaQueryList;
  try {
    query = window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return () => undefined;
  }
  const handler = (event: MediaQueryListEvent) => onChange(event.matches ? 'dark' : 'light');
  /* addEventListener on MediaQueryList is the modern form; older Safari only
   * has addListener. Support both, drop neither silently. */
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }
  const legacy = query as MediaQueryList & {
    addListener: (cb: (e: MediaQueryListEvent) => void) => void;
    removeListener: (cb: (e: MediaQueryListEvent) => void) => void;
  };
  legacy.addListener(handler);
  return () => legacy.removeListener(handler);
}

/**
 * Mirror the preference onto the document so CSS outside React, the browser
 * chrome (form controls, scrollbars, `color-scheme`), and the prerendered shell
 * all agree with the React tree.
 */
export function applyThemeToDocument(name: ThemeName): void {
  if (typeof document === 'undefined') return;
  const { rootAttributes, metaContent } = themeDocumentAttributes(name);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(rootAttributes)) root.setAttribute(key, value);
  root.style.colorScheme = name;
  let meta = document.querySelector('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'color-scheme');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', metaContent);
}

/* -------------------------------------------------------------------------- */
/* The store                                                                   */
/* -------------------------------------------------------------------------- */

export interface ThemeSnapshot {
  themeName: ThemeName;
  resolvedFrom: ThemeSource;
}

function initialSnapshot(): ThemeSnapshot {
  const stored = readStoredTheme();
  const system = readSystemPreference();
  const themeName = resolveThemeName({ stored, system });
  if (isThemeName(stored)) return { themeName, resolvedFrom: 'storage' };
  if (system !== undefined && system !== null) return { themeName, resolvedFrom: 'system' };
  return { themeName, resolvedFrom: 'default' };
}

let snapshot: ThemeSnapshot = initialSnapshot();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ThemeSnapshot {
  return snapshot;
}

/** Read the current preference without React (cross-tab assertions, telemetry). */
export function getThemePreferenceSnapshot(): ThemeSnapshot {
  return snapshot;
}

/**
 * Change the preference. Persist + document side effects happen here rather than
 * in an effect because callers are event handlers (client-only by definition)
 * and we want the `data-theme` flip and the React re-render in the same frame —
 * an effect-scheduled flip visibly repaints the document background.
 */
export function setThemePreference(name: ThemeName, source: ThemeSource = 'user'): void {
  if (!isThemeName(name)) return;
  if (snapshot.themeName === name && snapshot.resolvedFrom === source) return;
  snapshot = { themeName: name, resolvedFrom: source };
  writeStoredTheme(name);
  applyThemeToDocument(name);
  emit();
}

/**
 * Adopt a preference written by ANOTHER tab (storage event). Deliberately does
 * not re-write storage: writing back fires the event in the origin tab, which
 * (same-value or not, browsers differ) risks a tab ping-pong. (R3C-05)
 */
function adoptExternalTheme(name: ThemeName): void {
  if (snapshot.themeName === name) return;
  snapshot = { themeName: name, resolvedFrom: 'user' };
  applyThemeToDocument(name);
  emit();
}

/** Parse a storage value in either accepted shape ({theme} JSON or bare string). */
function parseThemeStorage(raw: string | null): ThemeName | null {
  if (raw === null) return null;
  if (isThemeName(raw)) return raw;
  try {
    const v = (JSON.parse(raw) as { theme?: unknown }).theme;
    return isThemeName(v) ? v : null;
  } catch {
    return null;
  }
}

let crossTabAttached = false;

/* Cross-tab sync (R3C-05): localStorage fires `storage` only in OTHER
 * tabs/windows; replay it into this tab's snapshot so open tabs cannot
 * visibly diverge after a toggle anywhere. Attached at module load (once)
 * rather than per-provider-mount: the store is a singleton anyway, and the
 * listener must exist even in tabs where the provider re-renders eagerly.
 * SSR-safe by the typeof guard; testable via a re-import with a stubbed
 * window (see layout.test.tsx). */
function attachCrossTabSync(): void {
  /* needs BOTH globals: the handler's consequence (applyThemeToDocument)
   * requires document; attaching to a window-less env would drift. */
  if (
    crossTabAttached ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  )
    return;
  crossTabAttached = true;
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const name = parseThemeStorage(event.newValue);
    if (name) adoptExternalTheme(name);
  });
}
attachCrossTabSync();

/** Test-only: forget any state a previous test wrote. */
export function __resetThemePreference(): void {
  snapshot = initialSnapshot();
  emit();
}

/* -------------------------------------------------------------------------- */
/* Provider + hooks                                                            */
/* -------------------------------------------------------------------------- */

export interface ThemePreferenceValue extends ThemeSnapshot {
  setThemeName: (name: ThemeName) => void;
  toggleTheme: () => void;
  /** Tokens for `themeName` — the narrow API the platform provider consumes. */
  activeTheme: Tokens;
}

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

export interface ThemePreferenceProviderProps {
  children?: ReactNode;
  /** The theme used for prerender + the first hydration render. */
  defaultTheme?: ThemeName;
  /** Follow OS changes until the visitor picks explicitly (then storage wins). */
  followSystem?: boolean;
}

export function ThemePreferenceProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  followSystem = true,
}: ThemePreferenceProviderProps): ReactNode {
  const serverSnapshot = useMemo<ThemeSnapshot>(
    () => ({ themeName: defaultTheme, resolvedFrom: 'default' }),
    [defaultTheme],
  );
  const current = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);

  /* Make sure the document matches the store even when React's first paint came
   * from the server snapshot (prerender) and no interaction happened. */
  useEffect(() => {
    applyThemeToDocument(snapshot.themeName);
  }, [current.themeName]);

  useEffect(() => {
    if (!followSystem) return undefined;
    return watchSystemPreference((name) => {
      /* A stored choice is an explicit choice — stop following the OS then. */
      if (isThemeName(readStoredTheme())) return;
      setThemePreference(name, 'system');
    });
  }, [followSystem]);

  const setThemeName = useCallback((name: ThemeName) => setThemePreference(name, 'user'), []);
  const toggleTheme = useCallback(
    () => setThemePreference(snapshot.themeName === 'dark' ? 'light' : 'dark', 'user'),
    [],
  );

  const value = useMemo<ThemePreferenceValue>(
    () => ({
      themeName: current.themeName,
      resolvedFrom: current.resolvedFrom,
      setThemeName,
      toggleTheme,
      activeTheme: themes[current.themeName],
    }),
    [current.themeName, current.resolvedFrom, setThemeName, toggleTheme],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceValue {
  const value = useContext(ThemePreferenceContext);
  if (!value) {
    throw new Error(
      '[layout] useThemePreference must be used inside <ThemePreferenceProvider> — render it above the Emotion ThemeProvider.',
    );
  }
  return value;
}

/**
 * Non-throwing probe used by AppThemeProvider (platform) when ThemePreference
 * (chrome) may or may not be mounted above it. Present → chrome owns the
 * preference and the Emotion theme delegates to it. Absent (unit tests, or a
 * future embed) → the platform provider falls back to its own storage logic.
 */
export function useThemePreferenceIfPresent(): ThemePreferenceValue | null {
  return useContext(ThemePreferenceContext);
}

/**
 * Typed view of the Emotion theme. `@emotion/react`'s `useTheme()` returns an
 * index-signature `Theme`, which makes `theme.color.accent` untyped; every
 * component in this folder goes through here instead.
 */
export function useThemeTokens(): Tokens {
  return useTheme() as Tokens;
}

/**
 * True when the visitor asked the OS to reduce motion. `undefined` while
 * server-rendering; callers treat that as "no transition" (the CSS side is
 * covered by `@media (prefers-reduced-motion: reduce)` regardless).
 */
export function usePrefersReducedMotion(): boolean {
  const server = useMemo(() => false, []);
  return useSyncExternalStore(
    (listener) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
      let query: MediaQueryList;
      try {
        query = window.matchMedia('(prefers-reduced-motion: reduce)');
      } catch {
        return () => undefined;
      }
      const handler = () => listener();
      if (typeof query.addEventListener !== 'function') return () => undefined;
      query.addEventListener('change', handler);
      return () => query.removeEventListener('change', handler);
    },
    () => readSystemPreferenceReducedMotion(),
    () => server,
  );
}

function readSystemPreferenceReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Respect the preference when calling `scrollTo` / `scrollIntoView`. */
export function scrollBehaviorFor(reduced: boolean): ScrollBehavior {
  return reduced ? 'auto' : 'smooth';
}

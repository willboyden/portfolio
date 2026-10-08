/**
 * App theme provider — the seam between tokens, localStorage, OS preference,
 * and the document shell.
 *
 * Pinned CONTRACT §4 API (siblings code against these sight-unseen):
 *   AppThemeProvider({ children })
 *   useReducedMotion(): boolean
 *   useThemeName(): [ThemeName, (t: ThemeName) => void]
 * Plus `useThemePreference` / `useThemeController` extras for the header
 * toggle, and `themeInitScript` for the prerenderer (see README integration
 * snippet).
 *
 * NO-FLASH DESIGN
 * ---------------
 * React hydration is too late: the browser paints the static HTML before any
 * module runs. The prerenderer therefore embeds `themeInitScript` (below) as
 * inline <script> in <head>, BEFORE the stylesheet/module tags. It reads the
 * same localStorage key this provider writes, and stamps `data-theme` +
 * `style.colorScheme` on <html> synchronously before first paint. The server
 * render of AppThemeProvider always emits the DARK theme (the static shell's
 * default), so even with JS disabled the shell matches its CSS; the effect in
 * useThemeNameState reconciles after mount, normally a no-op.
 */

import { createContext, createElement, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Global, ThemeProvider as EmotionThemeProvider, useTheme } from '@emotion/react';
import { darkTheme, lightTheme, themes, type ThemeName, type Tokens } from 'app/theme/tokens';
import { buildGlobalStyles } from './global-styles';
import { useReducedMotion as useReducedMotionImpl, useThemeNameState } from 'app/lib/hooks';
import { useThemePreferenceIfPresent } from 'app/components/layout/ThemePreference';
import type { ThemePreference } from 'app/lib/storage';

/* -------------------------------------------------------------------------- */
/* themeInitScript — the snippet the prerenderer embeds in <head>             */
/* -------------------------------------------------------------------------- */

/** localStorage key this script and themeStore agree on (kept in sync manually:
 *  this string must never import runtime code — it is inlined verbatim). */
export const THEME_INIT_SCRIPT_STORAGE_KEY = 'portfolio.theme';

/**
 * Self-contained, dependency-free ES5-ish IIFE. Reads the stored preference,
 * falls back to prefers-color-scheme, and stamps the document element BEFORE
 * paint. Valid JS — the unit test evals it against a fake document.
 * Embed as: `<script>${themeInitScript}</script>` placed after <meta> tags
 * and before any <link rel=stylesheet> / module script.
 */
export const themeInitScript = `(function(){try{var d=document.documentElement;var k='${THEME_INIT_SCRIPT_STORAGE_KEY}';var p=null;try{var r=localStorage.getItem(k);if(r){p=JSON.parse(r).theme}}catch(e){}var t;if(p==='dark'||p==='light'){t=p;d.style.colorScheme=p}else{t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.style.colorScheme='dark light'}d.setAttribute('data-theme',t)}catch(e){}})();`;

/* -------------------------------------------------------------------------- */
/* Context                                                                     */
/* -------------------------------------------------------------------------- */

interface ThemeControllerValue {
  themeName: ThemeName;
  preference: ThemePreference;
  setThemeName: (name: ThemeName) => void;
  cycle: () => void;
}

const ThemeControllerContext = createContext<ThemeControllerValue | null>(null);

function useController(): ThemeControllerValue {
  const value = useContext(ThemeControllerContext);
  if (!value) {
    throw new Error('[ThemeProvider] useThemeName/useThemeController must render inside <AppThemeProvider>.');
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* Pinned API                                                                  */
/* -------------------------------------------------------------------------- */

export interface AppThemeProviderProps {
  children?: ReactNode;
  /**
   * Force a theme (prerenderer can pass 'dark' explicitly). When omitted the
   * provider follows stored preference → system → dark, exactly like the init
   * script.
   */
  forcedTheme?: ThemeName;
}

/**
 * Wrap the whole app. Provides the Emotion theme (tokens), the global stylesheet
 * (single source: buildGlobalStyles), document attributes, and the theme
 * controller. Renders DARK tokens on the server so the static shell is stable.
 */
export function AppThemeProvider({ children, forcedTheme }: AppThemeProviderProps): ReactNode {
  /* Single source of truth when mounted: chrome's ThemePreferenceProvider (if
   * rendered above us by App) owns the preference — storage, system, DOM
   * effects. Standalone (unit tests, embeds) we fall back to the platform's
   * own store logic. Only ONE controller is ever active per tree. */
  const chrome = useThemePreferenceIfPresent();
  const platform = useThemeNameState();
  const controller = useMemo<ThemeControllerValue>(() => {
    if (!chrome) return platform;
    return {
      themeName: chrome.themeName,
      preference: chrome.resolvedFrom === 'user' ? chrome.themeName : 'system',
      setThemeName: chrome.setThemeName,
      cycle: () => chrome.setThemeName(chrome.themeName === 'dark' ? 'light' : 'dark'),
    };
  }, [chrome, platform]);
  const themeName: ThemeName = forcedTheme ?? controller.themeName;
  const theme: Tokens = themes[themeName];
  const globalStyles = useMemo(() => buildGlobalStyles(theme), [theme]);

  useEffect(() => {
    /* Keep the document shell in sync with React's view (init script did the
     * pre-paint pass; this covers runtime changes and any drift). When chrome
     * owns the preference it already mirrors to the document itself. */
    if (typeof document === 'undefined' || chrome) return;
    try {
      document.documentElement.setAttribute('data-theme', themeName);
      document.documentElement.style.colorScheme =
        controller.preference === 'system' ? 'dark light' : themeName;
    } catch {
      /* document detached mid-unmount */
    }
  }, [themeName, controller.preference, chrome]);

  return createElement(
    ThemeControllerContext.Provider,
    { value: controller },
    createElement(
      EmotionThemeProvider,
      { theme },
      createElement(Global, { styles: globalStyles as never }),
      children,
    ),
  );
}

/**
 * Pinned signature: `[themeName, setThemeName]`. Destructure for a toggle:
 * `const [name, setName] = useThemeName()`. For tri-state (system/light/dark)
 * UI use useThemeController() instead.
 */
export function useThemeName(): [ThemeName, (t: ThemeName) => void] {
  const { themeName, setThemeName } = useController();
  return [themeName, setThemeName];
}

/** Full controller for the header toggle (preference + cycle). */
export function useThemeController(): ThemeControllerValue {
  return useController();
}

/** Pinned signature: prefers-reduced-motion, live + SSR-safe. */
export function useReducedMotion(): boolean {
  return useReducedMotionImpl();
}

/** Escape hatch: raw Emotion theme (== tokens) for sibling convenience. */
export function useTokens(): Tokens {
  return useTheme() as Tokens;
}

export { darkTheme, lightTheme };

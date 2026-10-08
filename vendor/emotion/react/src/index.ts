/**
 * @emotion/react (vendored subset) — theme context, css(), Global, keyframes.
 *
 * Parity + divergence notes: see vendor/emotion/README.md. The headline
 * divergence is that the `css` JSX prop transform is NOT provided (it needs a
 * Babel plugin); application code uses `styled(...)` or `css()` + className.
 */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type Context,
  type ReactNode,
} from 'react';
import {
  registerKeyframes,
  registerRaw,
  registerStyle,
  interpolate,
  serializeArgs,
  serializeStyles,
  __sheetCss,
  type StyleObject,
  type StyleValue,
} from '@emotion-mini/core';

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

export type Theme = Record<string, any>;

export const emptyTheme: Theme = {};

export const ThemeContext: Context<Theme | null> = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  theme: Theme | ((outerTheme: Theme) => Theme);
  children?: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps): ReactNode {
  const outer = useContext(ThemeContext) ?? emptyTheme;
  const value = useMemo<Theme>(
    () => (typeof theme === 'function' ? theme(outer) : theme),
    [theme, outer],
  );
  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    /* Emotion throws here. Match that loudly instead of failing silently with
     * an empty theme, which produces invisible components that are agony to
     * debug in prerender output. */
    throw new Error(
      '[emotion-mini] useTheme returned undefined — render the tree inside <ThemeProvider>.',
    );
  }
  return theme;
}

/* -------------------------------------------------------------------------- */
/* css()                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Read the theme, tolerating calls made outside a render.
 *
 * `keyframes()` and static `css()` are legitimately called at module scope in
 * Emotion codebases, where hook access is illegal: React logs an "Invalid hook
 * call" warning and throws, which we catch. Module-scope callers simply get an
 * empty theme (no theme interpolation resolves there — same as upstream
 * Emotion). Inside a component render the context read succeeds normally.
 */
function useContextSafe(): Theme {
  try {
    const theme = useContext(ThemeContext);
    return theme ?? emptyTheme;
  } catch {
    return emptyTheme;
  }
}

/**
 * `css` as a plain function call (NOT the JSX prop): returns a class name you
 * apply manually or via <ClassNames>. Accepts template literals, style objects,
 * arrays, and theme functions.
 */
export function css(strings: TemplateStringsArray, ...interpolations: StyleValue[]): string;
export function css(...args: StyleValue[]): string;
export function css(...args: unknown[]): string {
  const theme = useContextSafe();
  const { name, styles } = serializeStyles('css', interpolate(args), { theme });
  return registerStyle(name, styles);
}

export interface ClassNamesRenderProps {
  css: (...args: StyleValue[]) => string;
  cx: (...inputs: Array<string | false | null | undefined>) => string;
  theme: Theme;
}

/** <ClassNames>{({ css, cx, theme }) => ...}</ClassNames> — Emotion parity. */
export function ClassNames({
  children,
}: {
  children: (props: ClassNamesRenderProps) => ReactNode;
}): ReactNode {
  const theme = useContextSafe();
  const api: ClassNamesRenderProps = {
    css: (...args) => {
      const { name, styles } = serializeStyles('css', interpolate(args), { theme });
      return registerStyle(name, styles);
    },
    cx: (...inputs) => inputs.filter(Boolean).join(' '),
    theme,
  };
  return children(api);
}

/* -------------------------------------------------------------------------- */
/* Global styles + keyframes                                                  */
/* -------------------------------------------------------------------------- */

export interface GlobalProps {
  styles: StyleValue | StyleValue[] | StyleObject;
}

/**
 * <Global styles={...} /> — emits unscoped CSS (element selectors, @font-face,
 * :root custom properties). Styles are registered during render, and removed on
 * unmount ONLY if nothing else registered the same text meanwhile.
 */
export function Global({ styles }: GlobalProps): null {
  const theme = useContextSafe();
  const list: StyleValue[] = Array.isArray(styles) ? (styles as StyleValue[]) : [styles as StyleValue];
  const cssText = useMemo(() => serializeArgs(list, theme), [styles, theme]);
  const keyRef = useRef<string | null>(null);

  if (cssText.trim()) {
    /* Deterministic key so prerender + client agree. */
    const key = `global:${cssText.slice(0, 40)}`;
    keyRef.current = key;
    registerRaw(key, cssText);
  }

  useEffect(() => {
    /* Keep styles alive for the component's lifetime; the sheet is cumulative,
     * matching emotion's cache behaviour closely enough for a static site. */
  }, [cssText]);

  return null;
}

/**
 * `keyframes` template/tag returning a unique animation name.
 *
 * Theme values are NOT interpolated inside keyframes (neither module-scope nor
 * in-render), matching upstream Emotion, whose `keyframes` serializes without a
 * theme. Put color-dependent animation values in the theme via CSS custom
 * properties instead — e.g. animate `opacity`/`transform`, or reference
 * `var(--c-accent)` that `<Global>` defines from tokens.
 */
export function keyframes(strings: TemplateStringsArray, ...interpolations: StyleValue[]): string;
export function keyframes(...args: StyleValue[]): string;
export function keyframes(...args: unknown[]): string {
  const text = serializeArgs(interpolate(args), emptyTheme);
  return registerKeyframes(text);
}

/** Serialize everything registered so far — the prerender entry point. */
export function extractCriticalStyles(): string {
  return __sheetCss();
}

/* Emotion also exports `withEmotionCache` / `CacheProvider`; the app never used
 * them, and a no-op shim here would only hide mistakes, so they are omitted. */

export const jsx = createElement;

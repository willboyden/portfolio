/**
 * Site chrome public API.
 *
 * Import from `app/components/layout` (or `./layout`) rather than individual
 * files so Batch B integration has one surface to change. `src/components/ui/*`
 * is intentionally NOT referenced here — this folder is self-contained by
 * design (the two are merged in Batch B, not here).
 */

export { Header, type HeaderProps } from './Header';
export { Footer, SOCIAL_LINKS, RSS_HREF, type FooterProps, type SocialLink } from './Footer';
export { Layout, type LayoutProps } from './Layout';
export {
  Nav,
  NAV_ITEMS,
  decorateNavItems,
  isNavActive,
  normalizePath,
  type NavItem,
  type NavProps,
} from './Nav';
export { MobileMenu, MOBILE_MENU_ID, type MobileMenuProps } from './MobileMenu';
export { ThemeToggle, type ThemeToggleProps } from './ThemeToggle';
export {
  ThemePreferenceProvider,
  useThemePreference,
  useThemeName,
  useActiveTheme,
  useThemeTokens,
  usePrefersReducedMotion,
  setThemePreference,
  applyThemeToDocument,
  resolveThemeName,
  isThemeName,
  themeDocumentAttributes,
  scrollBehaviorFor,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  type ThemeName,
  type ThemePreferenceValue,
  type ThemePreferenceProviderProps,
  type ThemeSource,
} from './ThemePreference';
export type { ThemeName as TokenThemeName } from 'app/theme/tokens';

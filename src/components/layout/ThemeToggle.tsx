/**
 * ThemeToggle — a single button that flips dark/light.
 *
 * It renders a *label describing the action it will perform* ("Switch to light
 * theme") rather than the current state, which is the reading that is least
 * likely to confuse a screen-reader user pressing an unlabeled sun glyph. The
 * `data-theme` attribute is also mirrored on the button so the e2e suite can
 * assert state without depending on icon choice.
 *
 * SSR: renders identically on server and client — the preference hook returns
 * the server snapshot during prerender and the stored value afterwards.
 */

import type { ReactNode } from 'react';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { useThemePreference, useThemeTokens } from './ThemePreference';

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => p.theme.space[2]};
  min-width: 44px;
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: transparent;
  color: ${(p) => p.theme.color.textMuted};
  cursor: pointer;
  transition:
    color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    background-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  &:hover {
    color: ${(p) => p.theme.color.text};
    background: ${(p) => p.theme.color.surfaceHover};
    border-color: ${(p) => p.theme.color.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* Module-scope `css()` would log "Invalid hook call" (no theme context outside
 * a render), so icons are styled components, resolved per render like the rest. */
const Icon = styled.svg`
  width: 18px;
  height: 18px;
  flex: none;
  display: block;
`;

/** Hand-drawn inline SVG — no icon package is installed (CONTRACT §0). */
function SunIcon(): ReactNode {
  return (
    <Icon
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      data-testid="icon-sun"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" />
    </Icon>
  );
}

function MoonIcon(): ReactNode {
  return (
    <Icon
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-testid="icon-moon"
    >
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a7.2 7.2 0 1 0 10.2 10.2z" />
    </Icon>
  );
}

/** Human label for the theme the button will switch *to*. */
export function nextThemeLabel(current: 'dark' | 'light'): string {
  return current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

export interface ThemeToggleProps {
  /** Render the label next to the glyph (used in the mobile menu). */
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ showLabel = false, className }: ThemeToggleProps): ReactNode {
  const tokens = useThemeTokens();
  const { themeName, toggleTheme } = useThemePreference();
  const label = nextThemeLabel(themeName);

  const labelClass = css`
    font-family: ${tokens.font.sans};
    font-size: ${tokens.font.sizes.sm};
    font-weight: ${tokens.font.weights.medium};
    color: ${tokens.color.textMuted};
  `;

  return (
    <Button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      data-theme={themeName}
      className={className}
    >
      {themeName === 'dark' ? <SunIcon /> : <MoonIcon />}
      {showLabel ? <span className={labelClass}>{label}</span> : null}
    </Button>
  );
}

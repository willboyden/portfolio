/**
 * Header — sticky site header with wordmark, desktop nav, theme toggle, and
 * the small-screen menu button + MobileMenu dialog.
 *
 * Layout notes
 * - `position: sticky; top: 0` + `z-index: theme.z.nav`.
 * - The bar is opaque paper with a hairline under it. It is deliberately not
 *   a translucent blur: text scrolling under a see-through bar costs contrast
 *   and the page is meant to read as a printed sheet.
 * - Desktop nav / mobile button swap purely on CSS breakpoints (`md`), so
 *   prerendered markup always contains both and hydration cannot disagree.
 * - `aria-expanded` / `aria-controls` on the button describe the dialog that
 *   MobileMenu renders; `aria-controls` is present in the CLOSED state too and
 *   points at an id that only exists while open — the pattern ARIA permits
 *   (`aria-controls` may reference a not-yet-rendered element) and the one the
 *   unit tests assert on.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Link } from '@portfolio/router';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { Nav } from './Nav';
import { ThemeToggle } from './ThemeToggle';
import { MobileMenu } from './MobileMenu';
import { useThemePreference, useThemeTokens } from './ThemePreference';

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: ${(p) => p.theme.z.nav};
  /* R3D-05: viewport sets viewport-fit=cover; in standalone display mode a
   * notch would sit on the sticky header. env() is 0 outside notched
   * standalone, so the navHeight token still matches everywhere else. */
  padding-top: env(safe-area-inset-top);
  background: ${(p) => p.theme.color.bg};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
  font-family: ${(p) => p.theme.font.sans};
`;

const Inner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[4]};
  min-height: ${(p) => p.theme.layout.navHeight};
  max-width: ${(p) => p.theme.layout.maxWidth};
  margin: 0 auto;
  padding: 0 ${(p) => p.theme.layout.gutter};
`;

/* styled(Link) would drop `to` (the vendored prop filter is an allow-list for
 * non-intrinsic targets), so the wordmark is a css() class on a router Link. */
function wordmarkClass(tokens: ReturnType<typeof useThemeTokens>): string {
  return css`
    display: inline-flex;
    align-items: center;
    gap: ${tokens.space[3]};
    min-height: 44px;
    padding: ${tokens.space[1]} 0;
    border-radius: ${tokens.radius.sm};
    font-family: ${tokens.font.serif};
    font-size: ${tokens.font.sizes.lg};
    font-weight: ${tokens.font.weights.semibold};
    letter-spacing: ${tokens.font.tracking.tight};
    white-space: nowrap;
    color: ${tokens.color.text};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
      text-decoration-color: ${tokens.color.accentBorder};
      text-decoration-thickness: 2px;
      text-underline-offset: 0.25em;
    }

    &:focus-visible {
      outline: 2px solid ${tokens.color.focus};
      outline-offset: 3px;
    }
  `;
}

/* The monogram is a swatch of the highlighter: a small label, set like data. */
const WordmarkMark = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3em 0.4em 0.22em;
  background: ${(p) => p.theme.color.mark};
  color: ${(p) => p.theme.color.markInk};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.normal};
  line-height: ${(p) => p.theme.font.leading.none};
  letter-spacing: ${(p) => p.theme.font.tracking.normal};
`;

const DesktopNav = styled.nav`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  margin-left: auto;

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    display: none;
  }
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  flex: none;
`;

/* Menu button only exists below `md`; the toggle lives outside this wrapper so
 * it is reachable at every width (the dialog carries its own labelled toggle). */
const MenuSlot = styled.div`
  display: none;
  align-items: center;

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    display: flex;
  }
`;

const MenuButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => p.theme.space[2]};
  min-width: 44px;
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]} ${(p) => p.theme.space[3]};
  border: 1px solid ${(p) => p.theme.color.borderStrong};
  border-radius: ${(p) => p.theme.radius.md};
  background: transparent;
  color: ${(p) => p.theme.color.text};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  cursor: pointer;

  &:hover {
    background: ${(p) => p.theme.color.mark};
    color: ${(p) => p.theme.color.markInk};
    border-color: ${(p) => p.theme.color.markInk};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;

const Bars = styled.span<{ $open: boolean }>`
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  width: 18px;
  height: 18px;

  & i {
    display: block;
    height: 2px;
    width: 100%;
    background: currentColor;
    transform-origin: center;
    transition:
      transform ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
      opacity ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};
  }

  & i:nth-child(1) {
    transform: ${(p) => (p.$open ? 'translateY(5px) rotate(45deg)' : 'none')};
  }
  & i:nth-child(2) {
    opacity: ${(p) => (p.$open ? 0 : 1)};
  }
  & i:nth-child(3) {
    transform: ${(p) => (p.$open ? 'translateY(-5px) rotate(-45deg)' : 'none')};
  }

  @media (prefers-reduced-motion: reduce) {
    & i {
      transition: none;
    }
  }
`;

export interface HeaderProps {
  /** Route for active-link state; defaults to the router (see Nav.tsx). */
  currentPath?: string;
  /** Force the initial menu state (tests / prerender of the open dialog). */
  menuOpen?: boolean;
  /** Name shown in the wordmark. */
  name?: string;
}

export function Header({ currentPath, menuOpen = false, name = 'William Boyden' }: HeaderProps): ReactNode {
  const [open, setOpen] = useState(menuOpen);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tokens = useThemeTokens(); /* also asserts a ThemeProvider wraps us */
  const { themeName } = useThemePreference();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  const srOnly = css`
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  `;

  return (
    <>
      <Bar data-testid="site-header" data-theme={themeName}>
        <Inner>
          <Link to="/" className={wordmarkClass(tokens)} data-testid="wordmark" aria-label={`${name} — home`}>
            <WordmarkMark aria-hidden="true">WB</WordmarkMark> {name}
          </Link>

          <DesktopNav aria-label="Primary" data-testid="desktop-nav">
            <Nav currentPath={currentPath} label="Primary" id="primary-nav-list" />
          </DesktopNav>

          <Actions data-testid="header-actions">
            <ThemeToggle />
            <MenuSlot>
              <MenuButton
                type="button"
                ref={triggerRef}
                onClick={toggle}
                aria-expanded={open}
                aria-controls="mobile-nav-dialog"
                aria-haspopup="dialog"
                data-testid="menu-button"
                data-open={open ? 'true' : 'false'}
              >
                <Bars $open={open} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </Bars>
                <span className={srOnly}>{open ? 'Close navigation menu' : 'Open navigation menu'}</span>
              </MenuButton>
            </MenuSlot>
          </Actions>
        </Inner>
      </Bar>

      <MobileMenu open={open} onClose={close} currentPath={currentPath} returnFocusRef={triggerRef} />
    </>
  );
}

/**
 * Layout — the page shell: skip link, Header, <main id="main">, Footer.
 *
 * Deliberately does NOT render a `<Global>` that styles `body`: the platform
 * provider (CONTRACT §4, `src/theme/ThemeProvider.tsx`) owns document-level
 * styles, and two owners of `body { background }` is how a light theme ends up
 * with a dark flash. The shell paints its own background/foreground from tokens
 * and fills the viewport, which is enough for the page to look finished even if
 * Global stays minimal.
 *
 * The skip link is the FIRST element in the DOM, so it is the first thing Tab
 * reaches; it is visually hidden until focused (clip technique, not
 * `display:none`, so it stays focusable).
 */

import type { ReactNode } from 'react';
import { Global, css } from '@emotion/react';
import styled from '@emotion/styled';
import { Header } from './Header';
import { Footer } from './Footer';
import { useThemeTokens } from './ThemePreference';

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: ${(p) => p.theme.color.bg};
  color: ${(p) => p.theme.color.text};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  -webkit-font-smoothing: antialiased;
`;

const Main = styled.main`
  flex: 1 1 auto;
  width: 100%;
  max-width: ${(p) => p.theme.layout.maxWidth};
  margin: 0 auto;
  padding: ${(p) => p.theme.space[7]} ${(p) => p.theme.layout.gutter}
    ${(p) => p.theme.space[9]};
  outline: none;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: -2px;
  }

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    padding-top: ${(p) => p.theme.space[5]};
  }
`;

export function skipLinkClass(tokens: ReturnType<typeof useThemeTokens>): string {
  return css`
    position: absolute;
    top: ${tokens.space[2]};
    left: ${tokens.space[2]};
    z-index: ${tokens.z.toast + 1};
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: ${tokens.space[2]} ${tokens.space[4]};
    border-radius: ${tokens.radius.md};
    background: ${tokens.color.accent};
    color: ${tokens.color.accentText};
    font-family: ${tokens.font.sans};
    font-size: ${tokens.font.sizes.sm};
    font-weight: ${tokens.font.weights.semibold};
    text-decoration: none;
    /* Hidden off-canvas rather than display:none — a hidden element that is
       still focusable is the whole point of a skip link. */
    clip-path: inset(50%);
    clip: rect(0 0 0 0);
    width: 1px;
    height: 1px;
    overflow: hidden;
    white-space: nowrap;

    &:focus,
    &:focus-visible {
      clip-path: none;
      clip: auto;
      width: auto;
      height: auto;
      overflow: visible;
      outline: 2px solid ${tokens.color.focus};
      outline-offset: 2px;
    }
  `;
}

export interface LayoutProps {
  children?: ReactNode;
  /** Route for active nav state; defaults to the router (see Nav.tsx). */
  currentPath?: string;
  name?: string;
  role?: string;
  /** Prerender the mobile dialog open (used by tests and the e2e fixtures). */
  menuOpen?: boolean;
  /** Render the header/footer at all — false for bare chrome-less pages. */
  chrome?: boolean;
}

export function Layout({
  children,
  currentPath,
  name = 'William Boyden',
  role,
  menuOpen = false,
  chrome = true,
}: LayoutProps): ReactNode {
  const tokens = useThemeTokens();
  const skip = skipLinkClass(tokens);

  return (
    <>
      {/* Selection + text rendering affordances only; `body` itself belongs to
          the platform provider. */}
      <Global
        styles={{
          '::selection': { background: tokens.color.accentSoft, color: tokens.color.text },
          '[id]': { scrollMarginTop: tokens.layout.navHeight },
        }}
      />
      <Shell data-testid="site-shell">
        <a href="#main" className={skip} data-testid="skip-link">
          Skip to main content
        </a>
        {chrome ? <Header currentPath={currentPath} name={name} menuOpen={menuOpen} /> : null}
        <Main id="main" tabIndex={-1} data-testid="main">
          {children}
        </Main>
        {chrome ? <Footer name={name} {...(role ? { role } : {})} /> : null}
      </Shell>
    </>
  );
}

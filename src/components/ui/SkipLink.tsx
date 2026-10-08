import styled from '@emotion/styled';

/**
 * SkipLink — the first focusable element on every page.
 *
 * Lives off-screen until keyboard focus arrives, then pins itself top-left
 * above the nav (z.nav + 1). Targets the layout's <main id="main"> by default.
 * It is deliberately `position: fixed` while focused so it appears even if an
 * ancestor has overflow:hidden.
 */
const Link = styled.a`
  position: absolute;
  top: ${(p) => p.theme.space['2']};
  left: ${(p) => p.theme.space['2']};
  z-index: ${(p) => p.theme.z.nav + 10};
  transform: translateY(-1000px);
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: ${(p) => p.theme.space[3]} ${(p) => p.theme.space[5]};
  background: ${(p) => p.theme.color.bgElevated};
  color: ${(p) => p.theme.color.text};
  border: 1px solid ${(p) => p.theme.color.borderStrong};
  border-radius: ${(p) => p.theme.radius.md};
  box-shadow: ${(p) => p.theme.shadow.md};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  text-decoration: none;
  transition: transform ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  &:focus,
  &:focus-visible {
    position: fixed;
    transform: translateY(0);
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export interface SkipLinkProps {
  /** Target anchor; the site layout exposes <main id="main">. */
  href?: string;
  label?: string;
  className?: string;
  'data-testid'?: string;
}

export function SkipLink({
  href = '#main',
  label = 'Skip to main content',
  className,
  ...rest
}: SkipLinkProps): React.ReactNode {
  return (
    <Link
      href={href}
      className={className}
      data-testid={rest['data-testid'] ?? 'skip-link'}
      data-skip-target={href}
    >
      {label}
    </Link>
  );
}

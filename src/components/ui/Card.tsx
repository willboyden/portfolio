import styled from '@emotion/styled';

/**
 * Card — the surface every list item and panel sits on.
 *
 * Renders <article> by default, <a> when `href` is given, and any element via
 * `as` (a router Link works: it lands as the styled `as` target and keeps the
 * card styles — verified in ui.test.tsx).
 *
 * `interactive` adds hover/focus affordances. The whole card must NOT be the
 * only link when the title also links — page builders keep a real link inside
 * and pass interactive here; that's the non-duplicate-link pattern.
 */
const Surface = styled.article<{ $interactive: boolean; $pad: 'sm' | 'md' | 'lg' }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => (p.$pad === 'sm' ? p.theme.space[4] : p.$pad === 'lg' ? p.theme.space[6] : p.theme.space[5])};
  background: ${(p) => p.theme.color.surface};
  color: ${(p) => p.theme.color.text};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
  box-shadow: ${(p) => p.theme.shadow.sm};
  text-decoration: none;
  transition:
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    box-shadow ${(p) => p.theme.motion.base} ${(p) => p.theme.motion.ease},
    transform ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  ${(p) =>
    p.$interactive &&
    `
    cursor: pointer;
    &:hover {
      border-color: ${p.theme.color.borderStrong};
      box-shadow: ${p.theme.shadow.md};
      transform: translateY(-2px);
    }
    &:focus-visible {
      outline: 2px solid ${p.theme.color.focus};
      outline-offset: 3px;
    }
  `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover {
      transform: none;
    }
  }
`;

export interface CardProps {
  interactive?: boolean;
  href?: string;
  /** Element/component to render; `href` implies an anchor. */
  as?: 'article' | 'div' | 'a' | 'li' | 'section' | React.ComponentType<{ className?: string; children?: React.ReactNode }>;
  pad?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
  'data-testid'?: string;
}

export function Card({
  interactive = false,
  href,
  as,
  pad = 'md',
  className,
  children,
  ...rest
}: CardProps): React.ReactNode {
  const target = as ?? (href ? 'a' : 'article');
  return (
    <Surface
      as={target}
      href={href}
      $interactive={interactive || Boolean(href)}
      $pad={pad}
      className={className}
      aria-label={rest['aria-label']}
      data-testid={rest['data-testid'] ?? 'card'}
    >
      {children}
    </Surface>
  );
}

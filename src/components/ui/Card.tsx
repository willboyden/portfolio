import styled from '@emotion/styled';

/**
 * Card — one entry in a list of work: an open column under a rule, not a box.
 *
 * There is no background, radius or shadow: the rule above an entry and the
 * gap around it are what separate it from its neighbours, the way a typeset
 * index separates entries. Entries of different lengths sit side by side
 * without the ragged boxes a bordered grid produces.
 *
 * Renders <article> by default, <a> when `href` is given, and any element via
 * `as` (a router Link works: it lands as the styled `as` target and keeps the
 * card styles — verified in ui.test.tsx).
 *
 * `interactive` adds hover feedback: the rule turns to ink and a highlighter
 * band appears under it. The card itself is not a link, so it does not claim
 * a pointer cursor; page builders keep a real link in the title (the
 * non-duplicate-link pattern), and that link is what gets clicked.
 */
const Surface = styled.article<{ $interactive: boolean; $pad: 'sm' | 'md' | 'lg' }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => (p.$pad === 'sm' ? p.theme.space[3] : p.$pad === 'lg' ? p.theme.space[5] : p.theme.space[4])} 0 0;
  background: transparent;
  color: ${(p) => p.theme.color.text};
  border-top: 1px solid ${(p) => p.theme.color.borderStrong};
  text-decoration: none;
  transition:
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    box-shadow ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  ${(p) =>
    p.$interactive &&
    `
    &:hover,
    &:focus-within {
      border-top-color: ${p.theme.color.rule};
      box-shadow: inset 0 3px 0 ${p.theme.color.mark};
    }
    &:focus-visible {
      outline: 2px solid ${p.theme.color.focus};
      outline-offset: 3px;
    }
  `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export interface CardProps {
  interactive?: boolean;
  href?: string;
  /** Element/component to render; `href` implies an anchor. */
  as?:
    | 'article'
    | 'div'
    | 'a'
    | 'li'
    | 'section'
    | React.ComponentType<{ className?: string; children?: React.ReactNode }>;
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

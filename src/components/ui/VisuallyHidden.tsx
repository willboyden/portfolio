import styled from '@emotion/styled';

/**
 * VisuallyHidden — content for screen readers only.
 *
 * Uses the canonical clip technique (not display:none / visibility:hidden,
 * which remove the content from the accessibility tree entirely). The element
 * keeps 1px of box so focus can still land inside it if a control lives there.
 */
const Hidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;

export interface VisuallyHiddenProps {
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export function VisuallyHidden({ className, children, ...rest }: VisuallyHiddenProps): React.ReactNode {
  return (
    <Hidden className={className} data-testid={rest['data-testid'] ?? 'visually-hidden'}>
      {children}
    </Hidden>
  );
}

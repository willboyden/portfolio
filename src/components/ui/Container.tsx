import styled from '@emotion/styled';

/**
 * Container — the page-width wrapper. Everything on a page lives in one.
 * `size="prose"` narrows to the reading measure; "narrow" is for forms/404s.
 */
const Box = styled.div<{ $size: 'default' | 'narrow' | 'prose' | 'wide' }>`
  width: 100%;
  margin: 0 auto;
  /* R2-D V1: gutter ownership lives in Layout Main — no inline padding here
   * (was double-inset content vs the header/footer rail). */
  max-width: ${(p) =>
    p.$size === 'prose'
      ? p.theme.layout.maxWidthProse
      : p.$size === 'narrow'
        ? `calc(${p.theme.layout.maxWidth} * 0.58)`
        : p.theme.layout.maxWidth};
`;

export interface ContainerProps {
  size?: 'default' | 'narrow' | 'prose' | 'wide';
  className?: string;
  children?: React.ReactNode;
  id?: string;
  'data-testid'?: string;
}

export function Container({
  size = 'default',
  className,
  children,
  id,
  ...rest
}: ContainerProps): React.ReactNode {
  return (
    <Box $size={size} id={id} className={className} data-testid={rest['data-testid'] ?? 'container'}>
      {children}
    </Box>
  );
}

import styled from '@emotion/styled';

/**
 * Stack — one-dimensional flex layout with consistent gaps.
 * Gap keys map to the space scale (0..12), never raw px.
 */
const GapKey = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '10': '10',
  '12': '12',
} as const;

export type StackGap = keyof typeof GapKey;

const Flex = styled.div<{
  $gap: StackGap;
  $direction: 'row' | 'column';
  $wrap: boolean;
  $align: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  $justify: 'start' | 'center' | 'end' | 'between';
}>`
  display: flex;
  flex-direction: ${(p) => p.$direction};
  flex-wrap: ${(p) => (p.$wrap ? 'wrap' : 'nowrap')};
  gap: ${(p) => p.theme.space[p.$gap]};
  align-items: ${(p) => (p.$align === 'stretch' ? 'stretch' : p.$align === 'between' ? 'stretch' : p.$align)};
  justify-content: ${(p) =>
    p.$justify === 'between'
      ? 'space-between'
      : p.$justify === 'center'
        ? 'center'
        : p.$justify === 'end'
          ? 'flex-end'
          : 'flex-start'};
`;

export interface StackProps {
  gap?: StackGap;
  direction?: 'row' | 'column';
  wrap?: boolean;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between';
  className?: string;
  children?: React.ReactNode;
  as?: 'div' | 'ul' | 'ol' | 'span';
  'data-testid'?: string;
}

export function Stack({
  gap = '4',
  direction = 'column',
  wrap = false,
  align = 'stretch',
  justify = 'start',
  className,
  children,
  as = 'div',
  ...rest
}: StackProps): React.ReactNode {
  return (
    <Flex
      as={as}
      $gap={gap}
      $direction={direction}
      $wrap={wrap}
      $align={align}
      $justify={justify}
      className={className}
      data-testid={rest['data-testid'] ?? 'stack'}
    >
      {children}
    </Flex>
  );
}

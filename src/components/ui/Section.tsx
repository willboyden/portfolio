import { css, useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import type { Tokens } from 'app/theme/tokens';
import { Heading } from './Heading';

/**
 * Section — a landmark region with optional eyebrow/title/description header.
 * When `title` is given it renders an h2 (id-linked via aria-labelledby) so
 * screen readers announce the region name and heading order stays h1 > h2.
 */
const Root = styled.section<{ $size: 'compact' | 'default' | 'wide' }>`
  position: relative;
  width: 100%;
  margin: 0 auto;
  padding-block: ${(p) =>
    p.$size === 'compact' ? p.theme.space[7] : p.$size === 'wide' ? p.theme.space[9] : p.theme.space[8]};
  padding-inline: ${(p) => p.theme.layout.gutter};
  max-width: ${(p) => (p.$size === 'compact' ? p.theme.layout.maxWidthProse : p.theme.layout.maxWidth)};

  &:not(:last-of-type) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;

const Eyebrow = styled.p`
  margin: 0 0 ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};
`;

const Description = styled.p`
  margin: 0 0 ${(p) => p.theme.space[5]};
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

export interface SectionProps {
  id?: string;
  size?: 'compact' | 'default' | 'wide';
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export function Section({
  id,
  size = 'default',
  eyebrow,
  title,
  description,
  className,
  children,
  ...rest
}: SectionProps): React.ReactNode {
  const theme = useTheme() as Tokens;
  const headingId = id ? `${id}-title` : undefined;
  /* styled(Heading) would strip the required `level` prop (component targets
   * are prop-filtered), so the header margin rides in as a merged className. */
  const titleClass = css({ margin: `0 0 ${theme.space[3]}` });

  return (
    <Root
      id={id}
      $size={size}
      className={className}
      aria-labelledby={headingId}
      data-testid={rest['data-testid'] ?? 'section'}
    >
      {(eyebrow || title || description) && (
        <header>
          {eyebrow && <Eyebrow data-testid="section-eyebrow">{eyebrow}</Eyebrow>}
          {title && (
            <Heading level={2} id={headingId} className={titleClass} data-testid="section-title">
              {title}
            </Heading>
          )}
          {description && <Description>{description}</Description>}
        </header>
      )}
      {children}
    </Root>
  );
}

import { css, useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import type { Tokens } from 'app/theme/tokens';
import { label } from 'app/theme/mixins';
import { Heading } from './Heading';

/**
 * Section — a landmark region with optional eyebrow/title/description header.
 * When `title` is given it renders an h2 (id-linked via aria-labelledby) so
 * screen readers announce the region name and heading order stays h1 > h2.
 *
 * Layout: a ruled notebook page. Every section opens with a full-width ink
 * rule. From the `xl` breakpoint up, the header sits in a narrow margin
 * column on the left (and stays in view while its section scrolls) and the
 * content takes the wide column, so every page lines its content up on the
 * same edge. Below `xl` the header simply stacks above the content (`xl`, not
 * `lg`: the content column must stay wide enough for a three-across grid).
 */
const Root = styled.section<{ $size: 'compact' | 'default' | 'wide' }>`
  position: relative;
  width: 100%;
  margin: 0 auto;
  padding-block: ${(p) => p.theme.space[5]}
    ${(p) => (p.$size === 'compact' ? p.theme.space[7] : p.$size === 'wide' ? p.theme.space[8] : p.theme.space[8])};
  border-top: 2px solid ${(p) => p.theme.color.rule};
  /* R2-D V1: NO padding-inline — Layout Main owns the single content gutter.
   * Sections used to add their own, doubling the inset (measured: header rail
   * at x=144 vs section text at x=192). max-width still caps prose widths. */
  max-width: ${(p) => (p.$size === 'compact' ? p.theme.layout.maxWidthProse : p.theme.layout.maxWidth)};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    display: grid;
    grid-template-columns: ${(p) => p.theme.layout.marginCol} minmax(0, 1fr);
    column-gap: ${(p) => p.theme.space[7]};
    align-items: start;
  }
`;

const Margin = styled.div`
  margin-bottom: ${(p) => p.theme.space[5]};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 1;
    margin-bottom: 0;
    position: sticky;
    top: calc(${(p) => p.theme.layout.navHeight} + ${(p) => p.theme.space[5]});
  }
`;

const Body = styled.div`
  min-width: 0;

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 2;
  }
`;

const Eyebrow = styled.p`
  margin: 0 0 ${(p) => p.theme.space[1]};
  ${(p) => label(p.theme)}
  color: ${(p) => p.theme.color.textSubtle};
`;

const Description = styled.p`
  margin: 0;
  max-width: 44ch;
  font-size: ${(p) => p.theme.font.sizes.sm};
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
  const titleClass = css({ margin: `0 0 ${theme.space[2]}` });

  return (
    <Root
      id={id}
      $size={size}
      className={className}
      aria-labelledby={title ? headingId : undefined}
      data-testid={rest['data-testid'] ?? 'section'}
    >
      {(eyebrow || title || description) && (
        <Margin as="header" data-testid="section-header">
          {eyebrow && <Eyebrow data-testid="section-eyebrow">{eyebrow}</Eyebrow>}
          {title && (
            <Heading level={2} size="xl" id={headingId} className={titleClass} data-testid="section-title">
              {title}
            </Heading>
          )}
          {description && <Description>{description}</Description>}
        </Margin>
      )}
      <Body>{children}</Body>
    </Root>
  );
}

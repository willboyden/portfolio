import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/**
 * EmptyState — the "nothing here yet / no results" panel every list page
 * needs. Optional CTA is a real focusable child passed in by the caller
 * (never a fake onClick on the panel).
 */
const Panel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => p.theme.space[6]} ${(p) => p.theme.space[5]};
  border-top: 1px solid ${(p) => p.theme.color.borderStrong};
  border-bottom: 1px solid ${(p) => p.theme.color.borderStrong};
  background: ${(p) => p.theme.color.bgSunken};
`;

const Glyph = styled.span`
  color: ${(p) => p.theme.color.textSubtle};
  display: inline-flex;
`;

const Title = styled.p`
  margin: 0;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const Description = styled.p`
  margin: 0;
  max-width: 58ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  /** Caller passes real, focusable actions (Button, Link…). */
  action?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function EmptyState({
  icon = 'search',
  title,
  description,
  action,
  className,
  ...rest
}: EmptyStateProps): React.ReactNode {
  return (
    <Panel role="status" className={className} data-testid={rest['data-testid'] ?? 'empty-state'}>
      <Glyph>
        <Icon name={icon} size={28} />
      </Glyph>
      <Title>{title}</Title>
      {description && <Description>{description}</Description>}
      {action}
    </Panel>
  );
}

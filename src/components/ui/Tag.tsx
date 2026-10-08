import styled from '@emotion/styled';

/**
 * Tag — a small non-interactive label (stack names, statuses, categories).
 *
 * Tones are contrast-checked against both themes:
 *  - default: textMuted on bgSunken (dark 8.04:1, light 6.49:1)
 *  - accent:  accent on accentSoft-over-surface (dark 4.51:1, light 4.76:1)
 *  - outline: textMuted on the caller's background (>= 6.4:1 on every surface)
 */
export type TagTone = 'default' | 'accent' | 'outline';
export type TagSize = 'sm' | 'md';

const Pill = styled.span<{ $tone: TagTone; $size: TagSize }>`
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  font-family: ${(p) => p.theme.font.sans};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.none};
  letter-spacing: ${(p) => p.theme.font.tracking.normal};
  border-radius: ${(p) => p.theme.radius.full};
  border: 1px solid transparent;
  font-size: ${(p) => (p.$size === 'sm' ? p.theme.font.sizes.xs : p.theme.font.sizes.sm)};
  padding: ${(p) =>
    p.$size === 'sm'
      ? `${p.theme.space['0']} ${p.theme.space[2]}`
      : `${p.theme.space['1']} ${p.theme.space[3]}`};

  /* default */
  ${(p) =>
    p.$tone === 'default' &&
    `background: ${p.theme.color.bgSunken}; color: ${p.theme.color.textMuted}; border-color: ${p.theme.color.border};`}

  /* accent — text sits on the translucent soft fill; checked >= 4.5:1 */
  ${(p) =>
    p.$tone === 'accent' &&
    `background: ${p.theme.color.accentSoft}; color: ${p.theme.color.accent}; border-color: ${p.theme.color.accentBorder};`}

  /* outline — transparent background, works on bg and surface alike */
  ${(p) =>
    p.$tone === 'outline' &&
    `background: transparent; color: ${p.theme.color.textMuted}; border-color: ${p.theme.color.borderStrong};`}
`;

export interface TagProps {
  tone?: TagTone;
  size?: TagSize;
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export function Tag({ tone = 'default', size = 'md', className, children, ...rest }: TagProps): React.ReactNode {
  return (
    <Pill $tone={tone} $size={size} className={className} data-testid={rest['data-testid'] ?? 'tag'}>
      {children}
    </Pill>
  );
}

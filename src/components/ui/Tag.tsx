import styled from '@emotion/styled';

/**
 * Tag — a small non-interactive label (stack names, statuses, categories).
 *
 * A tag is data about an entry, so it is set like data: mono, lower-key, on a
 * flat rectangle. No pills.
 *
 * Tones are contrast-checked against both themes (src/theme/contrast.test.ts):
 *  - default: textMuted on bgSunken
 *  - accent:  ink on a wash of the highlighter (a status worth noticing)
 *  - outline: textMuted on the caller's background, hairline frame
 */
export type TagTone = 'default' | 'accent' | 'outline';
export type TagSize = 'sm' | 'md';

const Chip = styled.span<{ $tone: TagTone; $size: TagSize }>`
  display: inline-flex;
  align-items: center;
  /* A tag stays on one line while it fits; one longer than its container (a
   * stack entry on a 320px phone) wraps instead of pushing the page sideways. */
  max-width: 100%;
  overflow-wrap: anywhere;
  font-family: ${(p) => p.theme.font.mono};
  font-weight: ${(p) => p.theme.font.weights.normal};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.normal};
  text-transform: none;
  border-radius: ${(p) => p.theme.radius.sm};
  border: 1px solid transparent;
  font-size: ${(p) => (p.$size === 'sm' ? p.theme.font.sizes.xs : p.theme.font.sizes.sm)};
  padding: ${(p) =>
    p.$size === 'sm' ? `${p.theme.space['0']} ${p.theme.space[2]}` : `${p.theme.space['1']} ${p.theme.space[2]}`};

  /* default */
  ${(p) => p.$tone === 'default' && `background: ${p.theme.color.bgSunken}; color: ${p.theme.color.textMuted};`}

  /* accent — ink on the highlighter wash */
  ${(p) => p.$tone === 'accent' && `background: ${p.theme.color.accentSoft}; color: ${p.theme.color.accent};`}

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
    <Chip $tone={tone} $size={size} className={className} data-testid={rest['data-testid'] ?? 'tag'}>
      {children}
    </Chip>
  );
}

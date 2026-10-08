import { css, useTheme } from '@emotion/react';
import type { Tokens } from 'app/theme/tokens';

/**
 * Heading — renders the semantically correct h1..h4 while letting the page
 * pick the *visual* size separately (`level` is structure, `size` is type).
 * Default size tracks the level so `<Heading level={2}>` looks like an h2.
 *
 * Uses css() + a dynamic tag because the element name is a variable; the
 * generated rule text is identical for every level (verified in ui.test.tsx —
 * all four levels share one class name).
 */
export type HeadingLevel = 1 | 2 | 3 | 4;
export type HeadingSize = 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

const defaultSize: Record<HeadingLevel, HeadingSize> = {
  1: '4xl',
  2: '2xl',
  3: 'xl',
  4: 'lg',
};

function headingCss(theme: Tokens, size: HeadingSize): string {
  return css({
    margin: '0',
    fontFamily: theme.font.sans,
    fontWeight: theme.font.weights.bold,
    lineHeight: theme.font.leading.tight,
    letterSpacing: theme.font.tracking.tight,
    color: theme.color.text,
    fontSize: theme.font.sizes[size],
    'scroll-margin-top': theme.layout.navHeight,
    /* R3D-01: content slugs/titles carry long unbreakable tokens
     * (`langfuse-observability-pragmatic`, `ILLEGAL_AGGREGATION`); at 320px a
     * fixed 48px h1 measured 341px and pushed the whole page sideways.
     * Headings may break anywhere; body prose keeps its rhythm. */
    'overflow-wrap': 'anywhere',
  });
}

export interface HeadingProps {
  level: HeadingLevel;
  /** Override the visual size; defaults to a size matched to `level`. */
  size?: HeadingSize;
  className?: string;
  id?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export function Heading({ level, size, className, id, children, ...rest }: HeadingProps): React.ReactNode {
  const theme = useTheme() as Tokens;
  const cls = `${headingCss(theme, size ?? defaultSize[level])}${className ? ` ${className}` : ''}`;
  const Tag = `h${level}` as unknown as 'h1';
  return (
    <Tag id={id} className={cls} data-testid={rest['data-testid'] ?? `heading-${level}`}>
      {children}
    </Tag>
  );
}

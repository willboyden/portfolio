import { css, useTheme } from '@emotion/react';
import type { Tokens } from 'app/theme/tokens';

/**
 * Prose — styles *generated markdown HTML* (h2/h3 anchors, lists, blockquote,
 * code, pre>code, tables, images, hr) at a ~68ch reading measure.
 *
 * All descendant selectors are scoped under the wrapper's own class
 * (`.css-x h2 { … }`), which is what keeps Prose from restyling the site
 * chrome — verified in ui.test.tsx by asserting every rule starts with the
 * wrapper class.
 *
 * Heading anchors: the markdown engine emits `<h2 id="…">`; the `a` is added
 * client-side nowhere — instead CSS shows a "#" ::before on hover/focus of an
 * `a.anchor` child if the renderer produced one, and ids get scroll-margin so
 * the sticky header never covers the target.
 */
function proseCss(theme: Tokens): string {
  const t = theme;
  return css({
    '--measure': '68ch',
    maxWidth: 'var(--measure)',
    fontFamily: t.font.sans,
    fontSize: t.font.sizes.md,
    lineHeight: t.font.leading.normal,
    color: t.color.text,

    '> *:first-of-type': { marginTop: '0' },
    '> *:last-child': { marginBottom: '0' },

    'h2, h3, h4': {
      fontFamily: t.font.sans,
      fontWeight: t.font.weights.bold,
      lineHeight: t.font.leading.snug,
      letterSpacing: t.font.tracking.tight,
      color: t.color.text,
      scrollMarginTop: t.layout.navHeight,
    },
    h2: { fontSize: t.font.sizes['2xl'], margin: `${t.space[8]} 0 ${t.space[4]}` },
    h3: { fontSize: t.font.sizes.xl, margin: `${t.space[7]} 0 ${t.space[3]}` },
    h4: { fontSize: t.font.sizes.lg, margin: `${t.space[6]} 0 ${t.space[2]}` },

    'h2 .anchor, h3 .anchor, h4 .anchor': {
      marginLeft: t.space[2],
      color: t.color.accent,
      textDecoration: 'none',
      opacity: '0',
      fontWeight: t.font.weights.medium,
    },
    'h2:hover .anchor, h3:hover .anchor, h4:hover .anchor, .anchor:focus-visible': {
      opacity: '1',
    },
    '.anchor:focus-visible': { outline: `2px solid ${t.color.focus}`, outlineOffset: '2px', borderRadius: t.radius.sm },

    p: { margin: `0 0 ${t.space[4]}` },
    'p, li': { maxWidth: 'var(--measure)' },
    strong: { fontWeight: t.font.weights.semibold, color: t.color.text },
    em: { fontStyle: 'italic' },

    a: {
      color: t.color.accent,
      textDecoration: 'underline',
      textDecorationColor: t.color.accentBorder,
      textUnderlineOffset: '3px',
      '&:hover': { textDecorationColor: t.color.accent },
      '&:focus-visible': { outline: `2px solid ${t.color.focus}`, outlineOffset: '2px', borderRadius: t.radius.sm },
    },

    'ul, ol': { margin: `0 0 ${t.space[4]}`, paddingLeft: t.space[6] },
    li: { marginBottom: t.space[2] },
    'li::marker': { color: t.color.textMuted },

    blockquote: {
      margin: `${t.space[5]} 0`,
      padding: `${t.space[1]} ${t.space[5]}`,
      borderLeft: `3px solid ${t.color.accentBorder}`,
      color: t.color.textMuted,
      fontStyle: 'italic',
      'p:last-child': { marginBottom: '0' },
    },

    code: {
      fontFamily: t.font.mono,
      fontSize: `calc(${t.font.sizes.sm} * 0.94)`,
      background: t.color.bgSunken,
      color: t.color.text,
      border: `1px solid ${t.color.border}`,
      borderRadius: t.radius.sm,
      padding: `0 ${t.space[1]}`,
      /* R3D-01: inline code in this corpus is long identifiers
       * (`_tool_manager._tools`, `traces/observations/sessions/scores`) —
       * at 492px wide with whiteSpace:pre it overflowed 320px viewports.
       * Block `pre code` below keeps pre semantics. */
      /* R7B-8: overflow-wrap break-word fallback before anywhere -- modern engines
     * preferentially lay out content with `anywhere`; on Firefox \n\n     * ≤120 / Safari ≤15.3 the value is invalid and dropped, reintroducing unconstrained overflow for
     * long tokens in headings and prose. */
     'overflow-wrap': 'break-word',
     overflowWrap: 'anywhere',
    },
    'pre': {
      margin: `${t.space[5]} 0`,
      padding: t.space[4],
      background: t.color.bgSunken,
      border: `1px solid ${t.color.border}`,
      borderRadius: t.radius.md,
      overflowX: 'auto',
      overflowY: 'auto',
      maxHeight: '80vh',
    },
    'pre code': {
      display: 'block',
      background: 'transparent',
      border: 'none',
      padding: '0',
      fontSize: t.font.sizes.sm,
      lineHeight: t.font.leading.snug,
      whiteSpace: 'pre',
    },

    'table': {
      width: '100%',
      margin: `${t.space[5]} 0`,
      borderCollapse: 'collapse',
      display: 'block',
      overflowX: 'auto',
      fontSize: t.font.sizes.sm,
    },
    'th, td': {
      border: `1px solid ${t.color.border}`,
      padding: `${t.space[2]} ${t.space[3]}`,
      textAlign: 'left',
    },
    th: { background: t.color.bgSunken, fontWeight: t.font.weights.semibold, color: t.color.text },
    'tbody tr:nth-child(even)': { background: t.color.bgSunken },

    img: {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: t.radius.md,
      border: `1px solid ${t.color.border}`,
      display: 'block',
      margin: `${t.space[5]} auto`,
    },

    hr: {
      border: 'none',
      borderTop: `1px solid ${t.color.border}`,
      margin: `${t.space[7]} 0`,
    },
  });
}

export interface ProseProps {
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export function Prose({ className, children, ...rest }: ProseProps): React.ReactNode {
  const theme = useTheme() as Tokens;
  const cls = proseCss(theme);
  return (
    <div
      className={className ? `${cls} ${className}` : cls}
      data-prose="true"
      data-testid={rest['data-testid'] ?? 'prose'}
    >
      {children}
    </div>
  );
}

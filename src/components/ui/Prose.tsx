import { css, useTheme } from '@emotion/react';
import type { Tokens } from 'app/theme/tokens';

/**
 * Prose — styles *generated markdown HTML* (h2/h3 anchors, lists, blockquote,
 * code, pre>code, tables, images, hr) at a ~68ch reading measure.
 *
 * This is the long-form voice of the site: a serif at a comfortable reading
 * size, set like a technical report. Tables are ruled the way a typeset paper
 * rules them (a heavy rule above and below, a thin one under the header, no
 * vertical lines and no stripes), figures sit square, links are ink with the
 * highlighter underline.
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
    fontFamily: t.font.serif,
    fontSize: t.font.sizes.lg,
    lineHeight: t.font.leading.normal,
    color: t.color.text,

    '> *:first-of-type': { marginTop: '0' },
    '> *:last-child': { marginBottom: '0' },

    'h2, h3, h4': {
      fontFamily: t.font.serif,
      fontWeight: t.font.weights.semibold,
      lineHeight: t.font.leading.snug,
      letterSpacing: t.font.tracking.tight,
      color: t.color.text,
      scrollMarginTop: t.layout.navHeight,
    },
    /* A thin rule opens each major part, so a long post scans as a document
     * with sections rather than one column of text. */
    h2: {
      fontSize: t.font.sizes['2xl'],
      margin: `${t.space[8]} 0 ${t.space[4]}`,
      paddingTop: t.space[5],
      borderTop: `1px solid ${t.color.border}`,
    },
    h3: { fontSize: t.font.sizes.xl, margin: `${t.space[7]} 0 ${t.space[3]}` },
    h4: { fontSize: t.font.sizes.lg, margin: `${t.space[6]} 0 ${t.space[2]}` },

    'h2 .anchor, h3 .anchor, h4 .anchor': {
      marginLeft: t.space[2],
      color: t.color.textSubtle,
      textDecoration: 'none',
      opacity: '0',
      fontWeight: t.font.weights.normal,
    },
    'h2:hover .anchor, h3:hover .anchor, h4:hover .anchor, .anchor:focus-visible': {
      opacity: '1',
    },
    '.anchor:focus-visible': { outline: `2px solid ${t.color.focus}`, outlineOffset: '2px', borderRadius: t.radius.sm },

    p: { margin: `0 0 ${t.space[5]}` },
    'p, li': { maxWidth: 'var(--measure)' },
    strong: { fontWeight: t.font.weights.semibold, color: t.color.text },
    em: { fontStyle: 'italic' },

    a: {
      color: t.color.accent,
      textDecorationLine: 'underline',
      textDecorationColor: t.color.accentBorder,
      textDecorationThickness: '2px',
      textUnderlineOffset: '0.2em',
      borderRadius: t.radius.sm,
      '&:hover': {
        background: t.color.mark,
        color: t.color.markInk,
        textDecorationColor: 'transparent',
        boxShadow: `-0.14em 0 0 ${t.color.mark}, 0.14em 0 0 ${t.color.mark}`,
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
      },
      '&:focus-visible': { outline: `2px solid ${t.color.focus}`, outlineOffset: '2px' },
    },

    'ul, ol': { margin: `0 0 ${t.space[5]}`, paddingLeft: t.space[5] },
    li: { marginBottom: t.space[2] },
    'li::marker': { color: t.color.textSubtle },

    blockquote: {
      margin: `${t.space[6]} 0`,
      padding: `${t.space[1]} 0 ${t.space[1]} ${t.space[5]}`,
      borderLeft: `3px solid ${t.color.mark}`,
      color: t.color.text,
      fontStyle: 'italic',
      'p:last-child': { marginBottom: '0' },
    },

    code: {
      fontFamily: t.font.mono,
      fontSize: '0.84em',
      background: t.color.bgSunken,
      color: t.color.text,
      borderRadius: t.radius.sm,
      padding: `0.08em ${t.space[1]}`,
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
    pre: {
      margin: `${t.space[6]} 0`,
      padding: `${t.space[4]} ${t.space[5]}`,
      background: t.color.bgSunken,
      borderLeft: `3px solid ${t.color.borderStrong}`,
      borderRadius: '0',
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
      lineHeight: t.font.leading.normal,
      whiteSpace: 'pre',
    },

    /* Report-style table: heavy rule above and below, thin rule under the
     * header, hairlines between rows, no vertical lines, aligned digits. */
    table: {
      width: '100%',
      margin: `${t.space[6]} 0`,
      borderCollapse: 'collapse',
      display: 'block',
      overflowX: 'auto',
      fontFamily: t.font.sans,
      fontSize: t.font.sizes.sm,
      lineHeight: t.font.leading.snug,
      fontVariantNumeric: 'tabular-nums',
      borderTop: `2px solid ${t.color.rule}`,
      borderBottom: `2px solid ${t.color.rule}`,
    },
    'th, td': {
      padding: `${t.space[2]} ${t.space[5]} ${t.space[2]} 0`,
      textAlign: 'left',
      verticalAlign: 'top',
      borderBottom: `1px solid ${t.color.border}`,
    },
    th: {
      fontWeight: t.font.weights.semibold,
      color: t.color.text,
      borderBottom: `1px solid ${t.color.rule}`,
      verticalAlign: 'bottom',
    },
    'tbody tr:last-child td': { borderBottom: 'none' },

    img: {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: '0',
      border: `1px solid ${t.color.border}`,
      display: 'block',
      margin: `${t.space[6]} auto`,
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

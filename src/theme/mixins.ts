/**
 * Shared style recipes — the handful of looks the site repeats, written once.
 *
 * Each returns CSS text, so it drops into a styled template
 * (`${(p) => inkLink(p.theme)}`) or a `css` template alike. Like every
 * component, they read only tokens.
 *
 * The interaction language, in one place:
 *  - a link at rest is ink with a highlighter underline (`inkLink`), or plain
 *    ink when it is a title that is obviously a link (`titleLink`);
 *  - hovering either one highlights it, the way a marker would (`markerHover`).
 *
 * Parameters are typed `ThemeArg` rather than `Tokens` because the vendored
 * styled() hands interpolations an untyped theme record; `tokens()` narrows it
 * once, here, instead of at every call site.
 */
import type { Tokens } from './tokens';

/** What a styled interpolation's `p.theme` is, or a typed `Tokens` object. */
export type ThemeArg = Tokens | Record<string, unknown>;

function tokens(theme: ThemeArg): Tokens {
  return theme as Tokens;
}

/**
 * The highlighter stroke. The side shadows widen the stroke past the letters
 * without changing layout, and `clone` repeats it on every line of a link that
 * wraps.
 */
export function markerHover(theme: ThemeArg): string {
  const t = tokens(theme);
  return `
    background: ${t.color.mark};
    color: ${t.color.markInk};
    text-decoration-color: transparent;
    box-shadow: -0.14em 0 0 ${t.color.mark}, 0.14em 0 0 ${t.color.mark};
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  `;
}

/** The underline every text link carries at rest. */
export function markerUnderline(theme: ThemeArg): string {
  const t = tokens(theme);
  return `
    text-decoration-line: underline;
    text-decoration-color: ${t.color.accentBorder};
    text-decoration-thickness: 2px;
    text-underline-offset: 0.2em;
  `;
}

function focusRing(t: Tokens, offset = '2px'): string {
  return `
    &:focus-visible {
      outline: 2px solid ${t.color.focus};
      outline-offset: ${offset};
    }
  `;
}

/** A text link: ink, highlighter underline, highlighted on hover. */
export function inkLink(theme: ThemeArg): string {
  const t = tokens(theme);
  return `
    color: ${t.color.accent};
    ${markerUnderline(t)}
    border-radius: ${t.radius.sm};
    &:hover { ${markerHover(t)} }
    ${focusRing(t)}
  `;
}

/** A heading that links to its page: no underline at rest (the title is the
 * affordance), highlighted on hover. */
export function titleLink(theme: ThemeArg): string {
  const t = tokens(theme);
  return `
    color: ${t.color.text};
    text-decoration: none;
    border-radius: ${t.radius.sm};
    &:hover { ${markerHover(t)} }
    ${focusRing(t, '3px')}
  `;
}

/**
 * A standalone "go there" link ("View case study →", "All 28 posts →"): ink,
 * semibold, highlighter underline. With a mouse it is plain inline text, so
 * the hover stroke hugs the words; on phone widths it becomes a 44px-tall
 * target (WCAG 2.5.5), and the stroke is left to devices that really hover.
 */
export function actionLink(theme: ThemeArg): string {
  const t = tokens(theme);
  return `
    display: inline;
    padding-block: 0.1em;
    font-weight: ${t.font.weights.semibold};
    color: ${t.color.accent};
    ${markerUnderline(t)}
    border-radius: ${t.radius.sm};
    ${focusRing(t)}
    @media (hover: hover) {
      &:hover { ${markerHover(t)} }
    }
    @media (max-width: ${t.breakpoint.md}) {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }
  `;
}

/**
 * A square, flat filter control (a tag you can press). `active` is the
 * selected state: a block of ink. Hover on an unselected one is the
 * highlighter. 44px tall on phone widths.
 */
export function filterChip(theme: ThemeArg, active: boolean): string {
  const t = tokens(theme);
  return `
    display: inline-flex;
    align-items: center;
    gap: ${t.space[2]};
    min-height: calc(${t.space[6]} + ${t.space[1]});
    padding: ${t.space[1]} ${t.space[3]};
    font-family: ${t.font.sans};
    font-size: ${t.font.sizes.sm};
    font-weight: ${active ? t.font.weights.semibold : t.font.weights.normal};
    line-height: ${t.font.leading.none};
    border-radius: ${t.radius.sm};
    border: 1px solid ${active ? t.color.accent : t.color.borderStrong};
    background: ${active ? t.color.accent : 'transparent'};
    color: ${active ? t.color.bg : t.color.text};
    cursor: pointer;
    ${
      active
        ? ''
        : `&:hover { background: ${t.color.mark}; color: ${t.color.markInk}; border-color: ${t.color.markInk}; }`
    }
    ${focusRing(t)}
    @media (max-width: ${t.breakpoint.md}) {
      min-height: 44px;
    }
  `;
}

/** A small label in the interface voice: what replaces letter-spaced
 * capitals. Sentence case, sans, semibold. */
export function label(theme: ThemeArg): string {
  const t = tokens(theme);
  return `
    font-family: ${t.font.sans};
    font-size: ${t.font.sizes.sm};
    font-weight: ${t.font.weights.semibold};
    line-height: ${t.font.leading.snug};
    letter-spacing: ${t.font.tracking.normal};
    text-transform: none;
  `;
}

/** Data: dates, versions, counts, measurements. Mono with aligned digits. */
export function dataText(theme: ThemeArg): string {
  const t = tokens(theme);
  return `
    font-family: ${t.font.mono};
    font-variant-numeric: tabular-nums;
    letter-spacing: ${t.font.tracking.normal};
    text-transform: none;
  `;
}

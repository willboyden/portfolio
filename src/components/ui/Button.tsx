import { css, useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import type { Tokens } from 'app/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Spinner } from './Spinner';

/**
 * Button — primary action control, polymorphic over button / a / router Link.
 *
 * Look: ink on paper, nearly square. A primary button is a block of ink, a
 * secondary one is an ink outline, a ghost one is a text link (ink with the
 * highlighter underline). Hovering any of them fills it with the highlighter.
 *
 * Contrast (gated in src/theme/contrast.test.ts):
 *  - primary text is color.bg on color.accent, the same pair in both themes;
 *  - hover text is color.markInk on color.mark;
 *  - ghost / secondary text is ink on the page.
 *
 * Polymorphism note: the vendored styled `as` drops non-DOM props (`to`) from
 * component targets, which would break the router Link. So component targets
 * render directly with a css() class built from the SAME buttonStyles() object
 * — identical rule text, identical hash, no styled() in the middle.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const heights = (t: Tokens): Record<ButtonSize, string> => ({
  /* token sums that land on >=44px hit areas: 44 / 48 / 56 */
  sm: `calc(${t.space[5]} + ${t.space[4]} + ${t.space[1]})`,
  md: `calc(${t.space[6]} + ${t.space[4]})`,
  lg: `calc(${t.space[6]} + ${t.space[5]})`,
});

const iconSize: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

function buttonStyles(theme: Tokens, variant: ButtonVariant, size: ButtonSize) {
  const t = theme;
  /* One hover for every variant: the highlighter. The border goes to markInk
   * so the shape keeps a 3:1 edge on paper, where the fill alone is too light. */
  const marked = { background: t.color.mark, color: t.color.markInk, borderColor: t.color.markInk };
  const tone =
    variant === 'primary'
      ? {
          background: t.color.accent,
          color: t.color.bg,
          borderColor: t.color.accent,
          hover: marked,
        }
      : variant === 'secondary'
        ? {
            background: 'transparent',
            color: t.color.text,
            borderColor: t.color.rule,
            hover: marked,
          }
        : variant === 'danger'
          ? {
              background: t.color.danger,
              color: t.color.bgElevated,
              borderColor: t.color.danger,
              hover: { background: t.color.bgElevated, color: t.color.danger, borderColor: t.color.danger },
            }
          : {
              background: 'transparent',
              color: t.color.accent,
              borderColor: 'transparent',
              hover: marked,
            };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space[2],
    boxSizing: 'border-box' as const,
    minHeight: heights(t)[size],
    paddingInline:
      variant === 'ghost' ? t.space[2] : size === 'sm' ? t.space[3] : size === 'lg' ? t.space[6] : t.space[5],
    fontFamily: t.font.sans,
    fontSize: size === 'sm' ? t.font.sizes.sm : t.font.sizes.md,
    fontWeight: t.font.weights.semibold,
    lineHeight: t.font.leading.none,
    letterSpacing: t.font.tracking.normal,
    /* A ghost button has no box, so it carries the link underline instead. */
    textDecoration: variant === 'ghost' ? 'underline' : 'none',
    textDecorationColor: variant === 'ghost' ? t.color.accentBorder : 'transparent',
    textDecorationThickness: '2px',
    textUnderlineOffset: '0.3em',
    cursor: 'pointer',
    /* R7B-6: WebKit required the -webkit- prefix until Safari 16.4 — without
     * it the declaration is dropped and button labels stay long-press-
     * selectable on iOS (the vendored emotion does no autoprefixing). */
    WebkitUserSelect: 'none' as const,
    userSelect: 'none' as const,
    borderRadius: t.radius.md,
    border: `1px solid ${tone.borderColor}`,
    background: tone.background,
    color: tone.color,
    transition: `background ${t.motion.fast} ${t.motion.ease}, color ${t.motion.fast} ${t.motion.ease}, border-color ${t.motion.fast} ${t.motion.ease}, box-shadow ${t.motion.base} ${t.motion.ease}`,
    '&:hover': { ...tone.hover, textDecorationColor: 'transparent' },
    '&:active': { transform: 'translateY(1px)' },
    '&:focus-visible': {
      outline: `2px solid ${t.color.focus}`,
      outlineOffset: '2px',
    },
    '&[disabled], &[aria-disabled="true"]': {
      cursor: 'not-allowed',
      background: t.color.bgSunken,
      color: t.color.textSubtle,
      borderColor: t.color.border,
      boxShadow: 'none',
      transform: 'none',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:active': { transform: 'none' },
    },
  };
}

const Base = styled.button<{ $variant: ButtonVariant; $size: ButtonSize }>((p) =>
  buttonStyles(p.theme as Tokens, p.$variant, p.$size),
);

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Element or component to render (e.g. 'a', or the router Link). */
  as?: 'button' | 'a' | 'submit' | (string & {}) | React.ComponentType<Record<string, unknown>>;
  href?: string;
  iconLeft?: IconName | ReactNode;
  iconRight?: IconName | ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
  'data-testid'?: string;
  [key: string]: unknown;
}

function renderSlot(slot: IconName | ReactNode | undefined, n: number): ReactNode {
  if (slot === undefined || slot === null) return null;
  if (typeof slot === 'string') return <Icon name={slot as IconName} size={n} />;
  return slot;
}

export function Button({
  variant = 'primary',
  size = 'md',
  as,
  href,
  iconLeft,
  iconRight,
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps): ReactNode {
  const theme = useTheme() as Tokens;
  const inactive = disabled || loading;
  const target = as ?? (href ? 'a' : 'button');
  const isNative = target === 'button' || (typeof target === 'string' && target !== '');

  const label = (
    <>
      {loading ? <Spinner size={iconSize[size]} label="Loading" /> : renderSlot(iconLeft, iconSize[size])}
      {children !== undefined && children !== null && <span data-slot="label">{children}</span>}
      {loading ? null : renderSlot(iconRight, iconSize[size])}
    </>
  );

  const common = {
    'data-testid': (rest['data-testid'] as string | undefined) ?? 'button',
    'data-variant': variant,
    'data-size': size,
    'data-loading': loading ? 'true' : 'false',
    'aria-busy': loading ? true : undefined,
    'aria-disabled': !isNative && inactive ? true : undefined,
    'aria-label': rest['aria-label'] as string | undefined,
    onClick: inactive
      ? (event: { preventDefault: () => void }) => event.preventDefault()
      : (rest.onClick as ((event: { preventDefault: () => void }) => void) | undefined),
  };

  /* Component targets (router Link): styled()'s `as` would drop their custom
   * props, so render directly with the equivalent css() class. */
  if (!isNative && typeof target !== 'string') {
    const Cmp = target as React.ComponentType<Record<string, unknown>>;
    const cls = css(buttonStyles(theme, variant, size));
    const passThrough = { ...rest };
    delete passThrough['data-testid'];
    delete passThrough['aria-label'];
    delete passThrough.onClick;
    return (
      <Cmp
        {...passThrough}
        className={className ? `${cls} ${className}` : cls}
        aria-label={common['aria-label']}
        aria-busy={common['aria-busy']}
        aria-disabled={common['aria-disabled']}
        data-testid={common['data-testid']}
        data-variant={common['data-variant']}
        data-size={common['data-size']}
        data-loading={common['data-loading']}
        onClick={common.onClick}
      >
        {label}
      </Cmp>
    );
  }

  const element = target === 'submit' ? 'button' : (target as 'button' | 'a');
  return (
    <Base
      {...Object.fromEntries(Object.entries(rest).filter(([key]) => key !== 'data-testid' && key !== 'aria-label'))}
      as={element}
      href={href}
      $variant={variant}
      $size={size}
      type={element === 'button' ? (target === 'submit' ? 'submit' : type) : undefined}
      disabled={element === 'button' && inactive ? true : undefined}
      className={className}
      aria-busy={common['aria-busy']}
      aria-disabled={common['aria-disabled']}
      aria-label={common['aria-label']}
      data-testid={common['data-testid']}
      data-variant={common['data-variant']}
      data-size={common['data-size']}
      data-loading={common['data-loading']}
      onClick={common.onClick}
    >
      {label}
    </Base>
  );
}

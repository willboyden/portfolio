import styled from '@emotion/styled';

/**
 * Spinner — determinate-looking loading indicator.
 *
 * The @keyframes rule is nested INSIDE the styled component (verified to
 * flatten correctly) so it emits without a module-scope registration order
 * dependency, and `prefers-reduced-motion` swaps the rotation for a gentle
 * opacity pulse (still communicates "busy" without spinning).
 */
const Ring = styled.span<{ $size: number }>`
  display: inline-block;
  flex: none;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: ${(p) => p.theme.radius.full};
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-right-color: transparent;
  animation: ui-spin 720ms ${(p) => p.theme.motion.ease} infinite;

  @keyframes ui-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: ui-pulse 1200ms ${(p) => p.theme.motion.ease} infinite;
    border-top-color: currentColor;
    border-right-color: currentColor;
    opacity: 0.55;
  }

  @keyframes ui-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 0.9;
    }
  }
`;

export interface SpinnerProps {
  /** Square pixel size (default 16). */
  size?: number;
  /** Screen-reader text; defaults to "Loading". */
  label?: string;
  className?: string;
  'data-testid'?: string;
}

export function Spinner({ size = 16, label = 'Loading', className, ...rest }: SpinnerProps): React.ReactNode {
  return (
    <>
      <Ring
        $size={size}
        className={className}
        role="status"
        aria-live="polite"
        aria-label={label}
        data-testid={rest['data-testid'] ?? 'spinner'}
      />
    </>
  );
}

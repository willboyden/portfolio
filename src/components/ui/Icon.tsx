import { css } from '@emotion/react';

/**
 * Icon — a hand-written inline-SVG set. No icon packages are installable here,
 * and inline SVG means zero network requests and full `currentColor` theming.
 *
 * Accessibility contract (pinned):
 *  - `label` present  => role="img" + aria-label="…" (announced)
 *  - `label` absent   => aria-hidden="true" + focusable="false" (decorative)
 */
export type IconName =
  | 'arrow-right'
  | 'arrow-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'github'
  | 'linkedin'
  | 'mail'
  | 'rss'
  | 'external-link'
  | 'play'
  | 'clock'
  | 'search'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'close'
  | 'download'
  | 'calendar'
  | 'check';

/** 24x24 grid. Strokes use currentColor via the svg's `stroke` attr. */
const PATHS: Record<IconName, React.ReactNode> = {
  'arrow-right': <path d="M4 12h15m0 0-6-6m6 6-6 6" />,
  'arrow-up': <path d="M12 20V5m0 0-6 6m6-6 6 6" />,
  'chevron-left': <path d="m15 5-7 7 7 7" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  github: (
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  ),
  linkedin: (
    <>
      <path d="M5 9v10M5 4.5v.01M10 19v-5.5a3 3 0 0 1 6 0V19" />
      <path d="M10 9v10" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  rss: (
    <>
      <path d="M5 19a1 1 0 1 0 0-.01M5 12a7 7 0 0 1 7 7M5 5a14 14 0 0 1 14 14" />
      <circle cx="5" cy="19" r="1" />
    </>
  ),
  'external-link': (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5-11-6.5Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5m0 14v2.5M2.5 12H5m14 0h2.5M4.9 4.9 6.7 6.7m10.6 10.6 1.8 1.8m0-14.2-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  download: <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M4 19.5h16" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3.5V6m8-2.5V6" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5L19.5 7" />,
};

export interface IconProps {
  name: IconName;
  /** Square pixel size (default 20). */
  size?: number;
  /** Present => announced image. Absent => decorative (aria-hidden). */
  label?: string;
  className?: string;
  'data-testid'?: string;
}

export function Icon({ name, size = 20, label, className, ...rest }: IconProps): React.ReactNode {
  const cls = css({
    display: 'inline-block',
    flex: 'none',
    verticalAlign: 'middle',
    color: 'inherit',
    width: `${size}px`,
    height: `${size}px`,
    /* Brand marks (github/linkedin) are filled; everything else is stroked.
     * Both take currentColor so the icon follows the surrounding text token. */
    fill: name === 'github' || name === 'play' || name === 'moon' ? 'currentColor' : 'none',
    stroke: name === 'github' || name === 'play' || name === 'moon' ? 'none' : 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  return (
    <svg
      viewBox="0 0 24 24"
      className={`${cls}${className ? ` ${className}` : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-icon={name}
      data-testid={rest['data-testid'] ?? `icon-${name}`}
    >
      {PATHS[name]}
    </svg>
  );
}

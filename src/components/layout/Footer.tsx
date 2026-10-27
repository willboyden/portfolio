/**
 * Footer — contact/nav block, RSS, back-to-top, social list, copyright.
 *
 * PLACEHOLDER POLICY (CONTRACT §6: no fabricated content)
 * No real social profile URL was supplied anywhere in the project brief, so
 * nothing here points at a plausible-but-invented `github.com/alexrivera`.
 * Entries whose `url` is empty render as inert labelled text carrying
 * `data-placeholder="true"` plus a real HTML comment
 * (`<!-- DRAFT: replace handle -->`) that greps cleanly. Filling one in means
 * setting `url` on the entry — nothing else changes, and the `<a>` then gets
 * `target="_blank" rel="noreferrer noopener"` automatically.
 */

import type { ReactNode } from 'react';
import { Link } from '@portfolio/router';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { withBase } from 'app/lib/seo';
import { availableNavItems, normalizePath } from './Nav';
import { useThemeTokens } from './ThemePreference';

export interface SocialLink {
  label: string;
  /** Empty string = not supplied yet → renders as a marked placeholder. */
  url: string;
  handle?: string;
}

/**
 * The owner's real profiles (the LinkedIn URL is the one his GitHub profile
 * lists). No email is published — the owner's choice, 2026-10-24.
 */
export const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/william-boyden-88a324b6/' },
  { label: 'GitHub', url: 'https://github.com/willboyden', handle: 'willboyden' },
];

export const RSS_HREF = withBase('/rss.xml');

const Shell = styled.footer`
  border-top: 1px solid ${(p) => p.theme.color.border};
  background: ${(p) => p.theme.color.bgSunken};
  color: ${(p) => p.theme.color.textMuted};
  font-family: ${(p) => p.theme.font.sans};
  /* R2-D V3: no margin-top — Layout Main's padding-bottom is the single gap.
   * Both stacked = a 224px dead band above the footer on short pages. */
`;

/* The link groups get two thirds of the row: at 1.4fr / 1fr they were squeezed
 * into ~40%, so "Elsewhere" wrapped under "Sitemap" and "RSS feed" broke. */
const Inner = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: ${(p) => p.theme.space[6]};
  max-width: ${(p) => p.theme.layout.maxWidth};
  margin: 0 auto;
  padding: ${(p) => p.theme.space[8]} ${(p) => p.theme.layout.gutter}
    ${(p) => p.theme.space[6]};

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: minmax(0, 1fr);
    gap: ${(p) => p.theme.space[5]};
    padding-top: ${(p) => p.theme.space[6]};
  }
`;

const Identity = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
`;

const Name = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const Role = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
  max-width: ${(p) => p.theme.layout.maxWidthProse};
`;

/* Desktop: Sitemap (its own two columns) | More | Elsewhere on one row.
 * Phone: Sitemap across the full width, More and Elsewhere side by side. */
const Column = styled.nav`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${(p) => p.theme.space[4]} ${(p) => p.theme.space[5]};
  }
`;

const WideGroup = styled.div`
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    grid-column: 1 / -1;
  }
`;

/* Lists carry no bullets or indent; each link keeps its 44px touch target,
 * so rows sit flush (gap 0) and the sitemap splits into two columns. */
const LinkList = styled.ul`
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const SitemapList = styled(LinkList)`
  grid-template-columns: repeat(2, minmax(0, max-content));
  column-gap: ${(p) => p.theme.space[6]};
`;

const Heading = styled.h2`
  margin: 0 0 ${(p) => p.theme.space[2]};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const LinkLine = styled.li`
  margin: 0;
`;

const BottomRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[3]};
  max-width: ${(p) => p.theme.layout.maxWidth};
  margin: 0 auto;
  /* R3D-05: home-indicator clearance on standalone mobile (viewport-fit=cover). */
  padding: ${(p) => p.theme.space[4]} ${(p) => p.theme.layout.gutter}
    calc(${(p) => p.theme.space[6]} + env(safe-area-inset-bottom));
  border-top: 1px solid ${(p) => p.theme.color.border};
`;

const Copy = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

/* R7A-6: was a <button onClick={toTop}> — dead without JS. Now a real anchor
 * to #main that works with and without JS. Same visual recipe as the old
 * button, and the 44px min-height is load-bearing (touch-target e2e gate). */
const TopLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]} ${(p) => p.theme.space[3]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: transparent;
  color: ${(p) => p.theme.color.textMuted};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  text-decoration: none;

  &:hover {
    color: ${(p) => p.theme.color.text};
    background: ${(p) => p.theme.color.surfaceHover};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** Four-digit year, guarded: a bad clock must not print `NaN`. */
export function currentYear(now: Date = new Date()): number {
  const year = now.getFullYear();
  return Number.isFinite(year) && year > 1970 ? year : 2026;
}

export function copyrightLine(name: string, year: number): string {
  return `© ${year} ${name}. All rights reserved.`;
}

export function linkClass(tokens: ReturnType<typeof useThemeTokens>): string {
  return css`
    display: inline-flex;
    align-items: center;
    gap: ${tokens.space[2]};
    min-height: 44px;
    font-size: ${tokens.font.sizes.sm};
    font-weight: ${tokens.font.weights.medium};
    color: ${tokens.color.textMuted};
    text-decoration: none;
    border-radius: ${tokens.radius.sm};
    transition: color ${tokens.motion.fast} ${tokens.motion.ease};

    &:hover {
      color: ${tokens.color.accent};
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    &:focus-visible {
      outline: 2px solid ${tokens.color.focus};
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `;
}

export function placeholderClass(tokens: ReturnType<typeof useThemeTokens>): string {
  return css`
    display: inline-flex;
    align-items: center;
    gap: ${tokens.space[2]};
    min-height: 44px;
    font-family: ${tokens.font.mono};
    font-size: ${tokens.font.sizes.xs};
    color: ${tokens.color.textSubtle};
  `;
}

export interface FooterProps {
  name?: string;
  role?: string;
  /** Injectable for deterministic tests; defaults to now. */
  now?: Date;
  social?: readonly SocialLink[];
  /** Contact address. Empty (the default) renders a DRAFT-marked slot — an
   * invented mailbox would be exactly the fabricated content CONTRACT §6 bans. */
  email?: string;
}

export function Footer({
  name = 'William Boyden',
  role = 'Technical consultant — LLM systems, data platforms, full-stack engineering',
  now,
  social = SOCIAL_LINKS,
  email = '',
}: FooterProps): ReactNode {
  const tokens = useThemeTokens();
  const year = currentYear(now ?? new Date());
  const classes = linkClass(tokens);

  /* R6-B: configured socials only. Unconfigured entries are DRAFT comment
   * markers (owner gate); rendering their <li> produced a visible empty
   * bullet under "Elsewhere" on every page. When all entries are
   * unconfigured, the whole column skips cleanly. */
  const configuredSocials = social.filter((entry) => entry.url !== '');

  return (
    <Shell data-testid="site-footer">
      <Inner>
        <Identity>
          <Name>{name}</Name>
          <Role>{role}</Role>
        </Identity>

        <Column aria-label="Footer" data-testid="footer-nav">
          <WideGroup>
            <Heading id="footer-sites-heading">Sitemap</Heading>
            <SitemapList role="list" aria-labelledby="footer-sites-heading" data-testid="footer-sitemap">
              {availableNavItems().map((item) => (
                <LinkLine key={item.to}>
                  <Link
                    to={normalizePath(item.to)}
                    className={classes}
                    data-testid={`footer-link-${item.label.toLowerCase()}`}
                  >
                    {item.label}
                  </Link>
                </LinkLine>
              ))}
            </SitemapList>
          </WideGroup>

          <div>
            <Heading id="footer-more-heading">More</Heading>
            <LinkList role="list" aria-labelledby="footer-more-heading" data-testid="footer-more">
              <LinkLine>
                <a
                  href={RSS_HREF}
                  type="application/rss+xml"
                  className={classes}
                  data-testid="footer-rss"
                >
                  RSS feed
                </a>
              </LinkLine>
              <LinkLine>
                <a href={withBase('/sitemap.xml')} className={classes} data-testid="footer-sitemap-link">
                  Sitemap
                </a>
              </LinkLine>
              {email && (
                <LinkLine>
                  <a
                    href={`mailto:${email}`}
                    className={classes}
                    data-testid="footer-email"
                  >
                    Email
                  </a>
                </LinkLine>
              )}
            </LinkList>
          </div>

          {configuredSocials.length > 0 && (
            <div>
              <Heading id="footer-social-heading">Elsewhere</Heading>
              <LinkList role="list" aria-labelledby="footer-social-heading" data-testid="footer-social">
                {configuredSocials.map((entry) => (
                  <LinkLine key={entry.label}>
                    {/* R2-A A12: configured profiles render as real links;
                     * unconfigured ones never reach this list (filtered
                     * above), so no empty bullets and no "@your-handle". */}
                    <a
                      href={entry.url}
                      className={classes}
                      target="_blank"
                      rel="noreferrer noopener"
                      data-testid={`footer-social-${entry.label.toLowerCase()}`}
                    >
                      {entry.label}
                    </a>
                  </LinkLine>
                ))}
              </LinkList>
            </div>
          )}
        </Column>
      </Inner>

      <BottomRow>
        <Copy data-testid="footer-copyright">{copyrightLine(name, year)}</Copy>
        <TopLink href="#main" data-testid="back-to-top" aria-label="Back to top">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          Back to top
        </TopLink>
      </BottomRow>
    </Shell>
  );
}

/**
 * NotFound — the 404 that behaves like a host, not a wall.
 *
 * Renders in two contexts: the router's `*` fallback / prerendered /404 page
 * (via Outlet) AND as the in-page fallback when a detail slug misses. It must
 * therefore work standalone — no params, no data, no router assumptions
 * beyond Link (which RouterProvider always supplies).
 *
 * A11Y: the h1 states the situation plainly; recovery links are real anchors
 * in reading order so keyboard users escape in one Tab pass; the big glyph is
 * aria-hidden decoration.
 */
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { Link } from '@portfolio/router';
import { Button, Container, Heading } from 'app/components/ui';
import type { Tokens } from 'app/theme/tokens';
import { inkLink } from 'app/theme/mixins';

/* Router links take css() classes, never styled(Link) — the vendored styled()
 * prop allow-list drops `to` on component targets (see Nav.tsx / Home.tsx). */
const ROUTER_LINK = Link as unknown as 'a';

function textLinkClass(theme: Tokens): string {
  return css`
    ${inkLink(theme)}
  `;
}

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[5]};
  padding-block: ${(p) => `${p.theme.space[8]} ${p.theme.space[10]}`};
`;

/* The status code, set like every other reading on the site: a figure on the
 * highlighter. It is decoration (aria-hidden); the h1 carries the meaning. */
const Glyph = styled.p`
  margin: 0;
  padding: 0.04em 0.22em;
  background: ${(p) => p.theme.color.mark};
  color: ${(p) => p.theme.color.markInk};
  font-family: ${(p) => p.theme.font.sans};
  font-variant-numeric: tabular-nums;
  font-size: ${(p) => p.theme.font.sizes['4xl']};
  font-weight: ${(p) => p.theme.font.weights.normal};
  line-height: ${(p) => p.theme.font.leading.none};
  letter-spacing: -0.02em;
  /* R7B-6: -webkit- prefix for Safari ≤16.3 */
  -webkit-user-select: none;
  user-select: none;
`;

const Body = styled.p`
  margin: 0;
  max-width: 34em;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: 1.45;
  color: ${(p) => p.theme.color.text};
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[2]};
`;

const TextLinkList = styled.ul`
  list-style: none;
  margin: ${(p) => p.theme.space[4]} 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => `${p.theme.space[2]} ${p.theme.space[5]}`};
`;

const TextLinkItem = styled.li`
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-family: ${(p) => p.theme.font.sans};
  color: ${(p) => p.theme.color.textSubtle};
`;

export function NotFound(): React.ReactNode {
  const linkClass = textLinkClass(useTheme() as Tokens);
  return (
    <Container data-testid="not-found">
      <Shell>
        <Glyph aria-hidden="true">404</Glyph>
        <Heading level={1} data-testid="notfound-title" size="3xl">
          This page doesn&rsquo;t exist.
        </Heading>
        <Body>
          A 404 here usually means a link outlived a refactor or the address was mistyped. The three links below cover
          almost every path through this site.
        </Body>
        <CtaRow>
          <Button as={ROUTER_LINK} to="/" variant="primary" data-testid="notfound-cta-home">
            Back to home
          </Button>
          <Button as={ROUTER_LINK} to="/projects" variant="secondary" data-testid="notfound-cta-projects">
            Browse projects
          </Button>
          <Button as={ROUTER_LINK} to="/writing" variant="ghost" data-testid="notfound-cta-writing">
            Read the writing
          </Button>
        </CtaRow>
        <TextLinkList aria-label="Recovery links">
          <TextLinkItem>
            or jump straight to{' '}
            <Link to="/contact" className={linkClass}>
              contact
            </Link>
          </TextLinkItem>
          <TextLinkItem>
            ·{' '}
            <Link to="/about" className={linkClass}>
              about
            </Link>
          </TextLinkItem>
          <TextLinkItem>
            ·{' '}
            <Link to="/now" className={linkClass}>
              now
            </Link>
          </TextLinkItem>
        </TextLinkList>
      </Shell>
    </Container>
  );
}

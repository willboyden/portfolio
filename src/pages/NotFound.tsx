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

/* Router links take css() classes, never styled(Link) — the vendored styled()
 * prop allow-list drops `to` on component targets (see Nav.tsx / Home.tsx). */
const ROUTER_LINK = Link as unknown as 'a';

function textLinkClass(theme: Tokens): string {
  return css({
    color: theme.color.accent,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
  });
}

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[5]};
  padding-block: ${(p) => `${p.theme.space[10]} ${p.theme.space[12]}`};
`;

const Glyph = styled.p`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes['5xl']};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.none};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.accentSoft};
  /* The glyph is decoration; the h1 carries the meaning. Contrast rules are
   * for text that communicates — this color is deliberately background-grade. */
  user-select: none;
`;

const Body = styled.p`
  margin: 0;
  max-width: 56ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
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
  font-family: ${(p) => p.theme.font.mono};
  color: ${(p) => p.theme.color.textSubtle};
`;

export function NotFound(): React.ReactNode {
  const linkClass = textLinkClass(useTheme() as Tokens);
  return (
    <Container data-testid="not-found">
      <Shell>
        <Glyph aria-hidden="true">404</Glyph>
        <Heading level={1} data-testid="notfound-title" size="3xl">
          This page doesn&rsquo;t exist — yet.
        </Heading>
        <Body>
          A 404 here usually means one of three things: a project write-up is
          still in review, a link outlived a refactor, or you typed something
          creative. None of those are your problem to solve — the three links
          below cover almost every path through this site.
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
            or jump straight to <Link to="/contact" className={linkClass}>contact</Link>
          </TextLinkItem>
          <TextLinkItem>
            · <Link to="/about" className={linkClass}>about</Link>
          </TextLinkItem>
          <TextLinkItem>
            · <Link to="/now" className={linkClass}>now</Link>
          </TextLinkItem>
        </TextLinkList>
      </Shell>
    </Container>
  );
}

/**
 * Home — the landing page: a positioning hero, featured work, latest writing.
 *
 * DATA POSTURE: content.json starts EMPTY (the content pipeline fills it
 * later). Every block here is data-driven AND empty-safe: zero rows renders a
 * designed empty state, never a crash, never a hole in the layout.
 *
 * A11Y: exactly one h1 (the name lockup); every later heading is an h2 via
 * Section; featured cards keep a real link inside the title (the card is
 * `interactive` but is not the only affordance); CTAs are anchors, focus
 * rings come from Button.
 */
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { Link } from '@portfolio/router';
import { content, featuredProjects, postsByDate, type Project } from 'app/content';
import { formatDate } from 'app/lib/format';
import type { Tokens } from 'app/theme/tokens';
import {
  Button,
  Card,
  EmptyState,
  Heading,
  Section,
  Stack,
  Tag,
} from 'app/components/ui';

/* Button's component-target path is verified for the router Link (ui.test.tsx
 * §polymorphic `as`); Link's props are wider than ButtonProps' `as` record
 * type, so carry the same cast the UI tests use. Runtime stays a component,
 * which routes Button through its css()-class branch and keeps `to` intact. */
const ROUTER_LINK = Link as unknown as 'a';

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

const HeroShell = styled.section`
  position: relative;
  width: 100%;
  margin: 0 auto;
  max-width: ${(p) => p.theme.layout.maxWidth};
  padding-inline: ${(p) => p.theme.layout.gutter};
  padding-block: ${(p) => `${p.theme.space[9]} ${p.theme.space[8]}`};
`;

const Eyebrow = styled.p`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};
`;

/** Second line of the h1 lockup — the tagline reads as one heading, two voices. */
const Tagline = styled.span`
  display: block;
  margin-top: ${(p) => p.theme.space[3]};
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.normal};
  color: ${(p) => p.theme.color.textMuted};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    font-size: ${(p) => p.theme.font.sizes['2xl']};
  }
`;

const Lede = styled.p`
  margin: ${(p) => `${p.theme.space[5]} 0 0`};
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[6]};
`;

const HeroRule = styled.hr`
  margin: ${(p) => `${p.theme.space[8]} 0 0`};
  border: none;
  border-top: 1px solid ${(p) => p.theme.color.border};
`;

/* -------------------------------------------------------------------------- */
/* Featured projects                                                           */
/* -------------------------------------------------------------------------- */

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const MetaLine = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
`;

/* Router links use css() classes on plain <Link>, never styled(Link): the
 * vendored styled() prop allow-list silently drops `to` on component targets
 * (documented in src/components/layout/Nav.tsx and caught by these tests). */
function inlineLinkClass(theme: Tokens): string {
  return css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.space[1],
    minHeight: '44px',
    color: theme.color.accent,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
  });
}

function titleLinkClass(theme: Tokens): string {
  return css({
    color: theme.color.text,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    '&:hover': {
      color: theme.color.accent,
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '3px' },
  });
}

const CardSummary = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

const CardFooter = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[3]};
`;

/**
 * The three cards the landing page shows: featured first; if nothing is
 * flagged featured yet, the first three projects step in; if there are no
 * projects at all the caller renders EmptyState instead.
 */
function heroProjects(): Project[] {
  const featured = featuredProjects();
  return (featured.length > 0 ? featured : content.projects).slice(0, 3);
}

interface LinkClasses {
  /** Accent-colored inline link (case-study read-more, text links). */
  inline: string;
  /** Heading-styled link whose base colour matches card text. */
  title: string;
}

function ProjectCard({
  project,
  links,
}: {
  project: Project;
  links: LinkClasses;
}): React.ReactNode {
  const detailHref = `/projects/${project.slug}`;
  return (
    <Card interactive data-testid="featured-project">
      <MetaLine>
        <span>{project.status}</span>
        <span aria-hidden="true">·</span>
        <span>{project.period}</span>
      </MetaLine>
      <CardTitle data-testid="featured-project-title">
        <Link to={detailHref} className={links.title}>
          {project.title}
        </Link>
      </CardTitle>
      <CardSummary>{project.summary}</CardSummary>
      <Stack direction="row" wrap gap="2">
        {project.tags.slice(0, 4).map((tag) => (
          <Tag key={tag} size="sm" tone="outline">
            {tag}
          </Tag>
        ))}
      </Stack>
      <CardFooter>
        <Link to={detailHref} className={links.inline}>
          Read the case study <span aria-hidden="true">→</span>
        </Link>
      </CardFooter>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Latest writing                                                              */
/* -------------------------------------------------------------------------- */

const PostList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const PostRow = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[1]};
  padding-block: ${(p) => p.theme.space[4]};

  &:not(:last-child) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: calc(${(p) => p.theme.space[10]} + ${(p) => p.theme.space[4]}) minmax(0, 1fr) auto;
    align-items: baseline;
    gap: ${(p) => p.theme.space[4]};
  }
`;

const PostDate = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};
`;

const PostTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
`;

const PostMeta = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
  justify-self: start;

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    justify-self: end;
  }
`;

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function Home(): React.ReactNode {
  const theme = useTheme() as Tokens;
  const links: LinkClasses = { inline: inlineLinkClass(theme), title: titleLinkClass(theme) };
  const projects = heroProjects();
  const latestPosts = postsByDate().slice(0, 3);

  return (
    <>
      <HeroShell aria-labelledby="home-title" data-testid="home-hero">
        <Eyebrow>Technical consultant · Full-stack engineer · Data scientist</Eyebrow>
        <Heading level={1} id="home-title" size="5xl" data-testid="home-title">
          Alex Rivera
          <Tagline>
            I turn analytical work into software that survives production — and
            production realities back into the analysis.
          </Tagline>
        </Heading>
        <Lede>
          I advise teams on the hard middle of technical work: the point where a
          data-science result has to become a maintained service, a prototype
          has to become an architecture, and &ldquo;it runs on my machine&rdquo;
          has to become &ldquo;it runs, and we know why.&rdquo; Full-stack
          engineering is how I got there; a data-science grounding is why the
          advice holds up on both sides of that boundary.
        </Lede>
        <CtaRow>
          <Button as={ROUTER_LINK} to="/projects" variant="primary" size="lg" data-testid="home-cta-projects">
            View projects
          </Button>
          <Button as={ROUTER_LINK} to="/contact" variant="secondary" size="lg" data-testid="home-cta-contact">
            Get in touch
          </Button>
        </CtaRow>
        <HeroRule />
      </HeroShell>

      <Section
        id="featured"
        eyebrow="Selected work"
        title="Projects I would put in front of a client"
        description="A short, deliberate list: systems that shipped, the reasoning behind them, and the numbers that judged them."
      >
        {projects.length > 0 ? (
          <Grid data-testid="featured-grid">
            {projects.map((project) => (
              <ProjectCard key={project.slug} project={project} links={links} />
            ))}
          </Grid>
        ) : (
          <EmptyState
            icon="search"
            title="Case studies are being written up"
            description="Each engagement gets a public write-up once it is shipped and
            sanitized. In the meantime, the projects index is where they will
            land — and email is the fastest way to ask about work in progress."
            action={
              <Button as={ROUTER_LINK} to="/projects" variant="secondary" data-testid="home-featured-empty-cta">
                Browse all projects
              </Button>
            }
          />
        )}
      </Section>

      <Section
        id="writing"
        eyebrow="Latest writing"
        title="Notes from the work"
        description="Engineering and data-science notes — written for the teammate who has to maintain what I built."
      >
        {latestPosts.length > 0 ? (
          <PostList data-testid="latest-writing">
            {latestPosts.map((post) => (
              <PostRow key={post.slug}>
                <PostDate>{formatDate(post.date)}</PostDate>
                <PostTitle>
                  <Link to={`/writing/${post.slug}`} className={links.title}>
                    {post.title}
                  </Link>
                </PostTitle>
                <PostMeta>{post.readingMinutes} min read</PostMeta>
              </PostRow>
            ))}
          </PostList>
        ) : (
          <EmptyState
            icon="calendar"
            title="Writing starts soon"
            description="The first posts are drafted and in review. Subscribe via the RSS
            link in the footer to hear about them the day they publish."
            action={
              <Button as={ROUTER_LINK} to="/writing" variant="secondary" data-testid="home-writing-empty-cta">
                Go to the writing index
              </Button>
            }
          />
        )}
      </Section>
    </>
  );
}

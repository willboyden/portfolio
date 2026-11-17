/**
 * Home — the landing page: who this is, what was measured lately, the map of
 * the site, selected work, latest writing.
 *
 * The page leads with what is particular to this site: a statement of the
 * work in plain words, then real numbers. "Recently measured" shows the key
 * metric of the newest posts that have one (content: `keyMetric` in a post's
 * frontmatter), each linked to the post that says how it was measured, so the
 * first screen changes whenever a new measurement is published.
 *
 * DATA POSTURE: every block is data-driven AND empty-safe: zero rows renders a
 * designed empty state (or nothing, for the readings), never a crash, never a
 * hole in the layout.
 *
 * A11Y: exactly one h1 (the name); every later heading is an h2 via Section;
 * featured cards keep a real link inside the title (the card is `interactive`
 * but is not the only affordance); CTAs are anchors, focus rings come from
 * Button.
 */
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { Link } from '@portfolio/router';
import { content, featuredProjects, measuredPosts, postsByDate, type Post, type Project } from 'app/content';
import { SITE } from 'app/lib/seo';
import { KnowledgeGraphPreview } from 'app/pages/KnowledgeGraph';
import { formatIsoDate, formatPeriod, pluralize, splitMetric } from 'app/lib/format';
import { dataText, inkLink, markerHover, titleLink } from 'app/theme/mixins';
import type { Tokens } from 'app/theme/tokens';
import { Button, Card, EmptyState, Heading, Section, Stack, Tag } from 'app/components/ui';

/* Button's component-target path is verified for the router Link (ui.test.tsx
 * §polymorphic `as`); Link's props are wider than ButtonProps' `as` record
 * type, so carry the same cast the UI tests use. Runtime stays a component,
 * which routes Button through its css()-class branch and keeps `to` intact. */
const ROUTER_LINK = Link as unknown as 'a';

/**
 * The machines the lab runs on, as the AI Engineering pages name them
 * (content/ai-engineering/local-inference.md and tech-stack.md list the same
 * three). A margin note, not a claim of its own: change it there first.
 */
export const LAB_HARDWARE: readonly string[] = ['2× RTX PRO 6000 Blackwell', '4× DGX Spark (GB10)', '1× RTX 5090'];

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

/* On wide screens the hero uses the same two columns as every Section: a
 * narrow margin on the left (here: a note about the lab) and the content on
 * the right, so the name lines up with everything below it. The note comes
 * AFTER the content in the DOM, so on a phone it sits below the buttons and
 * the first screen is the name, the statement and the two actions. */
const HeroShell = styled.section`
  position: relative;
  width: 100%;
  /* R2-D V1/V8: no second max-width/padding-inline (Main owns the rail), and
   * no extra top padding on phones — Main's top gutter is the single one. */
  padding-block: 0 ${(p) => p.theme.space[7]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    padding-block: ${(p) => p.theme.space[5]} ${(p) => p.theme.space[8]};
  }

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    display: grid;
    grid-template-columns: ${(p) => p.theme.layout.marginCol} minmax(0, 1fr);
    column-gap: ${(p) => p.theme.space[7]};
    align-items: start;
  }
`;

const HeroMain = styled.div`
  min-width: 0;

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 2;
    grid-row: 1;
  }
`;

/** The statement: what the work is, in one sentence, in the reading voice. */
const Statement = styled.p`
  margin: ${(p) => p.theme.space[4]} 0 0;
  max-width: 34em;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: 1.4;
  color: ${(p) => p.theme.color.text};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    margin-top: ${(p) => p.theme.space[5]};
    font-size: ${(p) => p.theme.font.sizes['2xl']};
    line-height: 1.36;
  }

  /* Extreme mobile: at 320x568 the buttons must stay on the first screen
   * (e2e 04-responsive enforces it), so the statement steps down once more. */
  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    margin-top: ${(p) => p.theme.space[3]};
    font-size: ${(p) => p.theme.font.sizes.lg};
    line-height: 1.42;
  }
`;

const Lede = styled.p`
  margin: ${(p) => p.theme.space[4]} 0 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};

  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    margin-top: ${(p) => p.theme.space[3]};
    font-size: ${(p) => p.theme.font.sizes.md};
  }
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[6]};

  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    margin-top: ${(p) => p.theme.space[4]};
  }
`;

/** Margin note: the lab's machines, set like data. */
const LabNote = styled.aside`
  margin-top: ${(p) => p.theme.space[6]};
  padding-top: ${(p) => p.theme.space[3]};
  border-top: 1px solid ${(p) => p.theme.color.borderStrong};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 1;
    grid-row: 1;
    /* Sit on the baseline of the statement, under the name's cap height. */
    margin-top: ${(p) => p.theme.space[3]};
  }
`;

const LabNoteTitle = styled.p`
  margin: 0 0 ${(p) => p.theme.space[2]};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};
`;

const LabList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  line-height: 1.9;
`;

const HiringLine = styled.p`
  margin: ${(p) => `${p.theme.space[5]} 0 0`};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  font-size: ${(p) => p.theme.font.sizes.md};
  color: ${(p) => p.theme.color.textMuted};
`;

/* -------------------------------------------------------------------------- */
/* Recently measured                                                           */
/* -------------------------------------------------------------------------- */

const ReadingGrid = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: ${(p) => p.theme.space[5]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: ${(p) => p.theme.space[7]};
  }
`;

/* A hairline above every reading except the first row, which already sits
 * under the section's rule (one item wide on phones, two from md up). */
const Reading = styled.li`
  padding-top: ${(p) => p.theme.space[5]};
  border-top: 1px solid ${(p) => p.theme.color.border};

  &:first-of-type {
    padding-top: 0;
    border-top: none;
  }

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    &:nth-of-type(2) {
      padding-top: 0;
      border-top: none;
    }
  }
`;

/* The figure is the page's largest type after the name: a reading, not a
 * headline. Sans at regular weight, digits aligned. */
const Figure = styled.span`
  display: inline-block;
  font-family: ${(p) => p.theme.font.sans};
  font-variant-numeric: tabular-nums;
  font-size: clamp(2rem, 4.4vw, 2.75rem);
  font-weight: ${(p) => p.theme.font.weights.normal};
  line-height: 1.05;
  letter-spacing: -0.02em;
  white-space: nowrap;
  color: ${(p) => p.theme.color.text};
`;

const Unit = styled.span`
  margin-left: 0.3em;
  font-size: 0.45em;
  letter-spacing: 0;
  color: ${(p) => p.theme.color.textMuted};
`;

const ReadingLabel = styled.span`
  display: block;
  margin-top: ${(p) => p.theme.space[2]};
  max-width: 40ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.snug};
  color: ${(p) => p.theme.color.text};
`;

const ReadingSource = styled.p`
  margin: ${(p) => p.theme.space[2]} 0 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  column-gap: ${(p) => p.theme.space[3]};
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.snug};
  color: ${(p) => p.theme.color.textSubtle};
`;

const DateText = styled.time`
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
  white-space: nowrap;
`;

/** The whole reading is one link to its post: the figure highlights on hover. */
function readingLinkClass(theme: Tokens): string {
  return css`
    display: block;
    color: inherit;
    text-decoration: none;
    border-radius: ${theme.radius.sm};

    &:hover [data-figure] {
      ${markerHover(theme)}
    }
    &:hover [data-figure] [data-unit] {
      color: ${theme.color.markInk};
    }
    &:focus-visible {
      outline: 2px solid ${theme.color.focus};
      outline-offset: 4px;
    }
  `;
}

function MeasuredReading({ post, linkClass }: { post: Post; linkClass: string }): React.ReactNode {
  if (!post.keyMetric) return null;
  const { figure, unit } = splitMetric(post.keyMetric.value);
  return (
    <Reading data-testid="home-reading">
      <Link to={`/writing/${post.slug}`} className={linkClass} data-testid="home-reading-link">
        <Figure data-figure="">
          {figure}
          {unit && <Unit data-unit="">{unit}</Unit>}
        </Figure>
        <ReadingLabel>{post.keyMetric.label}</ReadingLabel>
      </Link>
      <ReadingSource>
        <DateText dateTime={post.date}>{formatIsoDate(post.date)}</DateText>
        <span>{post.title}</span>
      </ReadingSource>
    </Reading>
  );
}

/* -------------------------------------------------------------------------- */
/* Featured projects                                                           */
/* -------------------------------------------------------------------------- */

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[6]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    /* R2-D V2: auto-fit, not a fixed 3 — with 2 featured projects a fixed
     * 3-col grid renders a dangling empty third column (reads as a missing
     * card). auto-fit lets 2 cards span full width and 3+ fill naturally.
     * R3D-02: 17rem resolves 3 tracks from container ≈ 921px, which is the
     * body column's width at the xl breakpoint. */
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  }
`;

const MetaLine = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: ${(p) => p.theme.font.leading.snug};
`;

/* Router links use css() classes on plain <Link>, never styled(Link): the
 * vendored styled() prop allow-list silently drops `to` on component targets
 * (documented in src/components/layout/Nav.tsx and caught by these tests). */
function inlineLinkClass(theme: Tokens): string {
  return css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.space[1]};
    min-height: 44px;
    font-weight: ${theme.font.weights.semibold};
    ${inkLink(theme)}
    /* The 44px box is the touch target; the stroke belongs on the words. */
    &:hover {
      background: none;
      box-shadow: none;
      color: ${theme.color.accent};
    }
    &:hover > span {
      ${markerHover(theme)}
    }
  `;
}

function titleLinkClass(theme: Tokens): string {
  return css`
    ${titleLink(theme)}
    /* Inline with a mouse, so a two-line title keeps its FIRST baseline for
     * the ledger's date and length columns to align to. On phone widths it
     * is a block with a 44px hit area (R3-D: the primary affordance). */
    display: inline;

    @media (max-width: ${theme.breakpoint.md}) {
      display: inline-block;
      min-height: 44px;
    }
  `;
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

const MoreRow = styled.p`
  margin: ${(p) => p.theme.space[5]} 0 0;
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
  /** Ink link with the highlighter underline (read-more, "all posts"). */
  inline: string;
  /** Heading-styled link whose base colour matches card text. */
  title: string;
}

function ProjectCard({ project, links }: { project: Project; links: LinkClasses }): React.ReactNode {
  const detailHref = `/projects/${project.slug}`;
  return (
    <Card interactive data-testid="featured-project">
      <MetaLine>
        <span>{project.status}</span>
        <span aria-hidden="true">·</span>
        <span>{formatPeriod(project.period)}</span>
      </MetaLine>
      <CardTitle data-testid="featured-project-title">
        <Link to={detailHref} className={links.title}>
          {project.title}
        </Link>
      </CardTitle>
      <CardSummary>{project.summary}</CardSummary>
      <Stack direction="row" wrap gap="2">
        {project.tags.slice(0, 4).map((tag) => (
          <Tag key={tag} size="sm">
            {tag}
          </Tag>
        ))}
      </Stack>
      <CardFooter>
        <Link to={detailHref} className={links.inline}>
          <span>Read the case study</span> <span aria-hidden="true">→</span>
        </Link>
      </CardFooter>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Latest writing — a ledger: date, title, reading, length                     */
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
  border-bottom: 1px solid ${(p) => p.theme.color.border};

  &:first-of-type {
    padding-top: 0;
  }

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: 6.5rem minmax(0, 1fr) auto auto;
    align-items: baseline;
    column-gap: ${(p) => p.theme.space[5]};
  }
`;

const PostTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.snug};
`;

/** A post's key metric in a list: a small reading, lightly highlighted. */
const MetricChip = styled.span`
  justify-self: start;
  padding: 0 ${(p) => p.theme.space[2]};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  line-height: 1.7;
  white-space: nowrap;
  background: ${(p) => p.theme.color.accentSoft};
  color: ${(p) => p.theme.color.text};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    justify-self: end;
  }
`;

const PostMeta = styled.span`
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
  white-space: nowrap;
  justify-self: start;

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    justify-self: end;
    min-width: 5.5rem;
    text-align: right;
  }
`;

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function Home(): React.ReactNode {
  const theme = useTheme() as Tokens;
  const links: LinkClasses = { inline: inlineLinkClass(theme), title: titleLinkClass(theme) };
  const readingLink = readingLinkClass(theme);
  const projects = heroProjects();
  const latestPosts = postsByDate().slice(0, 3);
  const measured = measuredPosts(4);

  return (
    <>
      <HeroShell aria-labelledby="home-title" data-testid="home-hero">
        <HeroMain>
          <Heading level={1} id="home-title" size="5xl" data-testid="home-title">
            {SITE.name}
          </Heading>
          <Statement data-testid="home-statement">
            AI engineer and technical consultant. I run open-weight models on a six-machine GPU lab, build the tools
            that operate it, and <mark>publish what I measure</mark>.
          </Statement>
          <Lede>
            My background is full-stack engineering and data science. I help teams turn data-science results into
            services that survive production.
          </Lede>
          <CtaRow>
            <Button as={ROUTER_LINK} to="/projects" variant="primary" size="md" data-testid="home-cta-projects">
              View projects
            </Button>
            <Button as={ROUTER_LINK} to="/contact" variant="secondary" size="md" data-testid="home-cta-contact">
              Get in touch
            </Button>
          </CtaRow>
          {/* R2-A A3: hire-me status strip — renders only when the owner sets
           * SITE.hiring / SITE.resume (never fabricated). One place to flip the
           * site from "portfolio" to "available for hire". */}
          {(SITE.hiring || SITE.resume) && (
            <HiringLine data-testid="home-hiring">
              {SITE.hiring && <span>{SITE.hiring}</span>}
              {SITE.resume && (
                <Button as="a" href={SITE.resume} variant="ghost" size="sm" iconRight="download">
                  Résumé (PDF)
                </Button>
              )}
            </HiringLine>
          )}
        </HeroMain>
        <LabNote aria-label="The lab's hardware" data-testid="home-lab-note">
          <LabNoteTitle>The lab</LabNoteTitle>
          <LabList>
            {LAB_HARDWARE.map((machine) => (
              <li key={machine}>{machine}</li>
            ))}
          </LabList>
        </LabNote>
      </HeroShell>

      {/* Numbers first: the key metric of the newest posts that have one. No
       * posts with a metric, no section. */}
      {measured.length > 0 && (
        <Section
          id="measured"
          title="Recently measured"
          description="Numbers from the lab. Each one links to the post that says how it was measured."
          data-testid="home-measured-section"
        >
          <ReadingGrid data-testid="home-readings">
            {measured.map((post) => (
              <MeasuredReading key={post.slug} post={post} linkClass={readingLink} />
            ))}
          </ReadingGrid>
        </Section>
      )}

      {/* The site as a 3D knowledge graph (the /graph page's explorer, without its
       * full page list): pick a node for links to its page and every page
       * connected to it. Rebuilt from the content on every build. */}
      <Section
        id="explore"
        title="Map of the site"
        description="Every project, post and AI capability here, linked by the topics and tools they share. Pick a node to see its page and every page connected to it."
        data-testid="home-graph-section"
      >
        <KnowledgeGraphPreview />
        <CtaRow>
          <Button
            as={ROUTER_LINK}
            to="/graph"
            variant="secondary"
            size="md"
            iconRight="arrow-right"
            data-testid="home-graph-cta"
          >
            Open the full graph
          </Button>
        </CtaRow>
      </Section>

      <Section
        id="featured"
        title="Selected work"
        description="Open-source tools built for the lab, each with its repository, its tests and the numbers that judged it."
      >
        {projects.length > 0 ? (
          <>
            <Grid data-testid="featured-grid">
              {projects.map((project) => (
                <ProjectCard key={project.slug} project={project} links={links} />
              ))}
            </Grid>
            <MoreRow>
              <Link to="/projects" className={links.inline} data-testid="home-all-projects">
                <span>All {pluralize(content.projects.length, 'project')}</span> <span aria-hidden="true">→</span>
              </Link>
            </MoreRow>
          </>
        ) : (
          <EmptyState
            icon="search"
            title="Case studies are being written up"
            description="Each engagement gets a public write-up once it is shipped and
            sanitized. In the meantime, the projects index is where they will
            land — and a LinkedIn message is the fastest way to ask about work in progress."
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
        title="Latest writing"
        description="Engineering and data-science notes, written for the teammate who has to maintain what I built."
      >
        {latestPosts.length > 0 ? (
          <>
            <PostList data-testid="latest-writing">
              {latestPosts.map((post) => (
                <PostRow key={post.slug}>
                  <DateText dateTime={post.date}>{formatIsoDate(post.date)}</DateText>
                  <PostTitle>
                    <Link to={`/writing/${post.slug}`} className={links.title}>
                      {post.title}
                    </Link>
                  </PostTitle>
                  {post.keyMetric ? (
                    <MetricChip title={post.keyMetric.label} data-testid="post-metric">
                      {post.keyMetric.value}
                    </MetricChip>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  <PostMeta>{post.readingMinutes} min read</PostMeta>
                </PostRow>
              ))}
            </PostList>
            <MoreRow>
              <Link to="/writing" className={links.inline} data-testid="home-all-posts">
                <span>All {pluralize(content.posts.length, 'post')}</span> <span aria-hidden="true">→</span>
              </Link>
            </MoreRow>
          </>
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

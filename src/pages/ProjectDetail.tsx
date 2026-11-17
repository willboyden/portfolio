/**
 * ProjectDetail — /projects/:slug. Hero (title, role, period, status badge,
 * stack tags, source/demo/paper buttons), highlights, metrics strip, then the
 * build-time-rendered markdown body inside <Prose>.
 *
 * HTML SAFETY: `project.html` is produced at BUILD time by
 * scripts/build-content.mjs from repo-owned markdown, validated with zod
 * (CONTRACT §5). It is trusted content, not user input — same posture as
 * prerendered HTML anywhere. dangerouslySetInnerHTML is confined to this one
 * element; nothing runtime-supplied ever reaches it.
 *
 * UNKNOWN SLUG: getProject() miss → renders <NotFound/> (the router's
 * fallback component, reused per CONTRACT §4b) and never crashes.
 *
 * A11Y: h1 project title; sections are landmark sections with h2s in order;
 * external links get rel="noopener noreferrer" and a screen-reader suffix
 * "(opens in a new tab)" via VisuallyHidden-free text (SSR-testable); related
 * projects are real links.
 */
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { Link, useParams } from '@portfolio/router';
import { content, getProject, type Project } from 'app/content';
import type { Tokens } from 'app/theme/tokens';
import { dataText, titleLink } from 'app/theme/mixins';
import { formatIsoDate, formatReadingTime } from 'app/lib/format';
import { rebaseHtml } from 'app/lib/seo';
import { NotFound } from './NotFound';
import { ProjectMetrics, statusTone } from './Projects';
import { Button, Container, Heading, Prose, Section, Stack, Tag, VisuallyHidden } from 'app/components/ui';

/* -------------------------------------------------------------------------- */
/* Pure, unit-tested helpers                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Related projects by tag overlap: shared-tag count desc, then newest first,
 * then alpha; the project itself is never related to itself; max `limit`.
 */
export function relatedProjects(all: readonly Project[], current: Project, limit = 3): Project[] {
  return all
    .filter((p) => p.slug !== current.slug)
    .map((p) => ({ project: p, overlap: p.tags.filter((t) => current.tags.includes(t)).length }))
    .filter((entry) => entry.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        (a.project.date < b.project.date
          ? 1
          : a.project.date > b.project.date
            ? -1
            : a.project.title.localeCompare(b.project.title)),
    )
    .slice(0, limit)
    .map((entry) => entry.project);
}

/** Which of source/demo/paper links are present, in render order.
 *  R2-A A2: `links` is optional (a project with no verified URL has none). */
export function projectLinkEntries(
  links: Project['links'] | undefined,
): { kind: 'source' | 'demo' | 'paper'; url: string }[] {
  const entries: { kind: 'source' | 'demo' | 'paper'; url: string }[] = [];
  if (!links) return entries;
  if (links.source) entries.push({ kind: 'source', url: links.source });
  if (links.demo) entries.push({ kind: 'demo', url: links.demo });
  if (links.paper) entries.push({ kind: 'paper', url: links.paper });
  return entries;
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

/* The head of a project page reads like the head of a data sheet: the facts
 * about the entry (status, period, date, role) sit in the margin column, the
 * title, summary, links and measured numbers in the main one. Below `xl` the
 * facts collapse into one compact line above the title. */
const Hero = styled.header`
  padding-block-end: ${(p) => p.theme.space[7]};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    display: grid;
    grid-template-columns: ${(p) => p.theme.layout.marginCol} minmax(0, 1fr);
    column-gap: ${(p) => p.theme.space[7]};
    align-items: start;
  }
`;

const HeroMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  min-width: 0;
`;

const Facts = styled.dl`
  margin: 0 0 ${(p) => p.theme.space[3]};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[1]} ${(p) => p.theme.space[3]};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    margin: ${(p) => p.theme.space[3]} 0 0;
    display: block;
    border-top: 1px solid ${(p) => p.theme.color.borderStrong};
  }
`;

const Fact = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    display: block;
    padding-block: ${(p) => p.theme.space[2]};
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;

/* The label is for screen readers on small screens (the values read fine in
 * a row without it) and visible in the margin column. */
const FactLabel = styled.dt`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    position: static;
    width: auto;
    height: auto;
    margin: 0 0 ${(p) => p.theme.space['0']};
    overflow: visible;
    clip-path: none;
    font-family: ${(p) => p.theme.font.sans};
    font-size: ${(p) => p.theme.font.sizes.xs};
    color: ${(p) => p.theme.color.textSubtle};
  }
`;

const FactValue = styled.dd`
  margin: 0;
  color: ${(p) => p.theme.color.textMuted};
  overflow-wrap: anywhere;

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    color: ${(p) => p.theme.color.text};
  }
`;

const Lede = styled.p`
  margin: 0;
  max-width: 62ch;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: 1.45;
  color: ${(p) => p.theme.color.text};

  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    font-size: ${(p) => p.theme.font.sizes.lg};
  }
`;

const LinkRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
`;

const MetricsWrap = styled.div`
  max-width: 46rem;
`;

/* -------------------------------------------------------------------------- */
/* Body sections                                                               */
/* -------------------------------------------------------------------------- */

/* A plain list with a short rule as its bullet, the same marker the Now page
 * uses: these are findings, not a feature checklist. */
const HighlightList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  max-width: 68ch;
`;

const HighlightItem = styled.li`
  position: relative;
  padding-left: ${(p) => p.theme.space[5]};
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.lg};
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.normal};
  /* R3D-01: highlights quote slash-stacked resource paths like
   * traces/observations/sessions/scores that read as one 288px word —
   * break-word only inside these items, never body prose. */
  word-break: break-word;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.8em;
    width: ${(p) => p.theme.space[3]};
    height: 2px;
    background: ${(p) => p.theme.color.mark};
  }
`;

const RelatedGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const RelatedEntry = styled.div`
  padding-top: ${(p) => p.theme.space[3]};
  border-top: 1px solid ${(p) => p.theme.color.borderStrong};
`;

/* R7C-8: the heading alone made the reader guess the relationship; one
 * plain sentence states it (shared methods/tooling, tag-overlap ranking). */
const RelatedHint = styled.p`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;

const RelatedSummary = styled.p`
  margin: ${(p) => p.theme.space[1]} 0 0;
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

/* R6-C C1: "Related writing" entry — mirrors PostDetail's related-project
 * block so the two directions read as one design system. */
const RelatedPostCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
  max-width: 46rem;
`;

const RelatedPostHint = styled.span`
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};
`;

const RelatedPostTitle = styled.span`
  align-self: flex-start;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.snug};
`;

const RelatedPostMeta = styled.span`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

const RelatedTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.snug};
`;

function relatedLinkClass(theme: Tokens): string {
  return css`
    ${titleLink(theme)}
    display: inline-block;
    /* R3-D: standalone title link — 44px hit area at phone widths. */
    min-height: 28px;

    @media (max-width: ${theme.breakpoint.md}) {
      min-height: 44px;
    }
  `;
}

/* Router links take css() classes on plain <Link> — styled(Link) would drop
 * the `to` prop (vendored styled() prop allow-list, Nav.tsx precedent). */
/** R6-C C1: the related-post link (the whole entry is one <Link>). */
function relatedPostCls(theme: Tokens): string {
  const t = theme;
  return css({
    display: 'flex',
    flexDirection: 'column',
    gap: t.space[1],
    textDecoration: 'none',
    borderRadius: t.radius.sm,
    color: 'inherit',
    minHeight: '28px',
    ['@media (max-width: ' + t.breakpoint.md + ')']: {
      minHeight: '44px' /* R3D-03: primary affordance at phone widths */,
    },
    '&:hover .related-post-title': { background: t.color.mark, color: t.color.markInk },
    '&:focus-visible': { outline: `2px solid ${t.color.focus}`, outlineOffset: '3px' },
  });
}

function crumbClass(theme: Tokens): string {
  return css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.space[1],
    fontFamily: theme.font.sans,
    fontSize: theme.font.sizes.sm,
    color: theme.color.textMuted,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    /* R3D-03: standalone block-level nav link (22px measured) — WCAG 2.5.8
     * floor at 44px phone hit area, same recipe as the chips. */
    minHeight: '28px',
    ['@media (max-width: ' + theme.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover': { background: theme.color.mark, color: theme.color.markInk, textDecoration: 'none' },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
  });
}

const CrumbNav = styled.nav`
  margin-bottom: ${(p) => p.theme.space[3]};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    margin-bottom: 0;
  }
`;

const LINK_LABEL: Record<'source' | 'demo' | 'paper', string> = {
  source: 'Source',
  demo: 'Live demo',
  paper: 'Paper',
};

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function ProjectDetail(): React.ReactNode {
  const { slug } = useParams<{ slug: string }>();
  const project = slug !== undefined ? getProject(slug) : undefined;
  const theme = useTheme() as Tokens;
  /* computed per-render (hook context exists here): a module-scope css()
   * call would read context outside React and log "Invalid hook call"
   * during prerender (R3-C follow-up). */
  const buttonLink = css({ textDecoration: 'none' });

  if (!project) return <NotFound />;

  const links = projectLinkEntries(project.links);
  const related = relatedProjects(content.projects, project);
  /* R6-C C1: the curated post that tells this project's story. */
  const relatedPost = project.relatedPost ? content.posts.find((p) => p.slug === project.relatedPost) : undefined;

  return (
    <Container data-testid="project-detail">
      <Hero>
        <div>
          <CrumbNav aria-label="Breadcrumb">
            <Link to="/projects" className={crumbClass(theme)}>
              ← All projects
            </Link>
          </CrumbNav>
          <Facts>
            <Fact>
              <FactLabel>Status</FactLabel>
              <FactValue>
                <Tag size="sm" tone={statusTone(project.status)} data-testid="project-status">
                  {project.status}
                </Tag>
              </FactValue>
            </Fact>
            <Fact>
              <FactLabel>Period</FactLabel>
              <FactValue>{project.period}</FactValue>
            </Fact>
            <Fact>
              <FactLabel>Dated</FactLabel>
              <FactValue>
                <time dateTime={project.date}>{formatIsoDate(project.date)}</time>
              </FactValue>
            </Fact>
            <Fact>
              <FactLabel>Role</FactLabel>
              <FactValue data-testid="detail-role">{project.role}</FactValue>
            </Fact>
          </Facts>
        </div>
        <HeroMain>
          <Heading level={1} size="4xl" data-testid="detail-title">
            {project.title}
          </Heading>
          <Lede>{project.summary}</Lede>
          <Stack direction="row" wrap gap="2">
            {project.stack.map((tech) => (
              <Tag key={tech} size="sm">
                {tech}
              </Tag>
            ))}
          </Stack>
          {links.length > 0 && (
            <LinkRow aria-label="Project links" data-testid="detail-links">
              {links.map((entry) => (
                <Button
                  key={entry.kind}
                  as="a"
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant={entry.kind === 'demo' ? 'primary' : 'secondary'}
                  className={buttonLink}
                  iconRight="external-link"
                >
                  {LINK_LABEL[entry.kind]}
                  <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
                </Button>
              ))}
            </LinkRow>
          )}
          {project.metrics && project.metrics.length > 0 && (
            <MetricsWrap>
              <ProjectMetrics metrics={project.metrics} testid="detail-metrics" />
            </MetricsWrap>
          )}
        </HeroMain>
      </Hero>

      {project.highlights.length > 0 && (
        <Section id="highlights" title="Highlights">
          <HighlightList data-testid="detail-highlights">
            {project.highlights.map((highlight) => (
              <HighlightItem key={highlight}>{highlight}</HighlightItem>
            ))}
          </HighlightList>
        </Section>
      )}

      {/* No body = no section. The old "write-up is in review" stand-in was a
       * coming-soon on most project pages; the highlights are the content. */}
      {project.html && (
        <Section id="case-study" title="Case study">
          <Prose data-testid="detail-body">
            {/* Build-time validated markdown output — see file header. */}
            <div dangerouslySetInnerHTML={{ __html: rebaseHtml(project.html) }} />
          </Prose>
        </Section>
      )}

      {/* R6-C C1: the writing that tells this project's story — closes the
          work→thinking loop the IA round found missing. */}
      {relatedPost !== undefined && (
        <Section id="related-post" title="Related writing">
          <RelatedPostCard data-testid="related-post">
            <RelatedPostHint>The thinking behind this project</RelatedPostHint>
            <Link to={`/writing/${relatedPost.slug}`} className={relatedPostCls(theme)} data-testid="related-post-link">
              <RelatedPostTitle className="related-post-title">{relatedPost.title}</RelatedPostTitle>
              <RelatedPostMeta>
                <time dateTime={relatedPost.date}>{formatIsoDate(relatedPost.date)}</time>
                <span aria-hidden="true">·</span>
                {formatReadingTime(relatedPost.readingMinutes)}
              </RelatedPostMeta>
            </Link>
          </RelatedPostCard>
        </Section>
      )}

      {related.length > 0 && (
        <Section id="related" title="Related projects">
          <RelatedHint>Other projects that share methods or tooling with this one.</RelatedHint>
          <RelatedGrid data-testid="related-grid">
            {related.map((item) => (
              <RelatedEntry key={item.slug}>
                <RelatedTitle>
                  <Link to={`/projects/${item.slug}`} className={relatedLinkClass(theme)}>
                    {item.title}
                  </Link>
                </RelatedTitle>
                <RelatedSummary>{item.summary}</RelatedSummary>
              </RelatedEntry>
            ))}
          </RelatedGrid>
        </Section>
      )}
    </Container>
  );
}

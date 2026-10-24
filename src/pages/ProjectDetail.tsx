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
import { formatDate, formatReadingTime } from 'app/lib/format';
import { NotFound } from './NotFound';
import { ProjectMetrics, statusTone } from './Projects';
import {
  Button,
  Container,
  Heading,
  Icon,
  Prose,
  Stack,
  Tag,
  VisuallyHidden,
} from 'app/components/ui';

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
        (a.project.date < b.project.date ? 1 : a.project.date > b.project.date ? -1 : a.project.title.localeCompare(b.project.title)),
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

const Hero = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding-block-end: ${(p) => p.theme.space[6]};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
`;

const MetaLine = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const Lede = styled.p`
  margin: 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

const LinkRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
`;

/* -------------------------------------------------------------------------- */
/* Body sections                                                               */
/* -------------------------------------------------------------------------- */

const Block = styled.section`
  padding-block: ${(p) => p.theme.space[6]};

  &:not(:last-of-type) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;

const BlockTitle = styled.h2`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-size: ${(p) => p.theme.font.sizes['2xl']};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.tight};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

/* R2-D V3: body-copy block for the "write-up in review" state. */
const PanelBody = styled.p`
  margin: 0;
  max-width: 65ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

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
  display: flex;
  gap: ${(p) => p.theme.space[3]};
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.normal};
  /* R3D-01: highlights quote slash-stacked resource paths like
   * traces/observations/sessions/scores that read as one 288px word —
   * break-word only inside these items, never body prose. */
  word-break: break-word;

  & svg {
    margin-top: ${(p) => p.theme.space[1]};
    color: ${(p) => p.theme.color.accent};
    flex: none;
  }
`;

const RelatedGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[4]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

/* R7C-8: the heading alone made the reader guess the relationship; one
 * plain sentence states it (shared methods/tooling, tag-overlap ranking). */
const RelatedHint = styled.p`
  margin: 0 0 ${(p) => p.theme.space[3]};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;

/* R6-C C1: "Related writing" card — mirrors PostDetail's related-project
 * block so the two directions read as one design system. */
const RelatedPostCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  padding: ${(p) => p.theme.space[4]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: ${(p) => p.theme.color.bgSunken};
`;

const RelatedPostHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const RelatedPostTitle = styled.span`
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.snug};
  transition: color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};
`;

const RelatedPostMeta = styled.span`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;

const RelatedTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
`;

function relatedLinkClass(theme: Tokens): string {
  return css({
    display: 'block',
    color: theme.color.text,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    /* R3-D: standalone title link — 44px hit area at phone widths. */
    minHeight: '28px',
    ['@media (max-width: ' + theme.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover': {
      color: theme.color.accent,
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '3px' },
  });
}

/* Router links take css() classes on plain <Link> — styled(Link) would drop
 * the `to` prop (vendored styled() prop allow-list, Nav.tsx precedent). */
/** Inline prose-link skin (R6-C C6): used inside PanelBody copy. */
function inlineLinkClass(theme: Tokens): string {
  return css({
    color: theme.color.accent,
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    '&:hover': { color: theme.color.text },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
  });
}

/** R6-C C1: the related-post card link (whole card is one <Link>). */
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
      minHeight: '44px', /* R3D-03: primary affordance at phone widths */
    },
    '&:hover .related-post-title': { color: t.color.accent },
    '&:focus-visible': { outline: `2px solid ${t.color.focus}`, outlineOffset: '3px' },
  });
}

function crumbClass(theme: Tokens): string {
  return css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.space[1],
    fontFamily: theme.font.mono,
    fontSize: theme.font.sizes.sm,
    color: theme.color.textSubtle,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    /* R3D-03: standalone block-level nav link (22px measured) — WCAG 2.5.8
     * floor at 44px phone hit area, same recipe as the chips. */
    minHeight: '28px',
    ['@media (max-width: ' + theme.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover': {
      color: theme.color.accent,
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
  });
}

const CrumbNav = styled.nav`
  margin-bottom: ${(p) => p.theme.space[5]};
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
  const relatedPost = project.relatedPost
    ? content.posts.find((p) => p.slug === project.relatedPost)
    : undefined;

  return (
    <Container data-testid="project-detail">
      <CrumbNav aria-label="Breadcrumb">
        <Link to="/projects" className={crumbClass(theme)}>
          ← All projects
        </Link>
      </CrumbNav>

      <Hero>
        <MetaLine>
          <Tag tone={statusTone(project.status)} data-testid="project-status">
            {project.status}
          </Tag>
          <span aria-hidden="true">·</span>
          <span>{project.period}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(project.date)}</span>
        </MetaLine>
        <Heading level={1} size="4xl" data-testid="detail-title">
          {project.title}
        </Heading>
        <MetaLine data-testid="detail-role">{project.role}</MetaLine>
        <Lede>{project.summary}</Lede>
        <Stack direction="row" wrap gap="2">
          {project.stack.map((tech) => (
            <Tag key={tech} size="sm" tone="accent">
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
        <ProjectMetrics metrics={project.metrics} testid="detail-metrics" />
      </Hero>

      {project.highlights.length > 0 && (
        <Block aria-labelledby="highlights-title">
          <BlockTitle id="highlights-title">Highlights</BlockTitle>
          <HighlightList data-testid="detail-highlights">
            {project.highlights.map((highlight) => (
              <HighlightItem key={highlight}>
                <Icon name="check" size={18} />
                <span>{highlight}</span>
              </HighlightItem>
            ))}
          </HighlightList>
        </Block>
      )}

      {project.html ? (
        <Block aria-labelledby="case-study-title">
          <BlockTitle id="case-study-title">Case study</BlockTitle>
          <Prose data-testid="detail-body">
            {/* Build-time validated markdown output — see file header. */}
            <div dangerouslySetInnerHTML={{ __html: project.html }} />
          </Prose>
        </Block>
      ) : (
        /* R2-D V3: an unfinished write-up renders a designed, honest state —
         * never a silent null that leaves the flagship page looking broken. */
        <Block aria-labelledby="case-study-title">
          <BlockTitle id="case-study-title">Case study</BlockTitle>
          <PanelBody data-testid="detail-body-pending">
            The full write-up for this project is in review. The highlights
            above are the short version; <Link to="/contact" className={inlineLinkClass(theme)}>email me</Link> for
            the long one — I keep the design docs.
          </PanelBody>
        </Block>
      )}

      {/* R6-C C1: the writing that tells this project's story — closes the
          work→thinking loop the IA round found missing. */}
      {relatedPost !== undefined && (
        <Block aria-labelledby="related-post-title">
          <BlockTitle id="related-post-title">Related writing</BlockTitle>
          <RelatedPostCard data-testid="related-post">
            <RelatedPostHint>
              <Icon name="arrow-right" size={12} />
              The thinking behind this project
            </RelatedPostHint>
            <Link
              to={`/writing/${relatedPost.slug}`}
              className={relatedPostCls(theme)}
              data-testid="related-post-link"
            >
              <RelatedPostTitle className="related-post-title">{relatedPost.title}</RelatedPostTitle>
              <RelatedPostMeta>
                <time dateTime={relatedPost.date}>{formatDate(relatedPost.date)}</time>
                <span aria-hidden="true">·</span>
                {formatReadingTime(relatedPost.readingMinutes)}
              </RelatedPostMeta>
            </Link>
          </RelatedPostCard>
        </Block>
      )}


      {related.length > 0 && (
        <Block aria-labelledby="related-title">
          <BlockTitle id="related-title">Related projects</BlockTitle>
          <RelatedHint>Other projects that share methods or tooling with this one.</RelatedHint>
          <RelatedGrid data-testid="related-grid">
            {related.map((item) => (
              <div key={item.slug}>
                <RelatedTitle>
                  <Link to={`/projects/${item.slug}`} className={relatedLinkClass(theme)}>
                    {item.title}
                  </Link>
                </RelatedTitle>
                <MetaLine>{item.summary}</MetaLine>
              </div>
            ))}
          </RelatedGrid>
        </Block>
      )}
    </Container>
  );
}

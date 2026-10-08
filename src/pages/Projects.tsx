/**
 * Projects — the project index: h1 "Selected work", client-side tag filter
 * chips (scoped to projects only — `allTags()` is site-wide, so counts here
 * come from project tags via `projectTagCounts`), a responsive card grid,
 * status badges, metrics strips, and a designed EmptyState for both the
 * nothing-published-yet and the filter-matches-nothing cases.
 *
 * DATA POSTURE: content.json starts EMPTY (CONTRACT §5 — the pipeline fills
 * it later). Every list branch is empty-safe. The filtering logic is exported
 * as PURE functions (`visibleProjects`, `projectTagCounts`, `statusTone`) so
 * populated states are unit-testable without touching content.json.
 *
 * A11Y: one h1; filter chips are real <button type="button"> with
 * aria-pressed (toggle semantics, keyboard-reachable, focus ring from the
 * token); the result line is role="status" so SRs announce filter changes;
 * each card keeps a real link inside the title (the card is `interactive`
 * but is never the only affordance — Card's own guidance).
 */
import { useState } from 'react';
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { Link } from '@portfolio/router';
import { content, type Project, type ProjectMetric } from 'app/content';
import type { Tokens } from 'app/theme/tokens';
import { pluralize } from 'app/lib/format';
import {
  Button,
  Card,
  EmptyState,
  Heading,
  Stack,
  Tag,
  type TagTone,
} from 'app/components/ui';

/* -------------------------------------------------------------------------- */
/* Pure, unit-tested filtering                                                 */
/* -------------------------------------------------------------------------- */

/** Same shape/sort as `allTags()` (count desc, then alpha), but projects only. */
export function projectTagCounts(all: readonly Project[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const project of all) {
    for (const tag of project.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * The grid contents for the active filter. `tag === null` shows everything;
 * output is always newest-first (date desc, title alpha as tiebreak) so the
 * grid order never depends on the input array order.
 */
export function visibleProjects(all: readonly Project[], tag: string | null): Project[] {
  const filtered = tag === null ? [...all] : all.filter((p) => p.tags.includes(tag));
  return filtered.sort(
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)),
  );
}

/** Contrast-checked Tag tone per status (all tones verified in Tag.tsx). */
export function statusTone(status: Project['status']): TagTone {
  return status === 'shipped' ? 'accent' : status === 'archived' ? 'outline' : 'default';
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

const MetaLine = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
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

/* Router links carry css() classes on plain <Link>, never styled(Link): the
 * vendored styled() prop allow-list silently drops `to` on component targets
 * (same rule Nav.tsx and Home.tsx follow). */
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

function inlineLinkClass(theme: Tokens): string {
  return css({
    color: theme.color.accent,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
  });
}

/* Metrics strip: label/value pairs. A flex row of columns — wraps on narrow
 * cards, token gaps only. Rendered ONLY when metrics exist (empty array must
 * not leave a 0-height band in the card). */
const MetricsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => `${p.theme.space[2]} ${p.theme.space[5]}`};
  padding: ${(p) => `${p.theme.space[2]} 0`};
  border-top: 1px solid ${(p) => p.theme.color.border};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
`;

const MetricBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space['0']};
`;

const MetricLabel = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const MetricValue = styled.span`
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};
`;

/** Empty-safe metrics strip — returns null with no metrics, so callers never
 *  render a bare bordered band. Shared with ProjectDetail. */
export function ProjectMetrics({
  metrics,
  testid = 'project-metrics',
}: {
  metrics: ProjectMetric[] | undefined;
  testid?: string;
}): React.ReactNode {
  if (!metrics || metrics.length === 0) return null;
  return (
    <MetricsRow data-testid={testid}>
      {metrics.map((metric) => (
        <MetricBlock key={metric.label}>
          <MetricLabel>{metric.label}</MetricLabel>
          <MetricValue>{metric.value}</MetricValue>
        </MetricBlock>
      ))}
    </MetricsRow>
  );
}

export function ProjectCard({ project }: { project: Project }): React.ReactNode {
  const theme = useTheme() as Tokens;
  const href = `/projects/${project.slug}`;
  return (
    <Card interactive data-testid="project-card">
      <MetaLine>
        <Tag size="sm" tone={statusTone(project.status)} data-testid="project-status">
          {project.status}
        </Tag>
        <span aria-hidden="true">·</span>
        <span>{project.period}</span>
      </MetaLine>
      <CardTitle>
        <Link to={href} className={titleLinkClass(theme)} data-testid="project-card-title">
          {project.title}
        </Link>
      </CardTitle>
      <CardSummary>{project.summary}</CardSummary>
      <ProjectMetrics metrics={project.metrics} />
      <Stack direction="row" wrap gap="2">
        {project.tags.slice(0, 5).map((tag) => (
          <Tag key={tag} size="sm" tone="outline">
            {tag}
          </Tag>
        ))}
      </Stack>
      <CardFooter>
        <Link to={href} className={inlineLinkClass(theme)}>
          View case study <span aria-hidden="true">→</span>
        </Link>
      </CardFooter>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

const PageHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding-block-end: ${(p) => p.theme.space[6]};
`;

const Lede = styled.p`
  margin: 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

const FilterBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
`;

/* 44px hit area via token sums (Button 'sm' recipe: space5+space4+space1). */
const Chip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  min-height: calc(${(p) => p.theme.space[5]} + ${(p) => p.theme.space[4]} + ${(p) => p.theme.space[1]});
  padding: ${(p) => `${p.theme.space['1']} ${p.theme.space[3]}`};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.none};
  border-radius: ${(p) => p.theme.radius.full};
  border: 1px solid ${(p) => p.theme.color.border};
  cursor: pointer;
  transition:
    background ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  /* Whole declarations gated on $active (never `x: cond ? a : false`). */
  ${(p) =>
    p.$active &&
    `background: ${p.theme.color.accentSoft}; color: ${p.theme.color.accent}; border-color: ${p.theme.color.accentBorder}; font-weight: ${p.theme.font.weights.semibold};`}
  ${(p) =>
    !p.$active &&
    `background: ${p.theme.color.bgElevated}; color: ${p.theme.color.textMuted}; &:hover { color: ${p.theme.color.text}; border-color: ${p.theme.color.borderStrong}; }`}

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ChipCount = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

const ResultCount = styled.p`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};
  margin-top: ${(p) => p.theme.space[5]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export function Projects(): React.ReactNode {
  const [tag, setTag] = useState<string | null>(null);
  const all = content.projects;
  const tagCounts = projectTagCounts(all);
  const visible = visibleProjects(all, tag);

  return (
    <>
      <PageHeader>
        <Heading level={1} data-testid="projects-title">
          Selected work
        </Heading>
        <Lede>
          Systems that shipped — the reasoning behind them, the stack that
          carried them, and the numbers that judged them. Filter by tag to cut
          to one thread of the work.
        </Lede>
        {all.length > 0 && (
          <FilterBar role="group" aria-label="Filter projects by tag" data-testid="tag-filter">
            <Chip
              type="button"
              $active={tag === null}
              aria-pressed={tag === null}
              onClick={() => setTag(null)}
            >
              All <ChipCount>{all.length}</ChipCount>
            </Chip>
            {tagCounts.map((entry) => (
              <Chip
                key={entry.tag}
                type="button"
                $active={tag === entry.tag}
                aria-pressed={tag === entry.tag}
                aria-label={`Filter by ${entry.tag}, ${pluralize(entry.count, 'project')}`}
                onClick={() => setTag(tag === entry.tag ? null : entry.tag)}
              >
                {entry.tag} <ChipCount>{entry.count}</ChipCount>
              </Chip>
            ))}
          </FilterBar>
        )}
        {all.length > 0 && (
          <ResultCount role="status">
            Showing {pluralize(visible.length, 'project')}
            {tag !== null ? ` tagged “${tag}”` : ''}.
          </ResultCount>
        )}
      </PageHeader>

      {visible.length > 0 ? (
        <Grid data-testid="projects-grid">
          {visible.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </Grid>
      ) : (
        <EmptyState
          icon="search"
          title={tag === null ? 'No projects published yet' : `Nothing tagged “${tag}”`}
          description={
            tag === null
              ? 'The case studies are still being written. Check back soon — or read the writing while you wait.'
              : 'That tag has no projects yet. Clear the filter to see the full list.'
          }
          action={
            tag !== null ? (
              <Button variant="secondary" size="sm" onClick={() => setTag(null)}>
                Clear filter
              </Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}

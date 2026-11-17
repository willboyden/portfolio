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
import { actionLink, dataText, filterChip, titleLink } from 'app/theme/mixins';
import { formatPeriod, pluralize } from 'app/lib/format';
import { Button, Card, EmptyState, Heading, Stack, Tag, type TagTone } from 'app/components/ui';

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
 * The grid contents for the active filter. `tag === null` shows everything.
 * Featured projects (the open-source tools) lead, then everything else; each
 * group is newest-first (date desc, title alpha as tiebreak) so the grid
 * order never depends on the input array order.
 */
export function visibleProjects(all: readonly Project[], tag: string | null): Project[] {
  const filtered = tag === null ? [...all] : all.filter((p) => p.tags.includes(tag));
  return filtered.sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)),
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
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

/* h2 not h3: this page goes h1 -> card titles directly; jumping to h3 skips
 * a level and the a11y e2e (02-a11y) treats that as a violation. */
const CardTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: ${(p) => p.theme.font.leading.snug};
`;

const CardSummary = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted}; /* R2-D V7: clamp so one long blurb can't make a straggling tall card */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  return css`
    ${titleLink(theme)}
    /* WCAG 2.5.8 touch target (mirrors Home.tsx title link). */
    display: inline-block;
    min-height: 28px;

    @media (max-width: ${theme.breakpoint.md}) {
      min-height: 44px; /* R3-D: primary card affordance at phone widths */
    }
  `;
}

function ctaLinkClass(theme: Tokens): string {
  return css`
    ${actionLink(theme)}
  `;
}

/* Metrics: a small specification table, label on the left and the measured
 * value on the right, one hairline per row. Rendered ONLY when metrics exist
 * (an empty array must not leave a bordered band in the card). */
const MetricsRow = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  border-top: 1px solid ${(p) => p.theme.color.border};
`;

const MetricBlock = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  column-gap: ${(p) => p.theme.space[3]};
  align-items: baseline;
  padding-block: ${(p) => p.theme.space[1]};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
`;

const MetricLabel = styled.dt`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xs};
  line-height: ${(p) => p.theme.font.leading.snug};
  color: ${(p) => p.theme.color.textSubtle};
`;

const MetricValue = styled.dd`
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.snug};
  color: ${(p) => p.theme.color.text};
`;

/** How many metrics an index card shows; the case study shows them all. */
export const CARD_METRIC_LIMIT = 3;

/** Empty-safe metrics table — returns null with no metrics, so callers never
 *  render a bare bordered band. Shared with ProjectDetail. `limit` trims the
 *  list for index cards (the rest are on the project's own page). */
export function ProjectMetrics({
  metrics,
  testid = 'project-metrics',
  limit,
}: {
  metrics: ProjectMetric[] | undefined;
  testid?: string;
  limit?: number;
}): React.ReactNode {
  if (!metrics || metrics.length === 0) return null;
  const shown = limit === undefined ? metrics : metrics.slice(0, limit);
  return (
    <MetricsRow data-testid={testid}>
      {shown.map((metric) => (
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
        <span>{formatPeriod(project.period)}</span>
        {project.links?.source !== undefined && (
          <>
            <span aria-hidden="true">·</span>
            <span data-testid="project-open-source">open source</span>
          </>
        )}
      </MetaLine>
      <CardTitle>
        <Link to={href} className={titleLinkClass(theme)} data-testid="project-card-title">
          {project.title}
        </Link>
      </CardTitle>
      <CardSummary>{project.summary}</CardSummary>
      <ProjectMetrics metrics={project.metrics} limit={CARD_METRIC_LIMIT} />
      <Stack direction="row" wrap gap="2">
        {project.tags.slice(0, 5).map((tag) => (
          <Tag key={tag} size="sm">
            {tag}
          </Tag>
        ))}
      </Stack>
      <CardFooter>
        {/* R3-D: this is a standalone CTA, not inline prose — WCAG 2.5.8's
            inline-text exception does not apply; give it the phone hit area. */}
        <Link to={href} className={ctaLinkClass(theme)} data-testid="project-card-cta">
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
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

const FilterBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
  align-items: center;
`;

/* R7C-4: 22 controls for 8 projects was choice overload (14 chips filtered
 * to exactly one project). Primary chips = tags used by ≥2 projects; the
 * single-project long tail folds behind a native <details> disclosure that
 * works without JS (same no-JS contract as the rest of the site). */
const MoreTags = styled.details`
  display: inline-block;
  min-height: calc(${(p) => p.theme.space[6]} + ${(p) => p.theme.space[1]});
`;

const MoreTagsSummary = styled.summary`
  ${(p) => filterChip(p.theme, false)}
  color: ${(p) => p.theme.color.textMuted};
  border-style: dashed;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }
`;

const MoreTagsBody = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
  margin-top: ${(p) => p.theme.space[2]};
`;

/* One selected-chip recipe site-wide (mixins.filterChip): a block of ink.
 * Whole rule sets gated on $active — never a value-level ternary that
 * resolves to false (the vendored Emotion rejects empty declarations). */
const Chip = styled.button<{ $active: boolean }>`
  ${(p) => filterChip(p.theme, p.$active)}
`;

/* Same colour as its label at full strength (a dimmed count fell under
 * 4.5:1); the mono face and the size set it apart. */
const ChipCount = styled.span`
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
`;

const ResultCount = styled.p`
  margin: 0;
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[7]} ${(p) => p.theme.space[6]};
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
  /* R7C-4: chips with real navigation value (≥2 projects) stay in the bar;
   * single-project tags fold into the disclosure. */
  const primaryTags = tagCounts.filter((entry) => entry.count >= 2);
  const tailTags = tagCounts.filter((entry) => entry.count < 2);
  const visible = visibleProjects(all, tag);

  return (
    <>
      <PageHeader>
        <Heading level={1} data-testid="projects-title">
          Selected work
        </Heading>
        <Lede>
          Open-source tools first, each with its GitHub repository; then smaller systems built and tested in my lab.
          Every card says what shipped, the stack, and the numbers that judged it. Filter by tag to cut to one thread of
          the work.
        </Lede>
        {all.length > 0 && (
          <FilterBar role="group" aria-label="Filter projects by tag" data-testid="tag-filter">
            <Chip type="button" $active={tag === null} aria-pressed={tag === null} onClick={() => setTag(null)}>
              All <ChipCount>{all.length}</ChipCount>
            </Chip>
            {primaryTags.map((entry) => (
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
            {tailTags.length > 0 && (
              <MoreTags data-testid="more-tags">
                <MoreTagsSummary>More tags ({tailTags.length})</MoreTagsSummary>
                <MoreTagsBody>
                  {tailTags.map((entry) => (
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
                </MoreTagsBody>
              </MoreTags>
            )}
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

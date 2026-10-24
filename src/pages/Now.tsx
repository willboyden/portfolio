/**
 * Now — a /now-page: what I am pointed at *this quarter*, not a résumé in
 * present tense. Date-stamped per the now-page convention so staleness is
 * visible instead of dishonest.
 *
 * A11Y: one h1; each panel is a labelled section with an h2; "available for"
 * is a real list of commitments, not decorative bullets.
 */
import styled from '@emotion/styled';
import { Link } from '@portfolio/router';
import { Button, Heading, Section } from 'app/components/ui';
import { content } from 'app/content';
import { formatMonthYear } from 'app/lib/format';

/* R7I-01: the /now stamp is derived from the newest shipped content date, so
 * it can only move when content actually moves — "updated when the picture
 * changes" becomes a build invariant instead of a manual promise. Falls back
 * to the literal below if the bundle somehow has no dated entries. */
const newestContentDate = [...content.projects, ...content.posts]
  .map((item) => item.date)
  .sort()
  .at(-1);
const NOW_UPDATED = formatMonthYear(newestContentDate ?? '') || 'October 2026';

/* Cast per the ui.test.tsx polymorphic-`as` pattern — see Home.tsx. */
const ROUTER_LINK = Link as unknown as 'a';

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

const Stamp = styled.p`
  margin: ${(p) => p.theme.space[4]} 0 0;
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  color: ${(p) => p.theme.color.textSubtle};
`;

const Dot = styled.span`
  width: ${(p) => p.theme.space[2]};
  height: ${(p) => p.theme.space[2]};
  border-radius: ${(p) => p.theme.radius.full};
  background: ${(p) => p.theme.color.success};
  flex: none;
`;

const Intro = styled.p`
  margin: ${(p) => p.theme.space[5]} 0 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

const Panels = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};
  align-items: start;

  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Panel = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => p.theme.space[5]};
  background: ${(p) => p.theme.color.surface};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const ItemList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
`;

const Item = styled.li`
  position: relative;
  padding-left: ${(p) => p.theme.space[5]};
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.65em;
    width: ${(p) => p.theme.space[2]};
    height: 1px;
    background: ${(p) => p.theme.color.accent};
  }

  strong {
    color: ${(p) => p.theme.color.text};
    font-weight: ${(p) => p.theme.font.weights.semibold};
  }
`;

/* R9B-1: the honest note under "Available for" — muted, small, one breath. */
const PanelNote = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textSubtle};
`;

const FullPanel = styled(Panel)`
  grid-column: 1 / -1;
`;

const ClosingRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[6]};
`;

/* -------------------------------------------------------------------------- */
/* Content                                                                     */
/* -------------------------------------------------------------------------- */

interface FocusItem {
  title: string;
  detail: string;
}

const FOCUS_AREAS: readonly FocusItem[] = [
  {
    title: 'LLM systems that survive review',
    detail:
      'Evaluation harnesses, retrieval architectures, and cost/latency ' +
      'budgets for teams moving AI features from demo to production — where ' +
      'the hard part is proving the answer is good enough, on purpose, ' +
      'continuously.',
  },
  {
    title: 'Data platforms sized to their teams',
    detail:
      'Warehouses, pipelines and storage engines matched to the people who ' +
      'will operate them. DuckDB when DuckDB is right; a warehouse when the ' +
      'concurrency says so; always the boring, observable choice first.',
  },
  {
    title: 'Front-end craft as an engineering discipline',
    detail:
      'Design-token systems, SSR/prerender pipelines, and accessibility ' +
      'treated like performance: measured, regression-tested, and owned by ' +
      'the same engineers who ship features.',
  },
];

const LEARNING: readonly string[] = [
  'Formalizing evaluation practice for retrieval systems — the gap between ' +
    'a good demo and a statistically defensible eval is where most AI ' +
    'projects quietly stall.',
  'Query-engine internals (DuckDB in particular): reading the execution ' +
    'engine makes better schema and file-layout decisions upstream.',
  'Writing more, in the open — turning repeated consulting answers into ' +
    'posts so the same advice is given once, properly.',
];

const AVAILABLE_FOR: readonly string[] = [
  'Technical due diligence and architecture reviews — a short, sharp ' +
    'engagement that ends in a written assessment your team can act on.',
  'Embedded consulting for data and platform work: 2–6 months, hands on ' +
    'keyboard, with an explicit handover plan from day one.',
  'Rescuing stalled AI/data projects: honest evaluation, a scoped path to ' +
    'production, or a credible recommendation to stop.',
  'Workshop-style knowledge transfer on evaluation, pipeline design, and ' +
    'production-readiness for engineering teams.',
];

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function Now(): React.ReactNode {
  return (
    <>
      <Section id="now-intro" eyebrow="Now" size="wide">
        <Heading level={1} data-testid="now-title" size="4xl">
          Last updated{' '}
          {/* R9A-3: machine-parseable freshness — agents get the as-of date
              from the datetime attribute, not prose. */}
          <time dateTime={newestContentDate ?? undefined}>{NOW_UPDATED}</time>
        </Heading>
        <Stamp data-testid="now-stamp">
          <Dot aria-hidden="true" />
          Updated when the picture changes — not on a calendar.
        </Stamp>
        <Intro>
          A standing answer to &ldquo;what are you working on these
          days?&rdquo; — published in the spirit of thenowpage.com, so you
          know what to expect from me before you email me.
        </Intro>
      </Section>

      <Section size="default" data-testid="now-panels">
        <Panels>
          <Panel aria-labelledby="now-focused-title">
            <PanelTitle id="now-focused-title">Focused areas</PanelTitle>
            <ItemList data-testid="now-focused">
              {FOCUS_AREAS.map((focus) => (
                <Item key={focus.title}>
                  <strong>{focus.title}.</strong> {focus.detail}
                </Item>
              ))}
            </ItemList>
          </Panel>

          <Panel aria-labelledby="now-learning-title">
            <PanelTitle id="now-learning-title">Currently learning</PanelTitle>
            <ItemList data-testid="now-learning">
              {LEARNING.map((line) => (
                <Item key={line}>{line}</Item>
              ))}
            </ItemList>
          </Panel>

          <FullPanel aria-labelledby="now-available-title">
            <PanelTitle id="now-available-title">Available for</PanelTitle>
            <ItemList data-testid="now-available">
              {AVAILABLE_FOR.map((line) => (
                <Item key={line}>{line}</Item>
              ))}
            </ItemList>
            {/* R9B-1: "Check availability" led to /contact, whose email is
                not live yet — a loop that ended in exit. One honest line so
                the click is informed about what happens there. */}
            <PanelNote data-testid="now-contact-note">
              Email contact is being wired up — the case studies on the
              projects page are the fastest proof of how this work runs in
              practice.
            </PanelNote>
            <ClosingRow>
              <Button as={ROUTER_LINK} to="/contact" variant="primary" data-testid="now-cta-contact">
                Check availability
              </Button>
              <Button as={ROUTER_LINK} to="/about" variant="ghost" data-testid="now-cta-about">
                Why this mix of work
              </Button>
            </ClosingRow>
          </FullPanel>
        </Panels>
      </Section>
    </>
  );
}

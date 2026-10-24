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
    title: 'Local AI a team can actually operate',
    detail:
      'A home lab of two RTX PRO 6000s, four DGX Sparks and an RTX 5090 ' +
      'serving open-weight models (GLM-5.3-Flash, DeepSeek-V4.1-Flash, ' +
      'Nemotron) behind one router — and open-sourcing the operator tools ' +
      'it needed: Engine Console and GPU Tuner.',
  },
  {
    title: 'Routing coding agents across models',
    detail:
      'A fast model answers first and an LLM judge sends the hard ' +
      'conversations to a bigger one. The work is measuring the answers, ' +
      'not the counters — Nemo Console (ten NVIDIA systems since 0.3.0) watches the routing layer.',
  },
  {
    title: 'Agents that stay contained and observable',
    detail:
      'Sandboxed agents with their own keys, a private chat server they ' +
      'reach me through, and every model call traced. Agent Hub keeps what ' +
      'each agent knows and may do in one reviewed place.',
  },
];

const LEARNING: readonly string[] = [
  'Multi-node inference on DGX Spark: tensor parallelism over ConnectX-7, ' +
    'speculative decoding, and the thermal limits of small boxes.',
  'Judge rubrics as a product: getting a routing judge to escalate the ' +
    'tasks the small model really cannot do, and nothing else.',
  'Writing more, in the open — turning what the lab measured into posts ' +
    'so the same lesson is written down once, properly.',
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
          know what to expect from me before you get in touch.
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
            <ClosingRow>
              <Button as={ROUTER_LINK} to="/contact" variant="primary" data-testid="now-cta-contact">
                Working together
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

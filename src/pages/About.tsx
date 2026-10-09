/**
 * About — the narrative profile: who I am, the toolkit, how I work.
 *
 * HONESTY RULE (CONTRACT §8): role-level descriptions only. No invented
 * employers, clients, or projects. The story is about the shape of the
 * career, not fabricated names in it.
 *
 * A11Y: one h1; sections are labelled landmarks with h2 headings via Section;
 * the skills grid is a real <dl> (term = category, definition = tool list).
 */
import styled from '@emotion/styled';
import { Link } from '@portfolio/router';
import { Button, Heading, Section, Stack } from 'app/components/ui';

/* Cast per the ui.test.tsx polymorphic-`as` pattern — see Home.tsx for the
 * full rationale (component target keeps `to`, routes through css() class). */
const ROUTER_LINK = Link as unknown as 'a';

/* -------------------------------------------------------------------------- */
/* Layout primitives                                                           */
/* -------------------------------------------------------------------------- */

const Lede = styled.p`
  margin: 0 0 ${(p) => p.theme.space[5]};
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const Paragraph = styled.p`
  margin: 0 0 ${(p) => p.theme.space[5]};
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};

  &:last-of-type {
    margin-bottom: 0;
  }

  strong {
    color: ${(p) => p.theme.color.text};
    font-weight: ${(p) => p.theme.font.weights.semibold};
  }
`;

const Figure = styled.aside`
  margin: ${(p) => `${p.theme.space[6]} 0`};
  padding: ${(p) => p.theme.space[5]};
  border-left: 3px solid ${(p) => p.theme.color.accent};
  background: ${(p) => p.theme.color.bgElevated};
  border-radius: 0 ${(p) => p.theme.radius.md} ${(p) => p.theme.radius.md} 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  font-style: italic;
  color: ${(p) => p.theme.color.textMuted};
`;

/* -------------------------------------------------------------------------- */
/* Skills                                                                      */
/* -------------------------------------------------------------------------- */

const SkillGrid = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};
  margin: ${(p) => p.theme.space[2]} 0 0;

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${(p) => `${p.theme.space[6]} ${p.theme.space[8]}`};
  }
`;

const SkillGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
`;

const SkillTerm = styled.dt`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};
`;

const SkillDefinition = styled.dd`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

/* -------------------------------------------------------------------------- */
/* How I work                                                                  */
/* -------------------------------------------------------------------------- */

const PrincipleList = styled.ol`
  list-style: none;
  counter-reset: principle;
  margin: ${(p) => p.theme.space[2]} 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[5]};
  max-width: 68ch;
`;

const Principle = styled.li`
  counter-increment: principle;
  position: relative;
  padding-left: ${(p) => `${p.theme.space[7]}`};

  &::before {
    content: counter(principle, decimal-leading-zero);
    position: absolute;
    left: 0;
    top: 0;
    font-family: ${(p) => p.theme.font.mono};
    font-size: ${(p) => p.theme.font.sizes.sm};
    font-weight: ${(p) => p.theme.font.weights.semibold};
    color: ${(p) => p.theme.color.accent};
  }

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    padding-left: ${(p) => `${p.theme.space[8]}`};
  }
`;

const PrincipleTitle = styled.p`
  margin: 0 0 ${(p) => p.theme.space[1]};
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const PrincipleBody = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

const ClosingRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[6]};
`;

/* -------------------------------------------------------------------------- */
/* Content data                                                                */
/* -------------------------------------------------------------------------- */

interface SkillArea {
  area: string;
  detail: string;
}

const SKILL_AREAS: readonly SkillArea[] = [
  {
    area: 'Languages',
    detail:
      'Python and TypeScript carry most of my production work; SQL is a first ' +
      'language, not an afterthought. Comfortable adding whatever the problem ' +
      'actually needs — Go for services, R for statistics, shell when it is ' +
      'honestly the right tool.',
  },
  {
    area: 'Frontend',
    detail:
      'React with TypeScript, component systems built on design tokens, ' +
      'server-rendering and prerendering, accessibility as an acceptance ' +
      'criterion. I care about the boring parts: state management, error ' +
      'surfaces, load behaviour on real connections.',
  },
  {
    area: 'Data',
    detail:
      'Analytics, feature pipelines, and model evaluation that would survive ' +
      'review. DuckDB and Postgres for storage, experiment design for ' +
      'decisions, and a healthy distrust of a metric that only moves in one ' +
      'demo.',
  },
  {
    area: 'Infrastructure',
    detail:
      'Containers, CI/CD, IaC, and observability that answers on-call ' +
      'questions at 3 a.m. Infrastructure is product surface: if the team ' +
      'cannot deploy it confidently on a Friday, it is not shipped.',
  },
];

interface Principle {
  title: string;
  body: string;
}

const PRINCIPLES: readonly Principle[] = [
  {
    title: 'Diagnose before prescribing',
    body:
      'The first deliverable on any engagement is a shared, honest picture of ' +
      'the problem — usually a short written one. Plans built on the wrong ' +
      'problem are the expensive kind of failure.',
  },
  {
    title: 'Prototype to answer, production to last',
    body:
      'Throwaway code is a tool, not a deliverable. Once a prototype has ' +
      'answered the question, the keepers get rewritten with tests, ' +
      'monitoring, and documentation before anyone calls it done.',
  },
  {
    title: 'Leave the team stronger',
    body:
      'Consulting that creates dependency is a retainer, not a result. Every ' +
      'handover includes the reasoning, not just the code — runbooks, decision ' +
      'logs, and pairing sessions while the context is still warm.',
  },
  {
    title: 'Numbers over vibes',
    body:
      'Every recommendation traces to a measurement: a latency histogram, an ' +
      'error budget, an evaluation curve. Where it cannot, I say so explicitly ' +
      'and treat the claim as provisional.',
  },
];

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function About(): React.ReactNode {
  return (
    <>
      <Section id="intro" eyebrow="About" size="wide">
        <Heading level={1} data-testid="about-title" size="4xl">
          Consultant by title, engineer by habit.
        </Heading>
        <Stack gap="4" className="lede-block">
          <Lede>
            I am William Boyden — a technical consultant who came through
            full-stack web engineering and a data-science degree, and who still
            writes the code he recommends.
          </Lede>
          <Paragraph>
            My path is the one I recommend to teams hiring for the fuzzy
            boundary between &ldquo;data&rdquo; and &ldquo;engineering&rdquo;:
            I started building web applications — interfaces, APIs, the whole
            request-to-database loop — and went back for a{' '}
            <strong>B.S. in Data Science</strong> because I kept meeting
            problems where the interesting decision was statistical, not
            structural. That order matters. I learned to build first, so when
            an analysis says &ldquo;deploy this model,&rdquo; I know exactly
            what deploying it costs.
          </Paragraph>
          <Paragraph>
            Today I work as a <strong>technical consultant</strong>: embedded
            with engineering and data teams long enough to feel their pain,
            short enough to keep asking the naive questions they stopped
            asking. Engagements usually run the same arc — diagnose the real
            constraint, prototype against it, then engineer the survivor into
            production alongside the people who will own it after I leave.
          </Paragraph>
          <Figure>
            The most useful sentence in consulting is not &ldquo;trust me,
            I&rsquo;ve done this before.&rdquo; It is &ldquo;here is how you
            will know I was wrong.&rdquo;
          </Figure>
          <Paragraph>
            What I am good at, specifically: translating between layers.
            Explaining a recall/precision tradeoff to the team shipping the
            feature. Explaining a latency budget to the model. Turning a
            half-formed &ldquo;can AI do this for us?&rdquo; into a scoped,
            testable plan — and then being accountable for the numbers in it.
          </Paragraph>
        </Stack>
      </Section>

      <Section
        id="toolkit"
        eyebrow="Toolkit"
        title="What I actually reach for"
        description="Tools are choices with consequences. These are mine, grouped the way problems arrive — not as an endorsement list."
      >
        <SkillGrid data-testid="about-skills">
          {SKILL_AREAS.map((group) => (
            <SkillGroup key={group.area}>
              <SkillTerm>{group.area}</SkillTerm>
              <SkillDefinition>{group.detail}</SkillDefinition>
            </SkillGroup>
          ))}
        </SkillGrid>
      </Section>

      <Section
        id="how-i-work"
        eyebrow="Method"
        title="How I work"
        description="Four rules that have survived every engagement so far. They are also what you should hold me to."
      >
        <PrincipleList data-testid="about-principles">
          {PRINCIPLES.map((principle) => (
            <Principle key={principle.title}>
              <PrincipleTitle>{principle.title}</PrincipleTitle>
              <PrincipleBody>{principle.body}</PrincipleBody>
            </Principle>
          ))}
        </PrincipleList>
        <ClosingRow>
          <Button as={ROUTER_LINK} to="/contact" variant="primary" data-testid="about-cta-contact">
            Start a conversation
          </Button>
          <Button as={ROUTER_LINK} to="/now" variant="ghost" data-testid="about-cta-now">
            What I&rsquo;m focused on now
          </Button>
        </ClosingRow>
      </Section>
    </>
  );
}

/**
 * Contact — the conversion page: one primary route (LinkedIn), the public
 * code (GitHub), and what working together actually looks like.
 *
 * NO FAKE FORM: there is no backend in this stack (static hosting, no
 * server) and CONTRACT §8 forbids pretending otherwise. A form that silently
 * went nowhere would be worse than none. The owner publishes no email
 * address (decision 2026-10-24), so the primary CTA is a LinkedIn message.
 *
 * A11Y: one h1; labelled regions; every link has a visible focus ring;
 * external links name their destination in visible text.
 */
import styled from '@emotion/styled';
import { Link } from '@portfolio/router';
import { SOCIAL_LINKS } from 'app/components/layout';
import { content } from 'app/content';
import { Button, Heading, Icon, Section, type IconName } from 'app/components/ui';
import { dataText, titleLink } from 'app/theme/mixins';

/* Cast per the ui.test.tsx polymorphic-`as` pattern — see Home.tsx. */
const ROUTER_LINK = Link as unknown as 'a';

/** The primary contact route and the public code, from the one social list
 * the footer also renders (Footer.tsx SOCIAL_LINKS). */
const LINKEDIN = SOCIAL_LINKS.find((link) => link.label === 'LinkedIn' && link.url !== '');
const OTHER_PROFILES = SOCIAL_LINKS.filter((link) => link.url !== '' && link !== LINKEDIN);

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

const Lede = styled.p`
  margin: ${(p) => p.theme.space[4]} 0 0;
  max-width: 34em;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: 1.45;
  color: ${(p) => p.theme.color.text};
`;

const CardRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[6]};
  align-items: start;

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${(p) => p.theme.space[7]};
  }
`;

/* Two open columns, each under its own rule: where to write, where the work is. */
const Panel = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes['2xl']};
  line-height: ${(p) => p.theme.font.leading.snug};
  color: ${(p) => p.theme.color.text};
`;

const PanelBody = styled.p`
  margin: 0;
  max-width: 56ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[3]};
`;

const SocialList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${(p) => p.theme.color.border};
`;

const SocialItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  min-height: 44px;
  font-size: ${(p) => p.theme.font.sizes.md};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
`;

const SocialAnchor = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  color: ${(p) => p.theme.color.text};
  text-decoration: none;
  border-radius: ${(p) => p.theme.radius.sm};

  &:hover {
    background: ${(p) => p.theme.color.mark};
    color: ${(p) => p.theme.color.markInk};
    text-decoration: none;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 3px;
  }
`;

const ExpectList = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: ${(p) => p.theme.space[6]};
  }
`;

const ExpectGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  padding-top: ${(p) => p.theme.space[3]};
  border-top: 1px solid ${(p) => p.theme.color.borderStrong};
`;

const ExpectTerm = styled.dt`
  margin: 0;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const ExpectBody = styled.dd`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

/* R8C-2: a buyer could not tell what to actually hire him FOR — skills were
 * implicit. This list names the service areas using the site's own verified
 * content (the AI-engineering capabilities), never invented offerings. */
const HiredList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]} ${(p) => p.theme.space[7]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const HiredItem = styled.li`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[1]};
  padding-top: ${(p) => p.theme.space[3]};
  border-top: 1px solid ${(p) => p.theme.color.borderStrong};
`;

const HiredLink = styled.a`
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  line-height: ${(p) => p.theme.font.leading.snug};
  ${(p) => titleLink(p.theme)}
`;

const HiredBody = styled.span`
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

/* R8C-6: maturity label — 'in-progress' services are labelled, never passed
 * off as shipped. Same status language as the project entries. */
const StatusChip = styled.span`
  margin-left: ${(p) => p.theme.space[2]};
  padding: ${(p) => `${p.theme.space['0']} ${p.theme.space[2]}`};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.normal};
  color: ${(p) => p.theme.color.textMuted};
  background: ${(p) => p.theme.color.bgSunken};
  border-radius: ${(p) => p.theme.radius.sm};
  white-space: nowrap;
  vertical-align: middle;
`;

/* Map platform labels to the icon set we actually ship. */
function socialIcon(label: string): IconName {
  if (label.toLowerCase().includes('github')) return 'github';
  if (label.toLowerCase().includes('linkedin')) return 'linkedin';
  return 'external-link';
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function Contact(): React.ReactNode {
  return (
    <>
      <Section id="contact-intro" eyebrow="Contact" size="wide">
        <Heading level={1} data-testid="contact-title" size="4xl">
          Tell me what is broken.
        </Heading>
        <Lede>
          The best first message is a paragraph of unpolished context: the system, the constraint, the deadline you are
          worried about. I read everything myself and I always reply, even when the answer is a no or a referral.
        </Lede>
      </Section>

      <Section id="reach" title="Where to write" data-testid="contact-panels">
        <CardRow>
          {LINKEDIN && (
            <Panel aria-labelledby="contact-primary-title">
              <PanelTitle id="contact-primary-title">LinkedIn</PanelTitle>
              <PanelBody>
                The fastest route for everything: engagements, architecture reviews, or a hard question you want a
                second opinion on. Include a link to context (a repo, a doc, an incident timeline) and I will come
                prepared.
              </PanelBody>
              <CtaRow>
                <Button
                  as="a"
                  href={LINKEDIN.url}
                  target="_blank"
                  rel="me noopener noreferrer"
                  variant="primary"
                  size="lg"
                  iconRight="arrow-right"
                  data-testid="contact-cta-linkedin"
                >
                  Message me on LinkedIn
                </Button>
              </CtaRow>
            </Panel>
          )}

          {OTHER_PROFILES.length > 0 && (
            <Panel aria-labelledby="contact-social-title">
              <PanelTitle id="contact-social-title">The code and models</PanelTitle>
              <PanelBody>
                The open-source tools on this site (Engine Console, Nemo Console, GPU Tuner, Agent Hub) live on GitHub
                with their docs, tests and release notes. The models I quantize and publish are on Hugging Face.
              </PanelBody>
              <SocialList data-testid="contact-social-list">
                {OTHER_PROFILES.map((link) => (
                  <SocialItem key={link.label}>
                    <SocialAnchor href={link.url} target="_blank" rel="me noopener noreferrer">
                      <Icon name={socialIcon(link.label)} size={16} />
                      {link.label}
                      {link.handle ? ` — ${link.handle}` : ''}
                    </SocialAnchor>
                  </SocialItem>
                ))}
              </SocialList>
            </Panel>
          )}
        </CardRow>
      </Section>

      <Section id="hired-for" title="What I'm hired for" description="Each one links to the work behind it.">
        <HiredList data-testid="contact-hired-for">
          {/* R8C-7: the tech-stack inventory is an inventory page, not a
           * hireable service — only capabilities that name an engagement
           * shape belong here. R8C-6: in-progress work carries its status
           * chip so a buyer is never misled about maturity. */}
          {content.aiCapabilities
            .filter((cap) => cap.slug !== 'tech-stack')
            .map((cap) => (
              <HiredItem key={cap.slug}>
                <HiredLink
                  as={ROUTER_LINK}
                  to={`/ai-engineering/${cap.slug}`}
                  data-testid={`contact-hired-${cap.slug}`}
                >
                  {cap.title}
                  {cap.status === 'in-progress' && (
                    <StatusChip data-testid={`contact-hired-${cap.slug}-status`}>in progress</StatusChip>
                  )}
                </HiredLink>
                <HiredBody>{cap.summary}</HiredBody>
              </HiredItem>
            ))}
          <HiredItem>
            <HiredLink as={ROUTER_LINK} to="/projects" data-testid="contact-hired-projects">
              Full-stack builds &amp; data platforms
            </HiredLink>
            <HiredBody>
              Design, build and handover of the systems around the models. The case studies on the projects page are the
              evidence.
            </HiredBody>
          </HiredItem>
        </HiredList>
      </Section>

      <Section id="expectations" title="What to expect" description="Three commitments that hold on every engagement.">
        <ExpectList data-testid="contact-expectations">
          <ExpectGroup>
            <ExpectTerm>A straight reply</ExpectTerm>
            <ExpectBody>
              A considered response, including when the answer is that I am not the right person for it.
            </ExpectBody>
          </ExpectGroup>
          <ExpectGroup>
            <ExpectTerm>Fixed scope, written down</ExpectTerm>
            <ExpectBody>
              Before work starts: the question, the deliverable, and what &ldquo;done&rdquo; means, in one page. If
              scope changes, the page changes with it.
            </ExpectBody>
          </ExpectGroup>
          <ExpectGroup>
            <ExpectTerm>Handover included</ExpectTerm>
            <ExpectBody>Every engagement ends with the team able to run and extend the result without me.</ExpectBody>
          </ExpectGroup>
        </ExpectList>
        <CtaRow>
          <Button as={ROUTER_LINK} to="/projects" variant="ghost" data-testid="contact-cta-projects">
            See the work first
          </Button>
          <Button as={ROUTER_LINK} to="/now" variant="ghost" data-testid="contact-cta-now">
            Current availability
          </Button>
        </CtaRow>
      </Section>
    </>
  );
}

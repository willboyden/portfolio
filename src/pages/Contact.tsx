/**
 * Contact — the conversion page: one honest email CTA, the real social
 * slots, and what working together actually looks like.
 *
 * NO FAKE FORM: there is no backend in this stack (static nginx, no server,
 * no network egress) and CONTRACT §8 forbids pretending otherwise. A form
 * that silently went nowhere would be worse than none. The deliverable is a
 * mailto: CTA — it composes in the visitor's own client, works with zero
 * infrastructure, and degrades honestly. If a real form is ever added, it
 * needs a documented form backend first.
 *
 * A11Y: one h1; labelled regions; every link has a visible focus ring; the
 * email address is present as real text, not trapped inside a button label.
 */
import styled from '@emotion/styled';
import { Link } from '@portfolio/router';
import { SOCIAL_LINKS } from 'app/components/layout';
import { SITE } from 'app/lib/seo';
import { content } from 'app/content';
import { Button, Heading, Icon, Section, type IconName } from 'app/components/ui';

/* Cast per the ui.test.tsx polymorphic-`as` pattern — see Home.tsx. */
const ROUTER_LINK = Link as unknown as 'a';

/* DRAFT — launch blocker (R2-A A1): SITE carries no `email` field yet. Until
 * the owner sets SITE.email, the page renders an honest "set up email" state —
 * NEVER a fabricated hello@example.com, which on a hiring site reads as either
 * broken or fake. Set `email` in src/lib/seo.ts SITE to enable the mailto UI. */
const CONTACT_EMAIL: string | null = (SITE as { email?: string }).email ?? null;

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

const Lede = styled.p`
  margin: ${(p) => p.theme.space[5]} 0 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

const CardRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};
  align-items: stretch;
  margin-top: ${(p) => p.theme.space[6]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Panel = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => p.theme.space[6]};
  background: ${(p) => p.theme.color.bgElevated};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
`;

const EmailPanel = styled(Panel)`
  border-color: ${(p) => p.theme.color.accentBorder};
  background: ${(p) => p.theme.color.surface};
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const PanelBody = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

const AddressLine = styled.a`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.md};
  color: ${(p) => p.theme.color.accent};
  text-decoration: none;
  border-radius: ${(p) => p.theme.radius.sm};
  padding-block: ${(p) => p.theme.space[1]};

  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 3px;
  }
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[2]};
`;

const SocialList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
`;

const SocialItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  min-height: 44px;
  font-size: ${(p) => p.theme.font.sizes.md};
`;

const SocialAnchor = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  color: ${(p) => p.theme.color.text};
  text-decoration: none;
  border-radius: ${(p) => p.theme.radius.sm};

  &:hover {
    color: ${(p) => p.theme.color.accent};
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 3px;
  }
`;

const ExpectList = styled.dl`
  margin: ${(p) => p.theme.space[2]} 0 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[4]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: ${(p) => p.theme.space[6]};
  }
`;

const ExpectGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
`;

const ExpectTerm = styled.dt`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};
`;

const ExpectBody = styled.dd`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;

/* R8C-2: a buyer could not tell what to actually hire him FOR — skills were
 * implicit. This grid names the service areas using the site's own verified
 * content (the AI-engineering capabilities), never invented offerings. */
const HiredList = styled.ul`
  list-style: none;
  margin: ${(p) => p.theme.space[2]} 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[4]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const HiredItem = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
  padding: ${(p) => p.theme.space[4]};
  background: ${(p) => p.theme.color.bgElevated};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
`;

const HiredLink = styled.a`
  font-size: ${(p) => p.theme.font.sizes.md};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};
  text-decoration: none;
  border-radius: ${(p) => p.theme.radius.sm};

  &:hover {
    color: ${(p) => p.theme.color.accent};
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;

const HiredBody = styled.span`
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
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
  const contactEmail = CONTACT_EMAIL;
  return (
    <>
      <Section id="contact-intro" eyebrow="Contact" size="wide">
        <Heading level={1} data-testid="contact-title" size="4xl">
          Tell me what is actually broken.
        </Heading>
        <Lede>
          The best first email is a paragraph of unpolished context: the
          system, the constraint, the deadline you are worried about. I read
          everything myself, and a concrete &ldquo;no&rdquo; or a referral is
          a real answer — you will never be left in silence.
        </Lede>
      </Section>

      <Section size="default" data-testid="contact-panels">
        <CardRow>
          <EmailPanel aria-labelledby="contact-email-title">
            <PanelTitle id="contact-email-title">Email</PanelTitle>
            <PanelBody>
              The fastest route for everything: engagements, architecture
              reviews, or a hard question you want a second opinion on.
              Include a link to context — a repo, a doc, an incident timeline
              — and I will come prepared instead of billable for warm-up.
            </PanelBody>
            {contactEmail ? (
              <>
                <AddressLine href={`mailto:${contactEmail}`} data-testid="contact-email-link">
                  <Icon name="mail" size={16} />
                  {contactEmail}
                </AddressLine>
                <CtaRow>
                  <Button
                    as="a"
                    href={`mailto:${contactEmail}`}
                    variant="primary"
                    size="lg"
                    iconRight="arrow-right"
                    data-testid="contact-cta-email"
                  >
                    Start the conversation
                  </Button>
                </CtaRow>
              </>
            ) : (
              /* R2-A A1: never a fabricated mailbox. Honest state until
               * SITE.email is set (src/lib/seo.ts). R8C-1: the state now
               * says what IS possible instead of only what is missing. */
              <PanelBody data-testid="contact-email-unset">
                Email is the fastest channel and it is being wired up — not
                live yet, and I won&rsquo;t park a dead address here. The work
                on this site is real and current: the case studies below and
                the <strong>Now</strong> page show exactly what I am doing
                this quarter. {/* DRAFT: set SITE.email in src/lib/seo.ts */}
              </PanelBody>
            )}
          </EmailPanel>

          {/* R6-B recipe (footer Elsewhere): an unconfigured column renders
           * nothing rather than an empty box. All socials are unset today —
           * the panel returns the moment one has a real URL. */}
          {SOCIAL_LINKS.some((link) => link.url) && (
            <Panel aria-labelledby="contact-social-title">
              <PanelTitle id="contact-social-title">Elsewhere</PanelTitle>
              <PanelBody>
                Where the work shows up before it shows up here. Slower than
                email, better for follow-ups than for first contact.
              </PanelBody>
              <SocialList data-testid="contact-social-list">
                {SOCIAL_LINKS.filter((link) => link.url).map((link) => (
                  <SocialItem key={link.label}>
                    <SocialAnchor href={link.url} rel="me noopener noreferrer">
                      <Icon name={socialIcon(link.label)} size={16} />
                      {link.label}
                      {link.handle ? ` — ${link.handle}` : ''}
                    </SocialAnchor>
                  </SocialItem>
                ))}
                {/* R2-A A1/A12: unconfigured profiles are HIDDEN, never rendered
                    as "@your-handle" or developer instructions — placeholder text
                    on a hiring site reads as template/tampered. Add urls to
                    SOCIAL_LINKS in Footer.tsx (exported) before launch. */}
              </SocialList>
            </Panel>
          )}
        </CardRow>
      </Section>

      <Section
        id="hired-for"
        eyebrow="Services"
        title="What I'm hired for"
        description="The engagement shapes behind the case studies — each one links to the work that proves it."
      >
        <HiredList data-testid="contact-hired-for">
          {content.aiCapabilities.map((cap) => (
            <HiredItem key={cap.slug}>
              <HiredLink
                as={ROUTER_LINK}
                to={`/ai-engineering/${cap.slug}`}
                data-testid={`contact-hired-${cap.slug}`}
              >
                {cap.title}
              </HiredLink>
              <HiredBody>{cap.summary}</HiredBody>
            </HiredItem>
          ))}
          <HiredItem>
            <HiredLink as={ROUTER_LINK} to="/projects" data-testid="contact-hired-projects">
              Full-stack builds &amp; data platforms
            </HiredLink>
            <HiredBody>
              Design, build and handover of the systems around the models —
              the case studies on the projects page are the evidence.
            </HiredBody>
          </HiredItem>
        </HiredList>
      </Section>

      <Section
        id="expectations"
        eyebrow="Working together"
        title="What to expect"
        description="No sales sequence, no discovery-call gauntlet. Three commitments that hold on every engagement."
      >
        <ExpectList data-testid="contact-expectations">
          <ExpectGroup>
            <ExpectTerm>Reply, honestly</ExpectTerm>
            <ExpectBody>
              A considered response — including when the answer is that I am
              not the right person for it. Silence is the failure mode I
              promise to avoid.
            </ExpectBody>
          </ExpectGroup>
          <ExpectGroup>
            <ExpectTerm>Fixed scope, written down</ExpectTerm>
            <ExpectBody>
              Before work starts: the question, the deliverable, and what
              &ldquo;done&rdquo; means, in one page. If scope changes, the
              page changes — visibly.
            </ExpectBody>
          </ExpectGroup>
          <ExpectGroup>
            <ExpectTerm>Handover included</ExpectTerm>
            <ExpectBody>
              Every engagement ends with the team able to run and extend the
              result without me. Dependency is a defect, not a business model.
            </ExpectBody>
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

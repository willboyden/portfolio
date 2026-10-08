/**
 * Talks — speaking history as a list of expandable cards: event, date,
 * location, abstract behind a native <details>/<summary> (keyboard-usable
 * with zero JS, works prerendered, and toggles are announced), plus slides /
 * video links when present (external, rel="noopener noreferrer").
 *
 * Native <details> is deliberate: no fake accordion, no aria-expanded lying
 * about a state we don't own — the browser keeps the disclosure semantics and
 * the summary is a real focusable control.
 *
 * A11Y: one h1; each talk is an <li> whose summary carries the event + title;
 * slides/video anchors get the external icon and a VisuallyHidden "opens in a
 * new tab" suffix; dates are <time datetime> so ATs get the machine date.
 */
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { content, type Talk } from 'app/content';
import type { Tokens } from 'app/theme/tokens';
import { formatDate, pluralize } from 'app/lib/format';
import { EmptyState, Heading, Icon, VisuallyHidden } from 'app/components/ui';

/* -------------------------------------------------------------------------- */
/* Pure, unit-tested helper                                                    */
/* -------------------------------------------------------------------------- */

/** Newest-first (ISO dates sort lexically; title breaks ties). */
export function talksByDate(all: readonly Talk[]): Talk[] {
  return [...all].sort(
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)),
  );
}

/** Which of slides/video are present, in render order. */
export function talkResourceEntries(
  talk: Talk,
): { kind: 'slides' | 'video'; url: string }[] {
  const entries: { kind: 'slides' | 'video'; url: string }[] = [];
  if (talk.slidesUrl) entries.push({ kind: 'slides', url: talk.slidesUrl });
  if (talk.videoUrl) entries.push({ kind: 'video', url: talk.videoUrl });
  return entries;
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

const TalkList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
`;

const TalkItem = styled.li`
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
  background: ${(p) => p.theme.color.surface};
  box-shadow: ${(p) => p.theme.shadow.sm};
`;

/* Native disclosure, styled — summary is the only interactive child. */
const Disclosure = styled.details`
  & > summary {
    cursor: pointer;
    list-style: none;
    padding: ${(p) => `${p.theme.space[4]} ${p.theme.space[5]}`};
    border-radius: ${(p) => p.theme.radius.lg};
    display: grid;
    gap: ${(p) => p.theme.space[2]};
    transition: background ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

    &::-webkit-details-marker {
      display: none;
    }

    &:hover {
      background: ${(p) => p.theme.color.surfaceHover};
    }

    &:focus-visible {
      outline: 2px solid ${(p) => p.theme.color.focus};
      outline-offset: -2px;
    }
  }

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    & > summary {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: baseline;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    & > summary {
      transition: none;
    }
  }
`;

const SummaryMain = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
  min-width: 0;
`;

const EventName = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};
`;

const TalkTitle = styled.span`
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const SummaryAside = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    justify-content: end;
  }
`;

/* The chevron follows the native disclosure state via `details[open]` — no JS,
 * no aria-expanded to lie about. Decorative (aria-hidden), summary is the
 * real control. */
const Chevron = styled.span`
  display: inline-block;
  color: ${(p) => p.theme.color.textSubtle};
  transform: rotate(0deg);
  transition: transform ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  details[open] > summary & {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Body = styled.div`
  padding: ${(p) => `0 ${p.theme.space[5]} ${p.theme.space[5]}`};
  border-top: 1px solid ${(p) => p.theme.color.border};
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
`;

const Abstract = styled.div`
  margin: ${(p) => p.theme.space[4]} 0 0;
  max-width: 68ch;
  white-space: pre-line;
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.normal};
`;

const ResourceRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
`;

function resourceLinkClass(theme: Tokens): string {
  return css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.space[2],
    minHeight: '44px',
    padding: `${theme.space['1']} ${theme.space['3']}`,
    fontFamily: theme.font.sans,
    fontSize: theme.font.sizes.sm,
    fontWeight: theme.font.weights.semibold,
    color: theme.color.accent,
    textDecoration: 'none',
    border: `1px solid ${theme.color.accentBorder}`,
    borderRadius: theme.radius.md,
    '&:hover': { background: theme.color.accentSoft },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '2px' },
  });
}

function TalkCard({ talk }: { talk: Talk }): React.ReactNode {
  const theme = useTheme() as Tokens;
  const resources = talkResourceEntries(talk);
  return (
    <TalkItem data-testid="talk-card">
      <Disclosure>
        <summary data-testid="talk-summary">
          <SummaryMain>
            <EventName>{talk.event}</EventName>
            <TalkTitle>{talk.title}</TalkTitle>
          </SummaryMain>
          <SummaryAside>
            <time dateTime={talk.date}>{formatDate(talk.date)}</time>
            <span aria-hidden="true">·</span>
            <span>{talk.location}</span>
            <Chevron aria-hidden="true">
              <Icon name="chevron-right" size={16} />
            </Chevron>
          </SummaryAside>
        </summary>
        <Body>
          <Abstract data-testid="talk-abstract">{talk.abstract}</Abstract>
          {resources.length > 0 && (
            <ResourceRow aria-label="Talk resources" data-testid="talk-resources">
              {resources.map((entry) => (
                <a
                  key={entry.kind}
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={resourceLinkClass(theme)}
                  data-testid={`talk-${entry.kind}-link`}
                >
                  <Icon name={entry.kind === 'slides' ? 'download' : 'play'} size={16} />
                  {entry.kind === 'slides' ? 'Slides' : 'Watch'}
                  <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
                </a>
              ))}
            </ResourceRow>
          )}
        </Body>
      </Disclosure>
    </TalkItem>
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

const MetaLine = styled.p`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

export function Talks(): React.ReactNode {
  const talks = talksByDate(content.talks);

  return (
    <>
      <PageHeader>
        <Heading level={1} data-testid="talks-title">
          Talks
        </Heading>
        <Lede>
          Where I have spoken, what I said, and the slides that carried it. Each entry expands to
          the abstract; slides and recordings link out when they exist.
        </Lede>
        {talks.length > 0 && (
          <MetaLine role="status" data-testid="talks-count">
            {pluralize(talks.length, 'talk', 'talks')}.
          </MetaLine>
        )}
      </PageHeader>

      {talks.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No talks listed yet"
          description="Past and upcoming appearances show up here. Reach out if you would like me to speak."
        />
      ) : (
        <TalkList>
          {talks.map((talk) => (
            <TalkCard key={talk.slug} talk={talk} />
          ))}
        </TalkList>
      )}
    </>
  );
}

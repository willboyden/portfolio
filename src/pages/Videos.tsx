/**
 * Videos — the video library. Honest links, not fake players: every row is an
 * external anchor (target="_blank", rel="noopener noreferrer") to the host —
 * no embed placeholders that pretend to play (a dead play button is the
 * classic portfolio lie; the brief bans fake embed players outright).
 *
 * Grouping: videos dated in the FUTURE are "Upcoming" (premiere/announced
 * slots), the rest are "Past videos", newest first. "Today" is pinned to UTC
 * (src/lib/format.ts posture — the prerendered shell and the hydrated client
 * must agree), and the cutoff is passed INTO the pure helper (`splitByDate`)
 * so unit tests are deterministic.
 *
 * A11Y: one h1; groups are landmark sections named by h2s; the provider badge
 * is text (never colour-only); each row's title is a real anchor carrying the
 * external affordance + a VisuallyHidden "opens in a new tab" suffix; focus
 * rings come from the token palette.
 */
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { content, type Video } from 'app/content';
import type { Tokens } from 'app/theme/tokens';
import { formatDate, pluralize } from 'app/lib/format';
import { EmptyState, Heading, Icon, Tag, VisuallyHidden } from 'app/components/ui';

/* -------------------------------------------------------------------------- */
/* Pure, unit-tested helpers                                                   */
/* -------------------------------------------------------------------------- */

/** Newest-first order (ISO dates sort lexically; title breaks ties). */
export function videosByDate(all: readonly Video[]): Video[] {
  return [...all].sort(
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)),
  );
}

/**
 * Split into (upcoming, past) around `todayIso` (inclusive: a video premiering
 * TODAY is upcoming). `todayIso` is a parameter — never Date.now() inside —
 * so prerender output is reproducible and unit tests are deterministic.
 */
export function splitByDate(
  all: readonly Video[],
  todayIso: string,
): { upcoming: Video[]; past: Video[] } {
  const sorted = videosByDate(all);
  return {
    upcoming: sorted.filter((v) => v.date >= todayIso),
    past: sorted.filter((v) => v.date < todayIso),
  };
}

/** Display label for the provider badge. */
export function providerLabel(provider: Video['provider']): string {
  return provider === 'youtube' ? 'YouTube' : provider === 'vimeo' ? 'Vimeo' : 'Other';
}

/** TODAY under UTC — zone-pinned so server and client group identically. */
export function todayUtcIso(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* -------------------------------------------------------------------------- */
/* Row                                                                         */
/* -------------------------------------------------------------------------- */

const GroupSection = styled.section`
  padding-block: ${(p) => p.theme.space[6]};

  &:not(:last-of-type) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;

const GroupTitle = styled.h2`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-size: ${(p) => p.theme.font.sizes['2xl']};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.tight};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const VideoList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const VideoRow = styled.li`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[4]};
  padding-block: ${(p) => p.theme.space[4]};
  flex-wrap: wrap;

  &:not(:last-child) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;

const RowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  min-width: 0;
  flex: 1 1 auto;
`;

const TitleRow = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
`;

const Summary = styled.p`
  margin: 0;
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

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

const DurationBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;

const RowAside = styled.div`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  flex: none;
`;

/* External anchors take css() classes (not styled() of the router Link — that
 * pitfall is documented in Nav.tsx; plain <a> would also be fine here). */
function videoTitleClass(theme: Tokens): string {
  return css({
    color: theme.color.text,
    textDecoration: 'none',
    borderRadius: theme.radius.sm,
    display: 'inline',
    '&:hover': {
      color: theme.color.accent,
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '3px' },
  });
}

const InlineIcon = styled.span`
  display: inline-flex;
  align-items: center;
  vertical-align: -0.15em;
  color: ${(p) => p.theme.color.accent};
`;

export function VideoRowItem({ video }: { video: Video }): React.ReactNode {
  const theme = useTheme() as Tokens;
  return (
    <VideoRow data-testid="video-row">
      <RowMain>
        <TitleRow>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className={videoTitleClass(theme)}
            data-testid="video-link"
          >
            <InlineIcon>
              <Icon name="play" size={16} />
            </InlineIcon>{' '}
            {video.title}
            <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
          </a>
        </TitleRow>
        <Summary>{video.summary}</Summary>
        <MetaLine>
          <span>{formatDate(video.date)}</span>
          {video.event && (
            <>
              <span aria-hidden="true">·</span>
              <span>{video.event}</span>
            </>
          )}
          {video.speakers && video.speakers.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{video.speakers.join(', ')}</span>
            </>
          )}
        </MetaLine>
      </RowMain>
      <RowAside>
        <Tag size="sm" tone="outline" data-testid="video-provider">
          {providerLabel(video.provider)}
        </Tag>
        <DurationBadge data-testid="video-duration">
          <Icon name="clock" size={14} />
          {video.duration}
        </DurationBadge>
      </RowAside>
    </VideoRow>
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

export function Videos(): React.ReactNode {
  const { upcoming, past } = splitByDate(content.videos, todayUtcIso());
  const total = content.videos.length;

  return (
    <>
      <PageHeader>
        <Heading level={1} data-testid="videos-title">
          Videos
        </Heading>
        <Lede>
          Conference talks, meet-up demos, and interviews — every entry links out to the host
          where it actually plays.
        </Lede>
        {total > 0 && (
          <MetaLine role="status" data-testid="videos-count">
            {pluralize(total, 'video')} in the library.
          </MetaLine>
        )}
      </PageHeader>

      {total === 0 ? (
        <EmptyState
          icon="play"
          title="No videos yet"
          description="Recording links land here as talks and demos go up. Nothing to watch today."
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <GroupSection aria-labelledby="videos-upcoming-title" data-testid="videos-upcoming">
              <GroupTitle id="videos-upcoming-title">Upcoming</GroupTitle>
              <VideoList>
                {upcoming.map((video) => (
                  <VideoRowItem key={video.slug} video={video} />
                ))}
              </VideoList>
            </GroupSection>
          )}
          {past.length > 0 && (
            <GroupSection aria-labelledby="videos-past-title" data-testid="videos-past">
              <GroupTitle id="videos-past-title">Past videos</GroupTitle>
              <VideoList>
                {past.map((video) => (
                  <VideoRowItem key={video.slug} video={video} />
                ))}
              </VideoList>
            </GroupSection>
          )}
        </>
      )}
    </>
  );
}

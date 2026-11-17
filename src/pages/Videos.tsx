/**
 * Videos — the video library. Honest links, not fake players: every row is an
 * external anchor (target="_blank", rel="noopener noreferrer") to the host —
 * no embed placeholders that pretend to play (a dead play button is the
 * classic portfolio lie; the brief bans fake embed players outright).
 *
 * Grouping: videos dated in the FUTURE are "Upcoming" (premiere/announced
 * slots), the rest are "Past recordings", newest first. "Today" is pinned to UTC
 * (src/lib/format.ts posture — the prerendered shell and the hydrated client
 * must agree), and the cutoff is passed INTO the pure helper (`splitByDate`)
 * so unit tests are deterministic.
 *
 * A11Y: one h1; groups are landmark sections named by h2s; the provider badge
 * is text (never colour-only); each row's title is a real anchor carrying the
 * external affordance + a VisuallyHidden "opens in a new tab" suffix; focus
 * rings come from the token palette.
 */
import { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { css, useTheme } from '@emotion/react';
import { content, type Video } from 'app/content';
import type { Tokens } from 'app/theme/tokens';
import { formatDate, pluralize } from 'app/lib/format';
import { todayUtcIso, useToday } from 'app/lib/today';
import { sameOriginPath, withBase } from 'app/lib/seo';
import { EmptyState, Heading, Icon, Tag, VisuallyHidden } from 'app/components/ui';

/* -------------------------------------------------------------------------- */
/* Pure, unit-tested helpers                                                   */
/* -------------------------------------------------------------------------- */

/** Newest-first order (ISO dates sort lexically; title breaks ties). */
export function videosByDate(all: readonly Video[]): Video[] {
  return [...all].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));
}

/**
 * Split into (upcoming, past) around `todayIso` (inclusive: a video premiering
 * TODAY is upcoming). `todayIso` is a parameter — never Date.now() inside —
 * so prerender output is reproducible and unit tests are deterministic.
 */
export function splitByDate(all: readonly Video[], todayIso: string): { upcoming: Video[]; past: Video[] } {
  const sorted = videosByDate(all);
  return {
    upcoming: sorted.filter((v) => v.date >= todayIso),
    past: sorted.filter((v) => v.date < todayIso),
  };
}

/** Display label for the provider badge. */
export function providerLabel(provider: Video['provider']): string {
  switch (provider) {
    case 'youtube':
      return 'YouTube';
    case 'vimeo':
      return 'Vimeo';
    case 'podcast':
      return 'Podcast';
    case 'audio':
      return 'Audio';
    default:
      return 'Other';
  }
}

/**
 * The row's badge. A row that is a video first, with its audio offered as a
 * podcast version beside it, says "Video"; otherwise the provider names it.
 */
export function rowKindLabel(video: Pick<Video, 'provider' | 'videoUrl'>): string {
  return video.provider === 'audio' && video.videoUrl ? 'Video' : providerLabel(video.provider);
}

/** What an audio row's download link offers, in the visitor's words. */
export function downloadLabel(video: Pick<Video, 'provider' | 'videoUrl'>): string {
  if (video.provider === 'podcast') return 'Download episode (MP3)';
  return video.videoUrl ? 'Download podcast version (MP3)' : 'Download audio (MP3)';
}

/**
 * R7: audio providers (podcast/audio) render an inline <audio controls>
 * player in the row — the visitor plays without leaving the page — plus a
 * "Download" affordance on the same URL. Video providers keep the external
 * link (no iframes: CSP frame-src is not opened, and embeds are trackers).
 */
export function isAudioProvider(provider: Video['provider']): boolean {
  return provider === 'podcast' || provider === 'audio';
}

/** Host name for an audio row's "Watch the video on …" link. */
export function videoHostLabel(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'its host';
  }
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'YouTube';
  if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) return 'Vimeo';
  return host.replace(/^www\./, '');
}

/* TODAY under UTC (src/lib/today.ts), re-exported for this page's callers. */
export { todayUtcIso };

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
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.tight};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;

const VideoList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const VideoRow = styled.li<{ $cover: boolean }>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[4]};
  padding-block: ${(p) => p.theme.space[4]};
  flex-wrap: wrap;

  &:not(:last-child) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }

  /* Phones: a ledger row. A small cover sits beside the title, and everything
   * else runs the full width under them. (A cover the width of the screen made
   * six rows a very long page, and made a picture, not the words, the largest
   * thing on the first screen.) The row's main column dissolves into the grid
   * so its parts can be placed one by one. */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    display: grid;
    grid-template-columns: ${(p) => (p.$cover ? '8.25rem minmax(0, 1fr)' : 'minmax(0, 1fr)')};
    column-gap: ${(p) => p.theme.space[3]};
    row-gap: ${(p) => p.theme.space[2]};
    align-items: start;

    & > [data-part='main'] {
      display: contents;
    }
    & > [data-part='main'] > * {
      grid-column: 1 / -1;
    }
    & > [data-part='main'] > h3 {
      grid-column: ${(p) => (p.$cover ? '2' : '1 / -1')};
      grid-row: 1;
      align-self: center;
    }
    & > [data-part='aside'] {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
`;

/* Cover image: a fixed 16:9 box beside the text; full width on phones, where
 * the row wraps. width/height attributes reserve the space before it loads.
 * A plain <img> with a css() class: styled.img drops loading/decoding (the
 * vendored prop filter does not know them). The box is a link to the video
 * when there is one. */
function thumbBoxCls(theme: Tokens): string {
  const t = theme;
  return css({
    flex: 'none',
    display: 'block',
    width: '240px',
    maxWidth: '100%',
    borderRadius: t.radius.md,
    /* Phones: the small cover of the ledger row (see VideoRow). */
    ['@media (max-width: ' + t.breakpoint.md + ')']: { width: '100%', gridColumn: '1', gridRow: '1' },
    '&[href]:hover img': { borderColor: t.color.rule, boxShadow: `0 0 0 3px ${t.color.mark}` },
  });
}

function thumbImgCls(theme: Tokens): string {
  const t = theme;
  return css({
    display: 'block',
    width: '100%',
    height: 'auto',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    borderRadius: '0',
    border: `1px solid ${t.color.borderStrong}`,
    background: t.color.border,
  });
}

const RowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  min-width: 0;
  /* A fixed basis, not auto: with auto a long title asks for its full width and
   * the row wraps the text below a cover image. 20rem fits beside the cover and
   * the badges on desktop and wraps cleanly on phones. */
  flex: 1 1 20rem;
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

/* R7: inline audio player + download affordance for podcast/audio rows. */
const AudioPlayerControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};

  /* The width limit is the player's alone. The links under it must not share
   * it: three links came to within a few pixels of 32rem, so they sat on one
   * line in one font and on two in another, and the row changed height when
   * the web font arrived. */
  & audio {
    width: 100%;
    max-width: 32rem;
    height: 40px;
    border-radius: ${(p) => p.theme.radius.sm};
  }
`;

/** The row's links, side by side, wrapping when they must. */
const RowLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: ${(p) => p.theme.space[5]};
  row-gap: 0;
`;

function downloadCls(theme: Tokens): string {
  const t = theme;
  return css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: t.space[1],
    fontFamily: t.font.sans,
    fontSize: t.font.sizes.sm,
    fontWeight: t.font.weights.semibold,
    color: t.color.accent,
    textDecorationLine: 'underline',
    textDecorationColor: t.color.accentBorder,
    textDecorationThickness: '2px',
    textUnderlineOffset: '0.25em',
    minHeight: '28px',
    ['@media (max-width: ' + t.breakpoint.md + ')']: {
      minHeight: '44px',
    },
    '&:hover': { background: t.color.mark, color: t.color.markInk, textDecorationColor: 'transparent' },
    '&:focus-visible': { outline: `2px solid ${t.color.focus}`, outlineOffset: '2px' },
  });
}

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
    '&:hover': { background: theme.color.mark, color: theme.color.markInk, textDecoration: 'none' },
    '&:focus-visible': { outline: `2px solid ${theme.color.focus}`, outlineOffset: '3px' },
  });
}

const InlineIcon = styled.span`
  display: inline-flex;
  align-items: center;
  vertical-align: -0.15em;
  color: ${(p) => p.theme.color.accent};
`;

/**
 * How long after the page has loaded an audio player in view asks for its
 * length. Long enough to stay out of the page's own loading, short enough
 * that the length is there before anyone reaches for the play button.
 */
const METADATA_DELAY_MS = 1200;

/**
 * The audio player of a row.
 *
 * It starts with `preload="none"`: no request at all. A page of six episodes
 * that each asked for their metadata while the page loaded held six
 * connections open against the page's own fonts and images, to show a length
 * that the row already prints. A player asks for its metadata only once it is
 * on screen (or about to be) and the page has finished loading, so the native
 * control still shows the real length by the time it is used. Pressing play
 * loads the file either way.
 */
export function LazyAudio({ src }: { src: string }): React.ReactNode {
  const ref = useRef<HTMLAudioElement>(null);
  const [preload, setPreload] = useState<'none' | 'metadata'>('none');

  useEffect(() => {
    const el = ref.current;
    if (!el || preload !== 'none' || typeof IntersectionObserver === 'undefined') return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let waitingForLoad = false;
    const ask = (): void => {
      timer = setTimeout(() => setPreload('metadata'), METADATA_DELAY_MS);
    };
    const onLoad = (): void => {
      waitingForLoad = false;
      ask();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        if (document.readyState === 'complete') ask();
        else {
          waitingForLoad = true;
          window.addEventListener('load', onLoad, { once: true });
        }
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
      if (waitingForLoad) window.removeEventListener('load', onLoad);
    };
  }, [preload]);

  return (
    <audio ref={ref} controls preload={preload} src={src} data-testid="video-audio-player">
      <track kind="captions" />
    </audio>
  );
}

export function VideoRowItem({ video, first = false }: { video: Video; first?: boolean }): React.ReactNode {
  const theme = useTheme() as Tokens;
  return (
    <VideoRow data-testid="video-row" $cover={Boolean(video.thumbnail)}>
      {video.thumbnail &&
        (() => {
          const cover = (
            <img
              src={withBase(video.thumbnail)}
              alt={video.thumbnailAlt ?? ''}
              width={640}
              height={360}
              /* The first cover is on the first screen (on a phone it is the
               * largest thing there): fetch it with the page. The others wait
               * until they are scrolled near. */
              loading={first ? 'eager' : 'lazy'}
              /* ...and draw it with the frame it arrives in, not one later. */
              decoding={first ? 'sync' : 'async'}
              className={thumbImgCls(theme)}
              data-testid="video-thumbnail"
            />
          );
          /* Clicking the cover opens the video. Mouse and touch only: the
           * "Watch the video on …" link below is the keyboard and screen-reader
           * route, so this duplicate stays out of the tab order and the
           * accessibility tree. */
          return video.videoUrl ? (
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={-1}
              aria-hidden="true"
              className={thumbBoxCls(theme)}
              data-testid="video-thumbnail-link"
            >
              {cover}
            </a>
          ) : (
            <div className={thumbBoxCls(theme)}>{cover}</div>
          );
        })()}
      <RowMain data-part="main">
        <TitleRow>
          {isAudioProvider(video.provider) ? (
            /* R7: audio stays on-page — the title is not a link, the player
             * below is the affordance (a link that duplicates the player's
             * controls is noise for keyboard users). */
            <span className={videoTitleClass(theme)} data-testid="video-link">
              <InlineIcon>
                <Icon name="play" size={16} />
              </InlineIcon>{' '}
              {video.title}
            </span>
          ) : (
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
          )}
        </TitleRow>
        <Summary>{video.summary}</Summary>
        {isAudioProvider(video.provider) && (
          <AudioPlayerControls data-testid="video-audio">
            <LazyAudio src={sameOriginPath(video.url)} />
            <RowLinks>
              <a href={sameOriginPath(video.url)} download className={downloadCls(theme)} data-testid="video-download">
                {downloadLabel(video)}
                <VisuallyHidden>{`: ${video.title}`}</VisuallyHidden>
              </a>
              {video.transcriptUrl && (
                <a
                  href={sameOriginPath(video.transcriptUrl)}
                  className={downloadCls(theme)}
                  data-testid="video-transcript"
                >
                  Transcript
                  <VisuallyHidden>{` of ${video.title}`}</VisuallyHidden>
                </a>
              )}
              {video.videoUrl && (
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={downloadCls(theme)}
                  data-testid="video-watch"
                >
                  Watch the video on {videoHostLabel(video.videoUrl)}
                  <VisuallyHidden>{` (${video.title}, opens in a new tab)`}</VisuallyHidden>
                </a>
              )}
            </RowLinks>
          </AudioPlayerControls>
        )}
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
      <RowAside data-part="aside">
        <Tag size="sm" tone="outline" data-testid="video-provider">
          {rowKindLabel(video)}
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
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

export function Videos(): React.ReactNode {
  /* useToday, not the clock: the page is adopted from prerendered markup, and
   * its first render must group the list as the build did (src/lib/today.ts). */
  const { upcoming, past } = splitByDate(content.videos, useToday());
  const total = content.videos.length;

  return (
    <>
      <PageHeader>
        <Heading level={1} data-testid="videos-title">
          Videos and podcasts
        </Heading>
        <Lede>
          Videos and podcast episodes from the lab. The audio of each one plays right here, with a transcript and an MP3
          to download; the video itself opens on the host where it plays.
        </Lede>
        {total > 0 && (
          <MetaLine role="status" data-testid="videos-count">
            {pluralize(total, 'recording')} in the library.
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
                {upcoming.map((video, index) => (
                  <VideoRowItem key={video.slug} video={video} first={index === 0} />
                ))}
              </VideoList>
            </GroupSection>
          )}
          {past.length > 0 && (
            <GroupSection aria-labelledby="videos-past-title" data-testid="videos-past">
              <GroupTitle id="videos-past-title">Past recordings</GroupTitle>
              <VideoList>
                {past.map((video, index) => (
                  /* The first row of the page is the first of "Upcoming" when
                   * there is one, else the first of these. */
                  <VideoRowItem key={video.slug} video={video} first={upcoming.length === 0 && index === 0} />
                ))}
              </VideoList>
            </GroupSection>
          )}
        </>
      )}
    </>
  );
}

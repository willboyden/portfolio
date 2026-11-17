import styled from '@emotion/styled';
import { dataText } from 'app/theme/mixins';

/**
 * Article layout — the frame a post and a local recipe share.
 *
 * An article is set like a report. From `xl` up it uses the site's two
 * columns: the margin holds the facts about the piece (date, length, series,
 * its key metric, the copy-link button) and stays in view while you read; the
 * wide column holds the title, the summary and the text. Each part is placed
 * on the grid explicitly, so the DOM order stays title → facts → summary →
 * text, which is also the reading order on a phone.
 *
 * Usage (children in this order):
 *   <ArticleLayout>
 *     <ArticleBack/> <ArticleTitle/> <ArticleFacts/> <ArticleStandfirst/>
 *     (or <ArticleLead> around the summary and more) <ArticleBody/>
 *     then any number of <ArticleAfter/> blocks
 *   </ArticleLayout>
 */
export const ArticleLayout = styled.article`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[5]};
  margin-block: 0 ${(p) => p.theme.space[6]};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    display: grid;
    grid-template-columns: ${(p) => p.theme.layout.marginCol} minmax(0, 1fr);
    grid-template-rows: auto auto 1fr;
    column-gap: ${(p) => p.theme.space[7]};
    row-gap: ${(p) => p.theme.space[5]};
    align-items: start;
  }
`;

/** The way back to the index: top of the margin column. */
export const ArticleBack = styled.div`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 1;
    grid-row: 1;
    /* Level with the title's first line. */
    padding-top: ${(p) => p.theme.space[3]};
  }
`;

export const ArticleTitle = styled.div`
  min-width: 0;
  max-width: 54rem;

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 2;
    grid-row: 1;
  }
`;

/** The facts. A compact stack under the title on small screens; a ruled
 * column in the margin, sticky beside the text, from `xl`. */
export const ArticleFacts = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[3]};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 1;
    grid-row: 2 / span 2;
    position: sticky;
    top: calc(${(p) => p.theme.layout.navHeight} + ${(p) => p.theme.space[5]});
    padding-top: ${(p) => p.theme.space[3]};
    border-top: 1px solid ${(p) => p.theme.color.borderStrong};
    gap: ${(p) => p.theme.space[4]};
  }
`;

/** Date · length · series: one wrapping row, a short column in the margin. */
export const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[1]} ${(p) => p.theme.space[2]};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${(p) => p.theme.space[1]};
  }
`;

/** The dot between meta items; not needed once they are stacked. */
export const ArticleSep = styled.span`
  color: ${(p) => p.theme.color.textSubtle};

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    display: none;
  }
`;

/** The summary is the abstract: the reading serif, a step larger than the text. */
export const ArticleStandfirst = styled.p`
  margin: 0;
  max-width: 36em;
  font-family: ${(p) => p.theme.font.serif};
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: 1.45;
  color: ${(p) => p.theme.color.text};

  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    font-size: ${(p) => p.theme.font.sizes.lg};
  }

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 2;
    grid-row: 2;
  }
`;

/** A wrapper for when more than the summary sits above the text (a recipe's
 * "at a glance" table): takes the summary's place on the grid. */
export const ArticleLead = styled.div`
  min-width: 0;

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 2;
    grid-row: 2;
  }
`;

/** The text, under a heavy rule. */
export const ArticleBody = styled.div`
  border-top: 2px solid ${(p) => p.theme.color.rule};
  padding-top: ${(p) => p.theme.space[6]};
  min-width: 0;

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 2;
    grid-row: 3;
  }
`;

/** Anything after the text (pager, related entry): stays in the wide column. */
export const ArticleAfter = styled.div`
  min-width: 0;
  max-width: 54rem;

  @media (min-width: ${(p) => p.theme.breakpoint.xl}) {
    grid-column: 2;
  }
`;

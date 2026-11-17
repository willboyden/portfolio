/**
 * AI Engineering › Local recipes — the subsection index
 * (/ai-engineering/local-recipes) and one recipe (/ai-engineering/local-recipes/:slug).
 *
 * A recipe is an exact, measured setup for running a model on my own
 * hardware: the frontmatter gives the card and the "at a glance" block
 * (hardware, model, engine, measured results); the markdown body is the
 * recipe itself, rendered at BUILD time by the vetted vendor/markdown engine
 * (CONTRACT §5 — the one place dangerouslySetInnerHTML is honest). The body
 * is not in the JS bundle: RecipeBody takes it from app/content/recipe-bodies
 * (prerendered, adopted on first load, or fetched once on a client visit).
 *
 * Shape and a11y follow the AI Engineering pages: one h1; the shared
 * subsection nav (Local recipes is its last entry); card titles are h2; crumb
 * and card links take the 44px phone hit-area classes from AiEngineering.tsx
 * (styled(Link) would drop `to`). Unknown slugs render NotFound, never crash.
 */

import { useEffect, useState, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { Link, useParams } from '@portfolio/router';
import {
  ArticleBack,
  ArticleBody,
  ArticleFacts,
  ArticleLayout,
  ArticleLead,
  ArticleMeta,
  ArticleSep,
  ArticleStandfirst,
  ArticleTitle,
  Container,
  EmptyState,
  Heading,
  Prose,
  Stack,
  Tag,
} from 'app/components/ui';
import { getRecipe, recipesByDate, type Recipe } from 'app/content';
import { cachedRecipeBody, loadRecipeBody } from 'app/content/recipe-bodies';
import { formatDate, formatIsoDate, formatReadingTime } from 'app/lib/format';
import { withBase } from 'app/lib/seo';
import type { Tokens } from 'app/theme/tokens';
import { dataText } from 'app/theme/mixins';
import { LOCAL_RECIPES_PATH, SubsectionNav, cardLinkClass, crumbClass } from './AiEngineering';
import { NotFound } from './NotFound';

/** The canonical path of one recipe. */
export function recipePath(slug: string): string {
  return `${LOCAL_RECIPES_PATH}/${slug}`;
}

/** Human status label; the Tag tone keeps it from relying on colour alone. */
export function recipeStatusLabel(status: Recipe['status']): string {
  return status === 'in-use' ? 'In use' : 'Retired';
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
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

const CrumbNav = styled.nav`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
`;

const CrumbSep = styled.span`
  color: ${(p) => p.theme.color.textSubtle};
`;

const RecipeList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[7]};
`;

/* One recipe: an open entry under a heavy rule, like a section of a manual. */
const RecipeCard = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding-top: ${(p) => p.theme.space[4]};
  border-top: 2px solid ${(p) => p.theme.color.rule};
`;

const CardMeta = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  ${(p) => dataText(p.theme)}
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

/* h2: the index goes h1 → card titles (no skipped level, a11y e2e). */
const CardTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes['2xl']};
  line-height: ${(p) => p.theme.font.leading.snug};
  overflow-wrap: anywhere;
`;

const CardSummary = styled.p`
  margin: 0;
  max-width: 70ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

/* A specification table: what it runs on, then what was measured. Two pairs
 * per row from md up, one hairline per row. */
const ResultGrid = styled.dl`
  margin: ${(p) => p.theme.space[2]} 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  column-gap: ${(p) => p.theme.space[7]};
  border-top: 1px solid ${(p) => p.theme.color.borderStrong};
  max-width: 60rem;

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const ResultItem = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  column-gap: ${(p) => p.theme.space[3]};
  align-items: baseline;
  padding-block: ${(p) => p.theme.space[2]};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
  min-width: 0;
`;

const ResultLabel = styled.dt`
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.snug};
  color: ${(p) => p.theme.color.textSubtle};
`;

/* Specs (hardware / model / engine) read as text; measured results are set
 * as readings: larger, digits aligned. */
const SpecValue = styled.dd`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.snug};
  color: ${(p) => p.theme.color.text};
  overflow-wrap: anywhere;
`;

const ResultValue = styled.dd`
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  color: ${(p) => p.theme.color.text};
  overflow-wrap: anywhere;
`;

const Glance = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  margin-top: ${(p) => p.theme.space[5]};
`;

const GlanceTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  line-height: ${(p) => p.theme.font.leading.tight};
`;

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                               */
/* -------------------------------------------------------------------------- */

/** Hardware / model / engine as definition items, then the measured results. */
function AtAGlance({ recipe, withResults }: { recipe: Recipe; withResults: boolean }): ReactNode {
  const specs: { label: string; value: string }[] = [
    { label: 'Hardware', value: recipe.hardware },
    { label: 'Model', value: recipe.model },
    { label: 'Engine', value: recipe.engine },
  ];
  return (
    <ResultGrid data-testid="recipe-glance">
      {specs.map((item) => (
        <ResultItem key={item.label}>
          <ResultLabel>{item.label}</ResultLabel>
          <SpecValue>{item.value}</SpecValue>
        </ResultItem>
      ))}
      {withResults &&
        recipe.results.map((item) => (
          <ResultItem key={item.label}>
            <ResultLabel>{item.label}</ResultLabel>
            <ResultValue>{item.value}</ResultValue>
          </ResultItem>
        ))}
    </ResultGrid>
  );
}

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

export function LocalRecipesIndex({ currentPath }: { currentPath?: string }): ReactNode {
  const theme = useTheme() as Tokens;
  const recipes = recipesByDate();
  return (
    <Container data-testid="recipes-index">
      <PageHeader>
        <CrumbNav aria-label="Breadcrumb">
          <Link to="/ai-engineering" className={crumbClass(theme)} data-testid="recipes-crumb">
            AI engineering
          </Link>
        </CrumbNav>
        <Heading level={1} data-testid="recipes-title">
          Local recipes
        </Heading>
        <Lede>
          Exact, measured setups for running open models on my own hardware: every flag, the tests behind each number,
          and how each one was found. Written so you can rebuild them; machine names, addresses and keys are
          placeholders.
        </Lede>
        <SubsectionNav currentPath={currentPath ?? LOCAL_RECIPES_PATH} />
      </PageHeader>

      {recipes.length > 0 ? (
        <RecipeList data-testid="recipes-list">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.slug} data-testid={`recipe-card-${recipe.slug}`}>
              <CardMeta>
                <time dateTime={recipe.date}>{formatIsoDate(recipe.date)}</time>
                <span aria-hidden="true">·</span>
                <span>{formatReadingTime(recipe.readingMinutes)}</span>
              </CardMeta>
              <CardTitle>
                <Link
                  to={recipePath(recipe.slug)}
                  className={cardLinkClass(theme)}
                  data-testid={`recipe-link-${recipe.slug}`}
                >
                  {recipe.title}
                </Link>
              </CardTitle>
              <CardSummary>{recipe.summary}</CardSummary>
              <AtAGlance recipe={recipe} withResults />
              <Stack direction="row" wrap gap="2">
                <Tag size="sm" tone={recipe.status === 'in-use' ? 'accent' : 'outline'}>
                  {recipeStatusLabel(recipe.status)}
                </Tag>
                {recipe.tags.map((tag) => (
                  <Tag key={tag} size="sm">
                    {tag}
                  </Tag>
                ))}
              </Stack>
            </RecipeCard>
          ))}
        </RecipeList>
      ) : (
        <EmptyState
          icon="search"
          title="First recipe being written"
          description="Each recipe lists the exact hardware, engine flags and measured results of a setup that runs here."
        />
      )}
    </Container>
  );
}

/* -------------------------------------------------------------------------- */
/* One recipe                                                                  */
/* -------------------------------------------------------------------------- */

export function RecipeDetailView({ slug }: { slug: string }): ReactNode {
  const theme = useTheme() as Tokens;
  const recipe = getRecipe(slug);
  if (!recipe) return <NotFound />;
  return (
    <Container data-testid="recipe-page">
      <ArticleLayout data-testid="recipe-article">
        <ArticleBack>
          <CrumbNav aria-label="Breadcrumb">
            <Link to="/ai-engineering" className={crumbClass(theme)} data-testid="recipe-crumb-ai">
              AI engineering
            </Link>
            <CrumbSep aria-hidden="true">/</CrumbSep>
            <Link to={LOCAL_RECIPES_PATH} className={crumbClass(theme)} data-testid="recipe-crumb-recipes">
              Local recipes
            </Link>
          </CrumbNav>
        </ArticleBack>

        <ArticleTitle>
          <Heading level={1} data-testid="recipe-title">
            {recipe.title}
          </Heading>
        </ArticleTitle>

        <ArticleFacts>
          <ArticleMeta data-testid="recipe-meta">
            <time dateTime={recipe.date}>{formatDate(recipe.date, { style: 'long' })}</time>
            <ArticleSep aria-hidden="true">·</ArticleSep>
            <span>{formatReadingTime(recipe.readingMinutes)}</span>
            <ArticleSep aria-hidden="true">·</ArticleSep>
            <Tag size="sm" tone={recipe.status === 'in-use' ? 'accent' : 'outline'}>
              {recipeStatusLabel(recipe.status)}
            </Tag>
          </ArticleMeta>
          <Link to={LOCAL_RECIPES_PATH} className={crumbClass(theme)} data-testid="recipe-back">
            <span aria-hidden="true">←</span>&nbsp;All local recipes
          </Link>
        </ArticleFacts>

        <ArticleLead>
          <ArticleStandfirst data-testid="recipe-standfirst">{recipe.summary}</ArticleStandfirst>
          <Glance aria-labelledby="recipe-glance-title">
            <GlanceTitle id="recipe-glance-title">At a glance</GlanceTitle>
            <AtAGlance recipe={recipe} withResults />
          </Glance>
        </ArticleLead>

        <ArticleBody>
          <Prose data-testid="recipe-prose">
            {/* key: a visit to another recipe starts from that recipe's own state. */}
            <RecipeBody key={recipe.slug} slug={recipe.slug} bodyHash={recipe.bodyHash} />
          </Prose>
        </ArticleBody>
      </ArticleLayout>
    </Container>
  );
}

/** The recipe itself. Shown at once when this page already has it (the
 * prerender, or the first load's adopted copy); otherwise fetched once. */
export function RecipeBody({ slug, bodyHash }: { slug: string; bodyHash: string }): ReactNode {
  const [html, setHtml] = useState<string | null>(() => cachedRecipeBody(slug) ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (html !== null) return undefined;
    let live = true;
    loadRecipeBody(slug, bodyHash).then(
      (loaded) => {
        if (live) setHtml(loaded);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [slug, bodyHash, html]);
  if (failed) {
    return (
      <p data-testid="recipe-body-error">
        This recipe did not load. <a href={withBase(recipePath(slug))}>Reload the page</a> to try again.
      </p>
    );
  }
  if (html === null) return <p data-testid="recipe-body-loading">Loading the recipe…</p>;
  /* Markdown rendered and sanitized at BUILD time by the pipeline (CONTRACT
   * §5), served from this site's own origin: trusted by construction. */
  return <div data-recipe-body={slug} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Route component: the slug comes from the URL. */
export function RecipeDetail(): ReactNode {
  const { slug } = useParams<{ slug: string }>();
  return <RecipeDetailView slug={slug ?? ''} />;
}

/**
 * AI Engineering › Local recipes — the subsection index
 * (/ai-engineering/local-recipes) and one recipe (/ai-engineering/local-recipes/:slug).
 *
 * A recipe is an exact, measured setup for running a model on my own
 * hardware: the frontmatter gives the card and the "at a glance" block
 * (hardware, model, engine, measured results); the markdown body is the
 * recipe itself, rendered at BUILD time by the vetted vendor/markdown engine
 * (CONTRACT §5 — the one place dangerouslySetInnerHTML is honest).
 *
 * Shape and a11y follow the AI Engineering pages: one h1; the shared
 * subsection nav (Local recipes is its last entry); card titles are h2; crumb
 * and card links take the 44px phone hit-area classes from AiEngineering.tsx
 * (styled(Link) would drop `to`). Unknown slugs render NotFound, never crash.
 */

import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { Link, useParams } from '@portfolio/router';
import { Container, EmptyState, Heading, Prose, Stack, Tag } from 'app/components/ui';
import { getRecipe, recipesByDate, type Recipe } from 'app/content';
import { formatDate, formatReadingTime } from 'app/lib/format';
import { rebaseHtml } from 'app/lib/seo';
import type { Tokens } from 'app/theme/tokens';
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
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
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
  gap: ${(p) => p.theme.space[5]};
`;

const RecipeCard = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => p.theme.space[5]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: ${(p) => p.theme.color.bgSunken};
`;

const CardMeta = styled.p`
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

/* h2: the index goes h1 → card titles (no skipped level, a11y e2e). */
const CardTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  overflow-wrap: anywhere;
`;

const CardSummary = styled.p`
  margin: 0;
  max-width: 70ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;

const ResultGrid = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[3]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const ResultItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
  min-width: 0;
`;

const ResultLabel = styled.dt`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

/* Specs (hardware / model / engine) read as text; measured results stand out. */
const SpecValue = styled.dd`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.text};
  overflow-wrap: anywhere;
`;

const ResultValue = styled.dd`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};
  overflow-wrap: anywhere;
`;

const Article = styled.article`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[5]};
  margin-block: ${(p) => p.theme.space[6]};
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;

const Sep = styled.span`
  color: ${(p) => p.theme.color.textSubtle};
`;

const Standfirst = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
  max-width: 60ch;
`;

const Glance = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding: ${(p) => p.theme.space[5]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: ${(p) => p.theme.color.bgSunken};
`;

const GlanceTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.tight};
`;

const Body = styled.div`
  border-top: 1px solid ${(p) => p.theme.color.border};
  padding-top: ${(p) => p.theme.space[6]};
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
          Exact, measured setups for running open models on my own hardware:
          every flag, the tests behind each number, and how each one was
          found. Written so you can rebuild them; machine names, addresses
          and keys are placeholders.
        </Lede>
        <SubsectionNav currentPath={currentPath ?? LOCAL_RECIPES_PATH} />
      </PageHeader>

      {recipes.length > 0 ? (
        <RecipeList data-testid="recipes-list">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.slug} data-testid={`recipe-card-${recipe.slug}`}>
              <CardMeta>
                <time dateTime={recipe.date}>{formatDate(recipe.date, { style: 'long' })}</time>
                <Sep aria-hidden="true">·</Sep>
                <span>{formatReadingTime(recipe.readingMinutes)}</span>
              </CardMeta>
              <CardTitle>
                <Link to={recipePath(recipe.slug)} className={cardLinkClass(theme)} data-testid={`recipe-link-${recipe.slug}`}>
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
                  <Tag key={tag} size="sm" tone="outline">
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
    <Container size="prose" data-testid="recipe-page">
      <Article data-testid="recipe-article">
        <CrumbNav aria-label="Breadcrumb">
          <Link to="/ai-engineering" className={crumbClass(theme)} data-testid="recipe-crumb-ai">
            AI engineering
          </Link>
          <CrumbSep aria-hidden="true">/</CrumbSep>
          <Link to={LOCAL_RECIPES_PATH} className={crumbClass(theme)} data-testid="recipe-crumb-recipes">
            Local recipes
          </Link>
        </CrumbNav>

        <Heading level={1} data-testid="recipe-title">
          {recipe.title}
        </Heading>
        <MetaRow data-testid="recipe-meta">
          <time dateTime={recipe.date}>{formatDate(recipe.date, { style: 'long' })}</time>
          <Sep aria-hidden="true">·</Sep>
          <span>{formatReadingTime(recipe.readingMinutes)}</span>
          <Sep aria-hidden="true">·</Sep>
          <Tag size="sm" tone={recipe.status === 'in-use' ? 'accent' : 'outline'}>
            {recipeStatusLabel(recipe.status)}
          </Tag>
        </MetaRow>
        <Standfirst data-testid="recipe-standfirst">{recipe.summary}</Standfirst>

        <Glance aria-labelledby="recipe-glance-title">
          <GlanceTitle id="recipe-glance-title">At a glance</GlanceTitle>
          <AtAGlance recipe={recipe} withResults />
        </Glance>

        <Body>
          {/* recipe.html is markdown rendered + sanitized at BUILD time by the
              pipeline (CONTRACT §5) — trusted by construction, not by network. */}
          <Prose data-testid="recipe-prose">
            <div dangerouslySetInnerHTML={{ __html: rebaseHtml(recipe.html) }} />
          </Prose>
        </Body>

        <Link to={LOCAL_RECIPES_PATH} className={crumbClass(theme)} data-testid="recipe-back">
          <span aria-hidden="true">←</span>&nbsp;All local recipes
        </Link>
      </Article>
    </Container>
  );
}

/** Route component: the slug comes from the URL. */
export function RecipeDetail(): ReactNode {
  const { slug } = useParams<{ slug: string }>();
  return <RecipeDetailView slug={slug ?? ''} />;
}

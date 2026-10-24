/**
 * Content schema (CONTRACT.md §4) — the single validation contract between
 * content/*.md files, `scripts/build-content.mjs`, and the app.
 *
 * Every entry carries the shared fields (slug/title/summary/tags/date) plus
 * type-specific fields. All schemas are `.strict()`: an unknown frontmatter
 * key is a build error, not a silent no-op — that is how content rot gets
 * caught at build time instead of at read time.
 */
import { z } from 'zod';

/** `YYYY-MM-DD`, enforced as a string (JSON has no date type). */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date');

/** kebab-case, matching the content file name minus `.md`. */
const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected a kebab-case slug');

/**
 * R1-C #2: z.string().url() is scheme-agnostic — it accepts javascript:,
 * data:, file:. Frontmatter URLs render straight into <a href>, so the
 * schema must enforce the SAME scheme allowlist the markdown engine's
 * sanitizeUrl applies to prose links. One policy, both entry points.
 */
export const SafeUrl = z
  .string()
  .url('expected an absolute URL')
  .refine((u) => /^(https?:|mailto:)/i.test(u), 'only http(s)/mailto URLs are allowed');

const baseShape = {
  slug: Slug,
  title: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)),
  date: IsoDate,
};

export const ProjectLinksSchema = z
  .object({
    source: SafeUrl.optional(),
    demo: SafeUrl.optional(),
    paper: SafeUrl.optional(),
  })
  .strict();

export const ProjectMetricSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
  })
  .strict();

export const ProjectSchema = z
  .object({
    ...baseShape,
    role: z.string().min(1),
    status: z.enum(['shipped', 'active', 'archived']),
    period: z.string().min(1),
    highlights: z.array(z.string().min(1)).min(1),
    stack: z.array(z.string().min(1)).min(1),
    /** R2-A A2: links are optional — a project with no *verified* URL shows
     * no link button at all (fabricated source URLs 404 and read as fake). */
    links: ProjectLinksSchema.optional(),
    metrics: z.array(ProjectMetricSchema).optional(),
    /** R6-C C1: optional hand-curated cross-link to the post that tells this
     * project's story (slug validated against posts at build time). */
    relatedPost: Slug.optional(),
    featured: z.boolean(),
    accent: z.string().min(1).optional(),
    /** Optional long-form body rendered from the markdown below frontmatter. */
    html: z.string().optional(),
  })
  .strict();

export const PostSchema = z
  .object({
    ...baseShape,
    readingMinutes: z.number().int().positive(),
    series: z.string().min(1).optional(),
    /* R7D-01: heroImage removed — it was accepted by the schema but rendered
     * by no component (silent no-op surface). Unknown keys stay build errors
     * via .strict(), so re-adding a field requires wiring its renderer too. */
    /** R6-C C1: optional hand-curated cross-links. Slugs are validated
     * against their collection at build time (build-content checks
     * existence), so a typo here fails the build instead of rendering a
     * dead link. */
    relatedProject: Slug.optional(),
    relatedPosts: z.array(Slug).optional(),
    /** Sanitized rendered markdown — the build pipeline's output. */
    html: z.string().min(1),
    excerpt: z.string().min(1),
  })
  .strict();

export const VideoSchema = z
  .object({
    ...baseShape,
    url: SafeUrl,
    embedId: z.string().min(1).optional(),
    /** R7: `podcast`/`audio` render an inline <audio> player + download link
     * instead of a provider badge; `youtube`/`vimeo` render an external link
     * (no iframes — CSP has no frame-src allowance and external embeds are
     * tracking surfaces). */
    provider: z.enum(['youtube', 'vimeo', 'podcast', 'audio', 'other']),
    /** Human display: "42 min" / "1 h 12 min" (free-form, verified at build). */
    duration: z.string().min(1),
    speakers: z.array(z.string().min(1)).optional(),
    event: z.string().min(1).optional(),
  })
  .strict();

export const TalkSchema = z
  .object({
    ...baseShape,
    event: z.string().min(1),
    location: z.string().min(1),
    slidesUrl: SafeUrl.optional(),
    videoUrl: SafeUrl.optional(),
    abstract: z.string().min(1),
  })
  .strict();

/** R9 (AI Engineering section): one evidence bullet. `url`, when present,
 * must be a public http(s) page (a GitHub repository) — workstation file
 * paths were published here once and must never come back. */
export const AiProofSchema = z
  .object({
    claim: z.string().min(1),
    url: SafeUrl.refine((u) => /^https:/i.test(u), 'proof links must be public https URLs').optional(),
  })
  .strict();

export const AiCapabilityStatus = z.enum(['offered', 'in-progress', 'shipped']);

/** R10: head-to-head comparison table rendered as an expandable
 * <details>/<summary> block on the capability page. First row is the header
 * row (rendered as <th>); remaining rows are body cells. */
export const AiComparisonSchema = z
  .object({
    title: z.string().min(1),
    rows: z.array(z.array(z.string().min(1)).min(2)).min(2),
  })
  .strict();

export const AiCapabilitySchema = z
  .object({
    ...baseShape,
    capability: z.string().min(1),
    oneLiner: z.string().min(1),
    status: AiCapabilityStatus,
    stack: z.array(z.string().min(1)).min(1),
    howItWorks: z.array(z.string().min(1)).min(3).max(6),
    proof: z.array(AiProofSchema).min(3).max(6),
    /** Honest constraints — mandatory: a capability page without limits is
     * marketing, not engineering. */
    limits: z.array(z.string().min(1)).min(1),
    relatedPosts: z.array(Slug).optional(),
    relatedProjects: z.array(Slug).optional(),
    /** R10: optional head-to-head comparisons (expandable tables). */
    comparisons: z.array(AiComparisonSchema).optional(),
    /** Long-form body rendered from the markdown below the frontmatter. */
    html: z.string().optional(),
  })
  .strict();

export type AiProof = z.infer<typeof AiProofSchema>;
export type AiComparison = z.infer<typeof AiComparisonSchema>;
export type AiCapability = z.infer<typeof AiCapabilitySchema>;

/** One measured number on a recipe card: "Decode step" = "~61 ms". */
export const RecipeResultSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
  })
  .strict();

/** AI Engineering › Local recipes: one exact, measured setup for running a
 * model on my own hardware. The body is the recipe itself (every flag, the
 * tests behind each number, how it was found); the frontmatter is what the
 * index card and the "at a glance" block show. `results` are measured
 * numbers only — a recipe states their conditions in its body.
 *
 * The body is NOT in this bundle: scripts/build-content.mjs writes it to
 * public/recipe-bodies/<slug>.json and the page loads it from there
 * (src/content/recipe-bodies.ts). Every recipe body used to count against the
 * site's JS budget — one recipe was 12.8 kB of the 220 kB, gzipped (2026-10-24). */
export const RecipeSchema = z
  .object({
    ...baseShape,
    hardware: z.string().min(1),
    model: z.string().min(1),
    engine: z.string().min(1),
    status: z.enum(['in-use', 'retired']),
    results: z.array(RecipeResultSchema).min(1).max(6),
    /** Computed by the pipeline from the body. */
    readingMinutes: z.number().int().positive(),
    /** First 12 hex characters of the body's sha256. It versions the body
     * file's URL, so a new deploy is never answered from a cached old body. */
    bodyHash: z.string().regex(/^[0-9a-f]{12}$/, 'expected 12 lowercase hex characters'),
  })
  .strict();

/** A recipe as build-content validates it, before the body is split out. */
export const RecipeSourceSchema = RecipeSchema.omit({ bodyHash: true })
  .extend({
    /** Sanitized rendered markdown — the build pipeline's output. */
    html: z.string().min(1),
  })
  .strict();

/** public/recipe-bodies/<slug>.json — one recipe's body, written by the build. */
export const RecipeBodySchema = z
  .object({
    slug: Slug,
    html: z.string().min(1),
  })
  .strict();

export type RecipeResult = z.infer<typeof RecipeResultSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeBody = z.infer<typeof RecipeBodySchema>;

/** Whole generated bundle — what `src/content/generated/content.json` must satisfy. */
export const SiteContentSchema = z
  .object({
    contentHash: z.string().min(1),
    projects: z.array(ProjectSchema),
    posts: z.array(PostSchema),
    videos: z.array(VideoSchema),
    talks: z.array(TalkSchema),
    aiCapabilities: z.array(AiCapabilitySchema),
    recipes: z.array(RecipeSchema),
  })
  .strict();

export type ProjectLinks = z.infer<typeof ProjectLinksSchema>;
export type ProjectMetric = z.infer<typeof ProjectMetricSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Post = z.infer<typeof PostSchema>;
export type Video = z.infer<typeof VideoSchema>;
export type Talk = z.infer<typeof TalkSchema>;

export interface SiteContent {
  projects: Project[];
  posts: Post[];
  videos: Video[];
  talks: Talk[];
  aiCapabilities: AiCapability[];
  recipes: Recipe[];
}

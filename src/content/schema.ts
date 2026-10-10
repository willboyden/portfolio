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
    heroImage: z.string().min(1).optional(),
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

/** Whole generated bundle — what `src/content/generated/content.json` must satisfy. */
export const SiteContentSchema = z
  .object({
    contentHash: z.string().min(1),
    projects: z.array(ProjectSchema),
    posts: z.array(PostSchema),
    videos: z.array(VideoSchema),
    talks: z.array(TalkSchema),
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
}

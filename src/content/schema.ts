/**
 * Content schema (CONTRACT.md §4) — the single validation contract between
 * `content/**/*.md` files, `scripts/build-content.mjs`, and the app.
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

const baseShape = {
  slug: Slug,
  title: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)),
  date: IsoDate,
};

export const ProjectLinksSchema = z
  .object({
    source: z.string().url(),
    demo: z.string().url(),
    paper: z.string().url(),
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
    links: ProjectLinksSchema,
    metrics: z.array(ProjectMetricSchema).optional(),
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
    /** Sanitized rendered markdown — the build pipeline's output. */
    html: z.string().min(1),
    excerpt: z.string().min(1),
  })
  .strict();

export const VideoSchema = z
  .object({
    ...baseShape,
    url: z.string().url(),
    embedId: z.string().min(1).optional(),
    provider: z.enum(['youtube', 'vimeo', 'other']),
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
    slidesUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    abstract: z.string().min(1),
  })
  .strict();

/** Whole generated bundle — what `src/content/generated/content.json` must satisfy. */
export const SiteContentSchema = z
  .object({
    generatedAt: z.string().min(1),
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

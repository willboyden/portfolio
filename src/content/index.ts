/**
 * TEMPORARY stub implementing the CONTRACT §4 content API so page builders
 * can compile before the content pipeline lands. scripts/build-content.mjs +
 * the real index.ts (content-pipeline) replace this file; the exported API
 * is identical, so page code does not change.
 */
export interface ProjectLinks {
  source?: string;
  demo?: string;
  paper?: string;
}
export interface ProjectMetric {
  label: string;
  value: string;
}
export interface Project {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  date: string;
  role: string;
  status: 'shipped' | 'active' | 'archived';
  period: string;
  highlights: string[];
  stack: string[];
  links: ProjectLinks;
  metrics?: ProjectMetric[];
  featured: boolean;
  accent?: string;
  html?: string;
}
export interface Post {
  slug: string;
  title: string;
  summary: string;
  excerpt: string;
  tags: string[];
  date: string;
  readingMinutes: number;
  series?: string;
  heroImage?: string;
  html: string;
}
export interface Video {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  date: string;
  url: string;
  embedId?: string;
  provider: 'youtube' | 'vimeo' | 'other';
  duration: string;
  speakers?: string[];
  event?: string;
}
export interface Talk {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  date: string;
  event: string;
  location: string;
  slidesUrl?: string;
  videoUrl?: string;
  abstract: string;
}
export interface SiteContent {
  projects: Project[];
  posts: Post[];
  videos: Video[];
  talks: Talk[];
}

import raw from './generated/content.json';

export const content: SiteContent = raw as unknown as SiteContent;

export function getProject(slug: string): Project | undefined {
  return content.projects.find((p) => p.slug === slug);
}
export function getPost(slug: string): Post | undefined {
  return content.posts.find((p) => p.slug === slug);
}
export function postsByDate(): Post[] {
  return [...content.posts].sort((a, b) => (a.date < b.date ? 1 : -1));
}
export function featuredProjects(): Project[] {
  return content.projects.filter((p) => p.featured);
}
export function allTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of [...content.projects, ...content.posts, ...content.videos, ...content.talks]) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

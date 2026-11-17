/**
 * The site's open choices: each is one switch, and each switch really turns
 * its thing off.
 *
 * Nothing here (or anywhere in the suite) pins a switch to `true`: turning one
 * off must never need a test edited. Tests that describe what a switch shows
 * read the switch.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { content, measuredPosts, withChoices, type SiteContent } from 'app/content';
import { CHOICES, type SiteChoices } from './site-choices';

const ALL_ON: SiteChoices = { headlineNumbers: true, smallVideoCoversOnPhones: true };
const off = (key: keyof SiteChoices): SiteChoices => ({ ...ALL_ON, [key]: false });

/* A small site with one measured post and one without: enough to see what a
 * switch does without depending on which way the real one points. */
const [first, second] = content.posts;
const site: SiteContent = {
  ...content,
  posts: [
    { ...(first as SiteContent['posts'][number]), keyMetric: { value: '786 tok/s', label: 'across 128 requests' } },
    (({ keyMetric: _none, ...rest }) => rest)(second as SiteContent['posts'][number]),
  ],
};

describe('site choices', () => {
  it('every choice is a plain on/off switch, and REDESIGN.md explains each one', () => {
    const guide = readFileSync(join(process.cwd(), 'REDESIGN.md'), 'utf8');
    expect(Object.keys(CHOICES).sort()).toEqual(Object.keys(ALL_ON).sort());
    for (const [name, value] of Object.entries(CHOICES)) {
      expect(typeof value, name).toBe('boolean');
      expect(guide, `REDESIGN.md does not mention ${name}`).toContain(`\`${name}\``);
    }
  });

  it('headline numbers on: the content is passed through untouched', () => {
    expect(withChoices(site, ALL_ON)).toBe(site);
    expect(withChoices(site, ALL_ON).posts[0]?.keyMetric?.value).toBe('786 tok/s');
  });

  it('headline numbers off: no post carries one, and nothing else changes', () => {
    const hidden = withChoices(site, off('headlineNumbers'));
    expect(hidden.posts).toHaveLength(site.posts.length);
    expect(hidden.posts.every((post) => !('keyMetric' in post))).toBe(true);
    const { keyMetric: _hidden, ...rest } = site.posts[0] as SiteContent['posts'][number];
    expect(hidden.posts[0]).toEqual(rest);
    expect(hidden.posts[1]).toEqual(site.posts[1]);
    expect(hidden.projects).toBe(site.projects);
    expect(hidden.videos).toBe(site.videos);
  });

  it('the video-row switch does not touch the content', () => {
    expect(withChoices(site, off('smallVideoCoversOnPhones'))).toBe(site);
  });

  it('the pages get the content the current switches say they should', () => {
    const anyMeasured = content.posts.some((post) => post.keyMetric !== undefined);
    if (CHOICES.headlineNumbers) {
      expect(anyMeasured).toBe(true);
      expect(measuredPosts(4).length).toBeGreaterThan(0);
    } else {
      expect(anyMeasured).toBe(false);
      expect(measuredPosts(4)).toEqual([]);
    }
  });
});

/**
 * How the browser takes the page over: adopt the prerendered markup when the
 * first render is sure to match it, replace it otherwise.
 */
import { describe, expect, it } from 'vitest';
import { bootMode, trimPath, type BootFacts } from './boot';

const facts = (over: Partial<BootFacts>): BootFacts => ({
  prerenderedPath: '/',
  hasMarkup: true,
  pathname: '/',
  search: '',
  ...over,
});

describe('trimPath', () => {
  it('treats a trailing slash as the same page and keeps the root', () => {
    expect(trimPath('/writing/')).toBe('/writing');
    expect(trimPath('/writing')).toBe('/writing');
    expect(trimPath('/writing/a-post///')).toBe('/writing/a-post');
    expect(trimPath('/')).toBe('/');
    expect(trimPath('')).toBe('/');
  });
});

describe('bootMode', () => {
  it('adopts the markup when the page in the address bar is the page that was rendered', () => {
    expect(bootMode(facts({}))).toBe('hydrate');
    /* Pages are prerendered without a trailing slash and served with one. */
    expect(bootMode(facts({ prerenderedPath: '/writing', pathname: '/writing/' }))).toBe('hydrate');
    expect(bootMode(facts({ prerenderedPath: '/projects/agent-hub', pathname: '/projects/agent-hub/' }))).toBe(
      'hydrate',
    );
  });

  it('a hash does not change the page, so it does not change the answer', () => {
    /* The hash is not part of the facts at all: the server render never
     * depends on it, and neither does the first client render. */
    expect(Object.keys(facts({}))).not.toContain('hash');
  });

  it('replaces the markup when there is a query string (the first render may read it)', () => {
    expect(bootMode(facts({ prerenderedPath: '/writing', pathname: '/writing/', search: '?page=2' }))).toBe('render');
    expect(bootMode(facts({ search: '?utm_source=x' }))).toBe('render');
  });

  it('replaces the markup when there is nothing prerendered to adopt (the dev server)', () => {
    expect(bootMode(facts({ prerenderedPath: null }))).toBe('render');
    expect(bootMode(facts({ hasMarkup: false }))).toBe('render');
  });

  it('replaces the not-found page: it was rendered for another path than the one in the address bar', () => {
    /* The host serves its not-found page for every unknown address. The
     * navigation prints the current path, so that markup is never exactly
     * what the app renders here; adopting it would keep the wrong attribute. */
    for (const pathname of ['/nope/', '/writing/extra/deep/', '/projects/a/b', '/writing/']) {
      expect(bootMode(facts({ prerenderedPath: '/404', pathname })), pathname).toBe('render');
    }
    /* Asked for by its own address, it is this page: adopt it. */
    expect(bootMode(facts({ prerenderedPath: '/404', pathname: '/404/' }))).toBe('hydrate');
  });

  it('replaces the markup when it was rendered for a different page than the address', () => {
    expect(bootMode(facts({ prerenderedPath: '/about', pathname: '/now/' }))).toBe('render');
    expect(bootMode(facts({ prerenderedPath: '/', pathname: '/about/' }))).toBe('render');
    expect(bootMode(facts({ prerenderedPath: '/writing/post-a', pathname: '/writing/post-b/' }))).toBe('render');
  });
});

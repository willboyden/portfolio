import { matchRoute, parseLocation } from '@portfolio/router';

/* R3-A F6 regression: a malformed percent-encoded segment must not throw
 * URIError from decodeURIComponent inside render — a throw there has no
 * error boundary (main.tsx createRoot().render, no boundary), so the SPA
 * would white-screen. Contract: fall back to the raw segment. */
describe('matchRoute malformed encoding (R3-A F6)', () => {
  it('truncated % at end of segment yields raw param, no throw', () => {
    const params = matchRoute('/projects/:slug', '/projects/%');
    expect(params).not.toBeNull();
    expect(params!['slug']).toBe('%');
  });

  it('invalid escape sequence mid-segment yields raw param, no throw', () => {
    const params = matchRoute('/writing/:slug', '/writing/zz%zz');
    expect(params!['slug']).toBe('zz%zz');
  });

  it('valid encoding still decodes', () => {
    const params = matchRoute('/projects/:slug', '/projects/duckdb-mcp%20x');
    expect(params!['slug']).toBe('duckdb-mcp x');
  });

  it('parseLocation survives a malformed query too (search is raw, no decode)', () => {
    expect(() => parseLocation('http://x/writing?page=%')).not.toThrow();
  });
});

/**
 * Config lint (R1-C #1, #6) — static guards for the deploy layer.
 *
 * nginx's add_header inheritance is all-or-nothing: a location that declares
 * any add_header loses every server-level header. The config keeps security
 * headers in one snippet that EVERY add_header-bearing location must include;
 * this test enforces that invariant without needing nginx installed.
 *
 * Also pins the CSP string parity between nginx.conf and the preview server
 * (serve-dist.mjs) — e2e asserts the runtime side; this asserts the file side.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const nginx = readFileSync(resolve(root, 'deploy/nginx.conf'), 'utf8');
const snippet = readFileSync(resolve(root, 'deploy/snippets/security-headers.conf'), 'utf8');
const serveDist = readFileSync(resolve(root, 'scripts/serve-dist.mjs'), 'utf8');

/** Split the server block into location chunks: [{header, body}]. */
function locations(conf: string): { header: string; body: string }[] {
  const out: { header: string; body: string }[] = [];
  const re = /location\s+([^{]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conf))) {
    const header = m[1]!.trim();
    let depth = 1;
    let i = re.lastIndex;
    const start = i;
    while (i < conf.length && depth > 0) {
      if (conf[i] === '{') depth += 1;
      if (conf[i] === '}') depth -= 1;
      i += 1;
    }
    out.push({ header, body: conf.slice(start, i - 1) });
  }
  return out;
}

describe('nginx config invariants (R1-C #1)', () => {
  const locs = locations(nginx);

  it('parses the expected number of locations (update this test deliberately)', () => {
    expect(locs.length).toBeGreaterThanOrEqual(7);
  });

  for (const loc of locations(nginx)) {
    const usesAddHeader = /\badd_header\b/.test(loc.body);
    if (usesAddHeader) {
      it(`location ${loc.header} sets add_header AND includes the security snippet`, () => {
        expect(loc.body).toMatch(/include\s+snippets\/security-headers\.conf;/);
      });
    }
  }

  it('server level also includes the snippet (inheritance for header-free locations)', () => {
    /* Line scan with brace-depth tracking: an include at depth 1 is server-level.
     * (A naive strip-locations regex false-matches the word "location" in
     * comments, which is what this test's first draft did.) */
    let depth = 0;
    let serverLevelInclude = false;
    for (const rawLine of nginx.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('#')) continue;
      const opens = (rawLine.match(/\{/g) ?? []).length;
      const closes = (rawLine.match(/\}/g) ?? []).length;
      if (depth === 1 && /include\s+snippets\/security-headers\.conf;/.test(line)) {
        serverLevelInclude = true;
      }
      depth += opens - closes;
    }
    expect(serverLevelInclude).toBe(true);
  });
});

describe('security headers snippet content', () => {
  for (const header of [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Cross-Origin-Opener-Policy',
    'Content-Security-Policy',
  ]) {
    it(`declares ${header} with "always"`, () => {
      const line = snippet.split('\n').find((l) => l.includes(`add_header ${header}`));
      expect(line, `${header} missing from snippet`).toBeDefined();
      expect(line).toContain('always');
    });
  }

  it('has no data: in img-src and pins object-src none (R1-C #8)', () => {
    const csp = snippet.match(/Content-Security-Policy "([^"]+)"/)?.[1] ?? '';
    expect(csp).toMatch(/img-src 'self';/);
    expect(csp).toMatch(/object-src 'none'/);
  });
});

describe('CSP parity: nginx snippet ↔ preview server ↔ e2e (R1-C #1 drift guard)', () => {
  const nginxCsp = snippet.match(/Content-Security-Policy "([^"]+)"/)?.[1] ?? '';

  it('serve-dist.mjs ships the identical CSP string', () => {
    expect(nginxCsp).not.toBe('');
    expect(serveDist).toContain(nginxCsp);
  });
});

describe('container contract (deploy/Dockerfile*, .dockerignore)', () => {
  const dockerfile = readFileSync(resolve(root, 'deploy/Dockerfile'), 'utf8');
  const prebuilt = readFileSync(resolve(root, 'deploy/Dockerfile.prebuilt'), 'utf8');
  const dockerignore = readFileSync(resolve(root, '.dockerignore'), 'utf8');

  it('both variants ship the SAME nginx config + snippets layout', () => {
    for (const [name, df] of Object.entries({ 'Dockerfile': dockerfile, 'Dockerfile.prebuilt': prebuilt })) {
      expect(df, name).toContain('nginx:1.27-alpine');
      expect(df, name).toContain('COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf');
      expect(df, name).toContain('COPY deploy/snippets /etc/nginx/snippets');
      /* The stock default.conf listens on 80 with its own headers — leaving it
       * would double-declare server blocks. */
      expect(df, name).toContain('rm /etc/nginx/conf.d/default.conf');
      expect(df, name).toMatch(/HEALTHCHECK/);
    }
  });

  it('CI variant needs a lockfile; prebuilt variant never runs npm', () => {
    /* Honest split (container verification): `npm ci` in the offline sandbox
     * is impossible and there is no committed lockfile — so the prebuilt
     * Dockerfile must not pretend otherwise. Check INSTRUCTIONS, not comments. */
    const instructions = (df: string) =>
      df.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    expect(instructions(dockerfile)).toContain('npm ci');
    expect(instructions(prebuilt)).not.toMatch(/\bnpm\b|\bnode\b/);
    expect(prebuilt).toContain('COPY dist /usr/share/nginx/html');
  });

  it('prebuilt healthcheck uses a probe the alpine image actually has', () => {
    /* nginx:alpine has no wget (that was the R2-C copy-paste trap). */
    const hc = prebuilt.match(/HEALTHCHECK[\s\S]*$/)?.[0] ?? '';
    expect(hc).toContain('nc -z 127.0.0.1 80');
    expect(hc).not.toContain('wget');
  });

  it('.dockerignore keeps the prebuilt context lean and never ships secrets', () => {
    const lines = dockerignore.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const must of ['.git', 'node_modules', 'e2e']) {
      expect(lines, `missing ${must}`).toContain(must);
    }
    /* Secrets must never reach the build context. The patterns are Pinned as
     * present in .dockerignore — not "either way" (R3C-08: the old assertion
     * was `X || true` and could never fail). */
    for (const secret of ['.env', '*.key', '.ssh']) {
      expect(lines, `dockerignore lists ${secret}`).toContain(secret);
    }
    /* dist must NOT be ignored — the prebuilt image copies it. */
    expect(lines).not.toContain('dist');
  });

  it('nginx.conf enforces the caching contract e2e asserts', () => {
    /* 07-caching.e2e asserts runtime behavior against the preview server; the
     * REAL nginx config must carry the same three rules (drift guard). */
    const lc = nginx.toLowerCase();
    expect(lc).toContain('immutable');
    expect(lc).toMatch(/cache-control[^;]*no-store/);
    /* expires/etag off for no-store HTML avoids 304s beating no-store */
    const htmlLoc = locations(nginx).find((l) => /index\.html|html|try_files|\//.test(l.header) && /no-store/.test(l.body.toLowerCase()));
    expect(htmlLoc, 'an HTML location must set no-store').toBeDefined();
    expect(htmlLoc!.body.toLowerCase()).toMatch(/add_header cache-control/);
    expect(htmlLoc!.body.toLowerCase()).toMatch('security-headers.conf'); // include snippet
  });
});

describe('theme storage key single-source (R4-C F4)', () => {
  it('one TS literal, consumers import, theme-init.js pinned equal', async () => {
    const { THEME_STORAGE_KEY } = await import('app/lib/storage');
    const storage = readFileSync(resolve(root, 'src/lib/storage.ts'), 'utf8');
    const tp = readFileSync(resolve(root, 'src/components/layout/ThemePreference.tsx'), 'utf8');
    const tpr = readFileSync(resolve(root, 'src/theme/ThemeProvider.tsx'), 'utf8');
    const init = readFileSync(resolve(root, 'public/theme-init.js'), 'utf8');
    const defs = (storage.match(/(?:export )?const THEME_STORAGE_KEY = '[^']+'/g) ?? []).length;
    expect(defs, 'THEME_STORAGE_KEY literal defined once (storage.ts)').toBe(1);
    expect(tp).toContain("import { THEME_STORAGE_KEY } from 'app/lib/storage'");
    expect(tpr).toContain('THEME_STORAGE_KEY as THEME_INIT_SCRIPT_STORAGE_KEY');
    /* the pre-bundle script cannot import -> its literal is pinned equal */
    expect(init).toContain(`'${THEME_STORAGE_KEY}'`);
  });
});

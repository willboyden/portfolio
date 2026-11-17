/**
 * The zod door: jitless is on, and nothing that ships reaches zod another way.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from './z';

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

describe('zod door (src/lib/z.ts)', () => {
  it('switches zod to jitless, so it never probes for eval under the page policy', () => {
    expect(z.config().jitless).toBe(true);
  });

  it('still parses objects exactly as before (jitless changes the route, not the result)', () => {
    const schema = z.object({ theme: z.enum(['light', 'dark']), n: z.number().int().optional() }).strict();
    expect(schema.parse({ theme: 'dark', n: 3 })).toEqual({ theme: 'dark', n: 3 });
    expect(schema.safeParse({ theme: 'blue' }).success).toBe(false);
    expect(schema.safeParse({ theme: 'dark', extra: 1 }).success).toBe(false);
  });

  it('parsing an object schema never calls the Function constructor', () => {
    /* The probe zod would run is `new Function("")`. Count constructions while
     * a fresh object schema parses for the first time. */
    const Original = globalThis.Function;
    let constructed = 0;
    const Counting = new Proxy(Original, {
      construct(target, args) {
        constructed += 1;
        return Reflect.construct(target, args) as object;
      },
      apply(target, thisArg, args) {
        constructed += 1;
        return Reflect.apply(target, thisArg, args) as unknown;
      },
    });
    globalThis.Function = Counting;
    try {
      const fresh = z.object({ a: z.string(), b: z.object({ c: z.number() }) });
      expect(fresh.parse({ a: 'x', b: { c: 1 } })).toEqual({ a: 'x', b: { c: 1 } });
    } finally {
      globalThis.Function = Original;
    }
    expect(constructed).toBe(0);
  });

  it('no shipped module imports zod directly (every one would skip the jitless switch)', () => {
    const direct = sourceFiles(SRC).filter((file) => {
      if (file === join(SRC, 'lib', 'z.ts')) return false;
      return /from\s+['"]zod(\/[^'"]*)?['"]/.test(readFileSync(file, 'utf8'));
    });
    expect(direct.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});

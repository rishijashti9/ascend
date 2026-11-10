// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The web app gets its Content-Security-Policy from vercel.json (a header); the Android app,
 * which loads files locally, from a <meta> tag in index.html. They must say the same thing —
 * except frame-ancestors, which only works as a header.
 */
const root = process.cwd();
const directives = (policy: string) =>
  new Map(
    policy
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name = '', ...values] = d.split(/\s+/);
        return [name, values.sort().join(' ')] as const;
      }),
  );

const header = (() => {
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const all = vercel.headers.find((h) => h.source === '/(.*)');
  return all?.headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
})();

const meta = (() => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  return /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? '';
})();

describe('Content-Security-Policy: header and <meta> agree', () => {
  it('both exist', () => {
    expect(header).toContain("default-src 'self'");
    expect(meta).toContain("default-src 'self'");
  });

  it('same directives and sources, apart from frame-ancestors (header only)', () => {
    const h = directives(header);
    const m = directives(meta);
    expect(h.get('frame-ancestors')).toBe("'none'");
    expect(m.has('frame-ancestors')).toBe(false);
    h.delete('frame-ancestors');
    expect(Object.fromEntries(m)).toEqual(Object.fromEntries(h));
  });

  it('never allows inline or eval scripts', () => {
    for (const policy of [header, meta]) {
      const script = directives(policy).get('script-src') ?? '';
      expect(script).toBe("'self'");
    }
  });
});

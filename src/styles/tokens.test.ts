import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads the hex colour tokens of one block in tokens.css. */
function readTokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Block ${selector} not found`);
  const block = css.slice(start, css.indexOf('}', start));
  const tokens: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return tokens;
}

/** Every theme file (Phase 12): src/styles/themes/<id>.css with a :root[data-theme='<id>'] block. */
const dir = resolve(process.cwd(), 'src/styles/themes');
const themes = readdirSync(dir)
  .filter((f) => f.endsWith('.css'))
  .map((f) => {
    const id = f.replace(/.css$/, '');
    const css = readFileSync(resolve(dir, f), 'utf8');
    return [id, readTokens(css, `:root[data-theme='${id}']`)] as const;
  });

const TEXT = 4.5; // WCAG AA normal text
const UI = 3; // WCAG AA non-text elements

const textColours = [
  'text',
  'muted',
  'accent-text',
  'str-text',
  'int-text',
  'wil-text',
  'success-text',
  'warning-text',
  'error-text',
  'missed',
];

function c(t: Record<string, string>, key: string): string {
  const value = t[key];
  if (!value) throw new Error(`Missing token --${key}`);
  return value;
}

it('finds the theme files', () => {
  expect(themes.map(([id]) => id)).toContain('elevate');
});

const TILES = ['lime', 'white', 'yellow', 'grey', 'violet'];

describe.each(themes)('%s theme', (_name, t) => {
  it('defines every colour token', () => {
    for (const key of [...textColours, 'bg', 'surface', 'surface-2', 'border', 'accent']) {
      expect(t[key], key).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(textColours)('%s passes AA on bg, surface and surface-2', (key) => {
    for (const bg of ['bg', 'surface', 'surface-2']) {
      expect(contrast(c(t, key), c(t, bg)), `${key} on ${bg}`).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it.each(TILES)('text on the %s tile passes AA', (tile) => {
    if (!t[`tile-${tile}`]) return; // themes without bento tiles
    expect(contrast(c(t, `on-tile-${tile}`), c(t, `tile-${tile}`))).toBeGreaterThanOrEqual(TEXT);
  });

  // Muted text is used only on the light tiles; violet and grey tiles use full-strength text.
  it('muted text on the light tiles (lime, white, yellow) passes AA', () => {
    if (!t['on-tile-muted']) return;
    for (const tile of ['lime', 'white', 'yellow']) {
      expect(contrast(c(t, 'on-tile-muted'), c(t, `tile-${tile}`)), tile).toBeGreaterThanOrEqual(
        TEXT,
      );
    }
  });

  it('primary button label passes AA', () => {
    expect(contrast(c(t, 'on-accent'), c(t, 'accent-fill'))).toBeGreaterThanOrEqual(TEXT);
  });

  it('primary button stands out from the surface (3:1)', () => {
    expect(contrast(c(t, 'accent-fill'), c(t, 'surface'))).toBeGreaterThanOrEqual(UI);
  });
});

describe.each(themes)('%s theme fills', (_name, t) => {
  it.each(['accent', 'str', 'int', 'wil', 'success', 'warning', 'error'])(
    '%s fill is visible on the surface (3:1)',
    (key) => {
      expect(contrast(c(t, key), c(t, 'surface'))).toBeGreaterThanOrEqual(UI);
    },
  );
});

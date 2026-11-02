import { readFileSync } from 'node:fs';
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
  if (start < 0) throw new Error(`Block ${selector} not found in tokens.css`);
  const block = css.slice(start, css.indexOf('}', start));
  const tokens: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return tokens;
}

const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const light = readTokens(css, ':root');
const dark = { ...light, ...readTokens(css, ":root[data-theme='dark']") };

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

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, t) => {
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

  it('primary button label passes AA', () => {
    expect(contrast(c(t, 'on-accent'), c(t, 'accent-fill'))).toBeGreaterThanOrEqual(TEXT);
  });

  it('primary button stands out from the surface (3:1)', () => {
    expect(contrast(c(t, 'accent-fill'), c(t, 'surface'))).toBeGreaterThanOrEqual(UI);
  });
});

describe('dark theme fills', () => {
  it.each(['accent', 'str', 'int', 'wil', 'success', 'warning', 'error'])(
    '%s fill is visible on dark surfaces (3:1)',
    (key) => {
      expect(contrast(c(dark, key), c(dark, 'surface'))).toBeGreaterThanOrEqual(UI);
    },
  );
});

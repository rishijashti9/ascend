import type { DayString } from '@/core/db/types';
import { addDays, diffDays } from '@/core/time';

/** "Nice" round axis ticks covering [min, max] (about `count` of them). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  // Round outward on both ends so every value sits inside the grid.
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 1e-6; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/** Every day from `from` to `to`, with the value for that day (or null). */
export function dailySeries(
  from: DayString,
  to: DayString,
  values: ReadonlyMap<DayString, number>,
): { day: DayString; value: number | null }[] {
  const n = Math.max(0, diffDays(from, to));
  return Array.from({ length: n + 1 }, (_, i) => {
    const day = addDays(from, i);
    return { day, value: values.get(day) ?? null };
  });
}

/** Axis number: in full under 10,000, compact above (12.5K). */
export function axisNumber(v: number): string {
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 100) / 10}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** "2 Nov" for axis labels. */
export function shortDay(day: DayString): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

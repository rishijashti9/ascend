import type { DayString, Stat } from '@/core/db/types';
import { STATS } from '@/core/db/types';
import { addDays, diffDays, weekStartOf, type Weekday } from '@/core/time';
import type { DaySummary } from './progressState';

/** Profile helpers (SPEC 7.8), pure: XP history, the activity heatmap, the weakest stat. */

/** XP per week for the last `weeks` weeks (oldest first), the current week last. */
export function weeklyXp(
  perDay: Record<DayString, Pick<DaySummary, 'xp'>>,
  today: DayString,
  weekStartsOn: Weekday,
  weeks = 12,
): { day: DayString; value: number }[] {
  const current = weekStartOf(today, weekStartsOn);
  const first = addDays(current, -7 * (weeks - 1));
  const totals = Array.from({ length: weeks }, (_, i) => ({
    day: addDays(first, 7 * i),
    value: 0,
  }));
  for (const [d, s] of Object.entries(perDay)) {
    if (d < first || d > today) continue;
    const bucket = totals[Math.floor(diffDays(first, d) / 7)];
    if (bucket) bucket.value += s.xp;
  }
  return totals;
}

/** 0 = not active (or no record), 1 = active, 2 = Daily Clear. */
export type HeatLevel = 0 | 1 | 2;

export interface HeatCell {
  day: DayString;
  level: HeatLevel;
  xp: number;
  /** After today or before the first day of play: drawn as an outline only. */
  outside: boolean;
}

/**
 * One year as GitHub-style columns: each column is a week (starting on the chosen week day),
 * each row a weekday; null pads the days before 1 Jan and after 31 Dec.
 */
export function heatmapYear(
  perDay: Record<DayString, Pick<DaySummary, 'xp' | 'active' | 'dailyClear'>>,
  year: number,
  weekStartsOn: Weekday,
  today: DayString,
  startDay: DayString,
): (HeatCell | null)[][] {
  const jan1 = `${year}-01-01`;
  const dec31 = `${year}-12-31`;
  const columns: (HeatCell | null)[][] = [];
  for (let week = weekStartOf(jan1, weekStartsOn); week <= dec31; week = addDays(week, 7)) {
    columns.push(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(week, i);
        if (day < jan1 || day > dec31) return null;
        const s = perDay[day];
        const level: HeatLevel = s?.dailyClear ? 2 : s?.active ? 1 : 0;
        return { day, level, xp: s?.xp ?? 0, outside: day > today || day < startDay };
      }),
    );
  }
  return columns;
}

/**
 * The stat to nudge gently: the lowest level, if it trails the highest by 2+ levels
 * (a one-level gap is normal day-to-day noise). Ties go to the first in STATS order.
 */
export function weakestStat(levels: Record<Stat, number>): Stat | null {
  const max = Math.max(...STATS.map((s) => levels[s]));
  let weakest: Stat = 'STR';
  for (const s of STATS) if (levels[s] < levels[weakest]) weakest = s;
  return max - levels[weakest] >= 2 ? weakest : null;
}

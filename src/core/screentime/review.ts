import type { ScreenDay, ScreenRuleValues } from '@/core/db/types';
import { addDays, diffDays, type DayString } from '@/core/time';
import { combineDays, entertainmentSeconds } from './apps';
import { formatMinutes } from './observe';

/**
 * The one weekly-review line (SPEC 6.8): entertainment this week vs the same days of last week.
 * No XP loss, no guilt — just the numbers.
 */
export interface WeekComparison {
  thisSec: number;
  lastSec: number;
  /** Last week had readings on those days (otherwise there's nothing to compare). */
  hasLast: boolean;
}

export function compareWeeks(
  records: readonly ScreenDay[],
  rules: Pick<ScreenRuleValues, 'added_apps' | 'removed_apps'>,
  weekStart: DayString,
  today: DayString,
): WeekComparison {
  const span = Math.min(6, Math.max(0, diffDays(weekStart, today)));
  const sum = (from: DayString) => {
    let sec = 0;
    let any = false;
    for (let i = 0; i <= span; i++) {
      const day = addDays(from, i);
      const recs = records.filter((r) => r.day === day && !r.deleted_at);
      if (recs.length) any = true;
      sec += entertainmentSeconds(combineDays(recs), rules);
    }
    return { sec, any };
  };
  const now = sum(weekStart);
  const before = sum(addDays(weekStart, -7));
  return { thisSec: now.sec, lastSec: before.sec, hasLast: before.any };
}

export function weekLine(c: WeekComparison): string {
  const t = formatMinutes(Math.round(c.thisSec / 60));
  if (!c.hasLast) return `Entertainment this week: ${t}.`;
  const diff = Math.round((c.thisSec - c.lastSec) / 60);
  if (Math.abs(diff) < 5) return `Entertainment this week: ${t} — about the same as last week.`;
  return diff < 0
    ? `Entertainment this week: ${t} — ${formatMinutes(-diff)} less than the same days last week.`
    : `Entertainment this week: ${t} — ${formatMinutes(diff)} more than the same days last week.`;
}

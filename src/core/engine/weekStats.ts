import type { DayString, FocusSession, Quest } from '@/core/db/types';
import { addDays } from '@/core/time';

/** A week at a glance for the weekly review (SPEC 7.7), pure. */
export interface WeekStats {
  /** Days of the week that have passed (1–7). */
  daysSoFar: number;
  activeDays: number;
  dailyClears: number;
  xp: number;
  focusMin: number;
  weeklyDone: number;
  weeklyTotal: number;
}

export function weekStats(input: {
  weekStart: DayString;
  today: DayString;
  perDay: Record<DayString, { xp: number; active: boolean; dailyClear: boolean }>;
  sessions: readonly Pick<FocusSession, 'day' | 'actual_min'>[];
  weeklyQuests: readonly Pick<Quest, 'week_start' | 'status'>[];
}): WeekStats {
  const days = Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i)).filter(
    (d) => d <= input.today,
  );
  const inWeek = new Set(days);
  const quests = input.weeklyQuests.filter(
    (q) => q.week_start === input.weekStart && q.status !== 'archived',
  );
  return {
    daysSoFar: days.length,
    activeDays: days.filter((d) => input.perDay[d]?.active).length,
    dailyClears: days.filter((d) => input.perDay[d]?.dailyClear).length,
    xp: days.reduce((sum, d) => sum + (input.perDay[d]?.xp ?? 0), 0),
    focusMin: input.sessions
      .filter((s) => inWeek.has(s.day))
      .reduce((sum, s) => sum + s.actual_min, 0),
    weeklyDone: quests.filter((q) => q.status === 'done').length,
    weeklyTotal: quests.length,
  };
}

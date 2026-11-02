import type { DayString, FocusSession, Stat } from '@/core/db/types';
import { addDays } from '@/core/time';

export type LinkedInfo = Record<string, { title: string; stat: Stat }>;

/** The stat a session trained: its own, or its linked quest's. */
export function statOf(s: FocusSession, linked: LinkedInfo): Stat | null {
  return s.stat ?? (s.quest_instance_id ? (linked[s.quest_instance_id]?.stat ?? null) : null);
}

/** This week's focus: total minutes, minutes per stat, sessions and completion. */
export function weekSummary(
  sessions: readonly FocusSession[],
  weekStart: DayString,
  linked: LinkedInfo,
) {
  const end = addDays(weekStart, 7);
  const week = sessions.filter((s) => s.day >= weekStart && s.day < end);
  const perStat: Record<Stat, number> = { STR: 0, INT: 0, WIL: 0 };
  for (const s of week) {
    const stat = statOf(s, linked);
    if (stat) perStat[stat] += s.actual_min;
  }
  return {
    minutes: week.reduce((sum, s) => sum + s.actual_min, 0),
    perStat,
    sessions: week.length,
    completed: week.filter((s) => s.completed).length,
  };
}

/** Sessions grouped by day, newest day first (at most `days` days). */
export function byDay(sessions: readonly FocusSession[], days = 14): [DayString, FocusSession[]][] {
  const groups = new Map<DayString, FocusSession[]>();
  for (const s of sessions) groups.set(s.day, [...(groups.get(s.day) ?? []), s]);
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, days);
}

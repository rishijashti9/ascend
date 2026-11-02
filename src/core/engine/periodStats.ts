import type { DayString, FocusSession, Review } from '@/core/db/types';
import { addDays, diffDays, parseDay } from '@/core/time';
import { levelFromXp } from './levels';
import type { DaySummary } from './progressState';

/** A month or a year at a glance for the monthly / yearly summaries (SPEC 7.7), pure. */
export interface PeriodStats {
  /** Days of the period that have passed (and are on or after the start day). */
  daysSoFar: number;
  activeDays: number;
  dailyClears: number;
  xp: number;
  levelStart: number;
  levelEnd: number;
  focusMin: number;
  questsDone: number;
  milestonesDone: number;
  /** Longest streak reached on any day of the period. */
  bestStreak: number;
  checkIns: number;
  /** Averages of the daily check-ins (1 decimal), null when none were rated. */
  avgEnergy: number | null;
  avgMood: number | null;
}

export type PeriodType = 'monthly' | 'yearly';

/** First and last day of a period: "2026-11" → Nov 1–30, "2026" → Jan 1 – Dec 31. */
export function periodRange(type: PeriodType, period: string): { from: DayString; to: DayString } {
  if (type === 'yearly') return { from: `${period}-01-01`, to: `${period}-12-31` };
  const { year, month } = parseDay(`${period}-01`);
  const next =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { from: `${period}-01`, to: addDays(next, -1) };
}

/** The period a day belongs to ("2026-11" or "2026"). */
export const periodOf = (type: PeriodType, day: DayString): string =>
  type === 'yearly' ? day.slice(0, 4) : day.slice(0, 7);

/** The period before / after ("2026-01" ↔ "2025-12"). */
export function shiftPeriod(type: PeriodType, period: string, by: number): string {
  if (type === 'yearly') return String(Number(period) + by);
  const { year, month } = parseDay(`${period}-01`);
  const index = year * 12 + (month - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

const average = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

export function periodStats(input: {
  from: DayString;
  to: DayString;
  today: DayString;
  /** The first day of play: days before it don't count as passed. */
  startDay: DayString;
  perDay: Record<DayString, DaySummary>;
  sessions: readonly Pick<FocusSession, 'day' | 'actual_min'>[];
  /** App days on which milestones were marked done. */
  milestoneDays: readonly DayString[];
  checkIns: readonly Pick<Review, 'type' | 'period' | 'energy' | 'mood'>[];
}): PeriodStats {
  const { from, to, perDay } = input;
  const inPeriod = (d: DayString) => d >= from && d <= to;
  const days = Object.keys(perDay).filter(inPeriod);
  const sum = (pick: (d: DaySummary) => number) =>
    days.reduce((total, d) => total + pick(perDay[d] as DaySummary), 0);

  let before = 0;
  for (const [d, s] of Object.entries(perDay)) if (d < from) before += s.xp;
  const xp = sum((d) => d.xp);

  const first = input.startDay > from ? input.startDay : from;
  const last = input.today < to ? input.today : to;
  const checkIns = input.checkIns.filter((r) => r.type === 'daily' && inPeriod(r.period));

  return {
    daysSoFar: last < first ? 0 : diffDays(first, last) + 1,
    activeDays: days.filter((d) => perDay[d]?.active).length,
    dailyClears: days.filter((d) => perDay[d]?.dailyClear).length,
    xp,
    levelStart: levelFromXp(before).level,
    levelEnd: levelFromXp(before + xp).level,
    focusMin: input.sessions.filter((s) => inPeriod(s.day)).reduce((t, s) => t + s.actual_min, 0),
    questsDone: sum((d) => d.questsDone),
    milestonesDone: input.milestoneDays.filter(inPeriod).length,
    bestStreak: days.reduce((best, d) => Math.max(best, perDay[d]?.streak ?? 0), 0),
    checkIns: checkIns.length,
    avgEnergy: average(checkIns.flatMap((r) => (r.energy === null ? [] : [r.energy]))),
    avgMood: average(checkIns.flatMap((r) => (r.mood === null ? [] : [r.mood]))),
  };
}

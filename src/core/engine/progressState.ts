import { GAME, type Rank } from '@/config/game';
import type { DayRecord, DayString, QuestInstance, Stat, XpEvent } from '@/core/db/types';
import { STATS } from '@/core/db/types';
import { isRecoveryId } from './instances';
import { levelFromXp, rankFor, type LevelInfo } from './levels';
import { isDone } from './progress';
import {
  computeHabitStreaks,
  computeStreaks,
  toStreakInputs,
  type HabitStreak,
  type StreakSummary,
} from './streaks';
import { computeDayXp, type DayXp } from './xp';

/**
 * The player's whole progress, derived from stored records (pure) — PLAN "Derived state is
 * recomputable". Nothing here is stored: level, stats, rank and streaks always come from
 * xp_events, days and quest_instances, so a rebuild can never disagree with the data.
 */
export interface ProgressInput {
  /** Every day record, in day order. */
  days: readonly Pick<
    DayRecord,
    'day' | 'active' | 'neutral' | 'daily_clear' | 'streak_at_start' | 'closed_at' | 'deleted_at'
  >[];
  xpEvents: readonly Pick<
    XpEvent,
    | 'day'
    | 'occurred_at'
    | 'stat'
    | 'base_amount'
    | 'reason'
    | 'ref_id'
    | 'idempotency_key'
    | 'deleted_at'
  >[];
  instances: readonly Pick<
    QuestInstance,
    'id' | 'source_type' | 'source_id' | 'day' | 'status' | 'core_snapshot' | 'deleted_at'
  >[];
  today: DayString;
}

export interface ProgressState {
  level: LevelInfo;
  stats: Record<Stat, LevelInfo>;
  /** Highest rank reached at the end of any day (ranks never go down). */
  rank: Rank;
  streak: StreakSummary;
  habitStreaks: Record<string, HabitStreak>;
  /** Today's XP so far and the streak it started with (for the streak bonus). */
  today: { day: DayString; xp: DayXp; streakAtStart: number };
  /** Every day with a record or XP: final XP, active, Daily Clear (history, heatmap, reviews). */
  perDay: Record<DayString, { xp: number; active: boolean; dailyClear: boolean }>;
}

const RANK_ORDER: readonly Rank[] = GAME.ranks.map((r) => r.rank);
const higherRank = (a: Rank, b: Rank): Rank =>
  RANK_ORDER.indexOf(b) > RANK_ORDER.indexOf(a) ? b : a;

const EMPTY_DAY: DayXp = { total: 0, byStat: { STR: 0, INT: 0, WIL: 0 }, bonus: 0 };

export function computeProgress(input: ProgressInput): ProgressState {
  const days = input.days.filter((d) => d.deleted_at === null);
  const dayRecord = new Map(days.map((d) => [d.day, d]));

  const eventsByDay = new Map<DayString, ProgressInput['xpEvents'][number][]>();
  for (const e of input.xpEvents) {
    if (e.deleted_at !== null) continue;
    const list = eventsByDay.get(e.day) ?? [];
    list.push(e);
    eventsByDay.set(e.day, list);
  }

  const allDays = [...new Set([...dayRecord.keys(), ...eventsByDay.keys()])].sort();
  const statXp: Record<Stat, number> = { STR: 0, INT: 0, WIL: 0 };
  let total = 0;
  let activeSoFar = 0;
  let rank: Rank = 'E';
  let todayXp = EMPTY_DAY;
  const perDay: ProgressState['perDay'] = {};

  for (const day of allDays) {
    const record = dayRecord.get(day);
    const xp = computeDayXp(
      eventsByDay.get(day) ?? [],
      record?.streak_at_start ?? 0,
      record?.daily_clear ?? false,
    );
    for (const s of STATS) statXp[s] += xp.byStat[s];
    total += xp.total;
    if (record?.active) activeSoFar++;
    rank = higherRank(rank, rankFor(levelFromXp(total).level, activeSoFar));
    if (day === input.today) todayXp = xp;
    perDay[day] = {
      xp: xp.total,
      active: record?.active ?? false,
      dailyClear: record?.daily_clear ?? false,
    };
  }

  const recovered = new Set(
    input.instances
      .filter((i) => i.deleted_at === null && isRecoveryId(i.id) && isDone(i.status))
      .map((i) => i.day),
  );
  const streaks = computeStreaks(toStreakInputs(days, recovered));
  const habitStreaks = computeHabitStreaks(
    input.instances
      .filter((i) => i.deleted_at === null && i.source_type === 'habit')
      .map((i) => ({
        habitId: i.source_id,
        day: i.day,
        done: isDone(i.status),
        core: i.core_snapshot,
      })),
    streaks.days,
    input.today,
  );

  return {
    level: levelFromXp(total),
    stats: {
      STR: levelFromXp(statXp.STR),
      INT: levelFromXp(statXp.INT),
      WIL: levelFromXp(statXp.WIL),
    },
    rank,
    streak: streaks.summary,
    habitStreaks: Object.fromEntries(habitStreaks),
    perDay,
    today: {
      day: input.today,
      xp: todayXp,
      streakAtStart: dayRecord.get(input.today)?.streak_at_start ?? streaks.summary.streak,
    },
  };
}

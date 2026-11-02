import { GAME } from '@/config/game';
import type { DayRecord, DayString } from '@/core/db/types';
import { diffDays } from '@/core/time';

/**
 * Streaks, shields and repair (pure) — SPEC 4.8 "Active day, streaks, recovery" and
 * DECISIONS 2–3. Recomputed from scratch over every day in order, so a late-arriving action
 * that changes an old day gives the same result as if it had arrived on time.
 *
 * - Active day: streak +1, days active +1, shield counter +1 (a shield every 7, max 3).
 * - Neutral day: nothing changes.
 * - Missed day: uses a shield if there is one (streak kept, not increased, counter paused).
 *   Without a shield the streak drops to 0, but it can be repaired: completing the Recovery
 *   quest on the return day (only neutral days in between) restores it, at most once per
 *   rolling 7 days. A repaired day also keeps the streak without increasing it.
 * - The day still in progress (`open`) is never a miss: it can only add to the streak.
 *
 * XP is never lost: an unrepaired miss counts as broken straight away (the return day's
 * `streak_at_start` is 0), and a repair can only raise values afterwards.
 */
export interface StreakDayInput {
  day: DayString;
  active: boolean;
  neutral: boolean;
  /** The day is still in progress (today, not closed yet). */
  open: boolean;
  /** A Recovery quest was completed on this day. */
  recovered: boolean;
}

export type DayStreak = Pick<
  DayRecord,
  'day' | 'streak_at_start' | 'streak_after' | 'shield_used' | 'shields_after' | 'repaired'
>;

export interface StreakSummary {
  /** Current streak (after the last day given). */
  streak: number;
  longest: number;
  /** Lifetime count of active days; never reset, never changed by repair. */
  daysActive: number;
  shields: number;
  /** An unrepaired missed day that a Recovery quest could still repair, and the streak it would restore. */
  repairable: { day: DayString; streak: number } | null;
  /** Day the last repair happened (the day the Recovery quest was completed). */
  lastRepairDay: DayString | null;
}

export interface StreakResult {
  days: DayStreak[];
  summary: StreakSummary;
}

/** Streak inputs from stored day records (in day order) and the days a Recovery quest was done. */
export function toStreakInputs(
  days: readonly Pick<DayRecord, 'day' | 'active' | 'neutral' | 'closed_at'>[],
  recoveredDays: ReadonlySet<DayString>,
): StreakDayInput[] {
  return days.map((d) => ({
    day: d.day,
    active: d.active,
    neutral: d.neutral,
    open: d.closed_at === null,
    recovered: recoveredDays.has(d.day),
  }));
}

/** May a Recovery quest completed on `day` repair a missed day (rolling 7-day limit)? */
export function repairAllowed(lastRepairDay: DayString | null, day: DayString): boolean {
  return lastRepairDay === null || diffDays(lastRepairDay, day) >= GAME.repairWindowDays;
}

interface Pending {
  /** Index of the missed day in `days`. */
  index: number;
  streak: number;
  run: number;
}

export function computeStreaks(input: readonly StreakDayInput[]): StreakResult {
  const days: DayStreak[] = [];
  let streak = 0;
  let run = 0; // consecutive active days toward the next shield
  let shields = 0;
  let daysActive = 0;
  let lastRepairDay: DayString | null = null;
  let pending: Pending | null = null;

  for (const [i, d] of input.entries()) {
    if (pending) {
      if (d.recovered && repairAllowed(lastRepairDay, d.day)) {
        // Repair: the missed day (and neutral days since) keep the streak it had.
        streak = pending.streak;
        run = pending.run;
        lastRepairDay = d.day;
        for (let j = pending.index; j < i; j++) {
          const past = days[j];
          if (!past) continue;
          if (j > pending.index) past.streak_at_start = streak;
          past.streak_after = streak;
        }
        const missed = days[pending.index];
        if (missed) missed.repaired = true;
        pending = null;
      } else if (d.recovered || (!d.neutral && !d.open)) {
        pending = null; // the return day passed without a repair: a fresh start
      }
    }

    const today: DayStreak = {
      day: d.day,
      streak_at_start: streak,
      streak_after: streak,
      shield_used: false,
      shields_after: shields,
      repaired: false,
    };

    if (d.neutral) {
      // Neither breaks nor extends the streak.
    } else if (d.active) {
      streak++;
      run++;
      daysActive++;
      if (run % GAME.shields.earnEvery === 0) shields = Math.min(GAME.shields.max, shields + 1);
    } else if (!d.open && streak > 0) {
      if (shields > 0) {
        shields--;
        today.shield_used = true;
      } else {
        pending = { index: i, streak, run };
        streak = 0;
        run = 0;
      }
    }

    today.streak_after = streak;
    today.shields_after = shields;
    days.push(today);
  }

  const missed = pending ? days[pending.index] : undefined;
  return {
    days,
    summary: {
      streak,
      longest: days.reduce((max, d) => Math.max(max, d.streak_after), 0),
      daysActive,
      shields,
      repairable: pending && missed ? { day: missed.day, streak: pending.streak } : null,
      lastRepairDay,
    },
  };
}

// ---- Per-habit streaks ----

/** One habit's instance on one day (only days it is scheduled have one). */
export interface HabitDayInput {
  habitId: string;
  day: DayString;
  done: boolean;
  /** Core flag snapshot for that day. */
  core: boolean;
}

export interface HabitStreak {
  streak: number;
  longest: number;
}

/**
 * Each habit's streak, counted only over the days it is scheduled (SPEC 4.8). A missed core
 * habit on a shielded or repaired day keeps its streak (not increased). A not-yet-done habit
 * on a day still in progress doesn't break anything.
 */
export function computeHabitStreaks(
  instances: readonly HabitDayInput[],
  days: readonly Pick<DayStreak, 'day' | 'shield_used' | 'repaired'>[],
  openDay: DayString | null,
): Map<string, HabitStreak> {
  const protectedDays = new Set(days.filter((d) => d.shield_used || d.repaired).map((d) => d.day));
  const sorted = [...instances].sort((a, b) => a.day.localeCompare(b.day));
  const result = new Map<string, HabitStreak>();
  for (const inst of sorted) {
    const s = result.get(inst.habitId) ?? { streak: 0, longest: 0 };
    if (inst.done) s.streak++;
    else if (inst.day === openDay) {
      // Still in progress.
    } else if (!(inst.core && protectedDays.has(inst.day))) s.streak = 0;
    s.longest = Math.max(s.longest, s.streak);
    result.set(inst.habitId, s);
  }
  return result;
}

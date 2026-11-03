import type { Weekday } from '@/core/db/types';
import { isDone } from '@/core/engine/progress';
import { weekdayOf, type DayString } from '@/core/time';
import { learnFrom, type AdaptiveInput, type InstanceObs } from './input';
import { ADAPTIVE, betaEstimate, recencyAverage, type Estimate } from './model';

/**
 * Per daily quest models (SPEC 6.7 A): how likely it is done (at least the minimum) and done
 * in full, overall and per weekday, and the recency-weighted amount logged. Only closed days
 * count (today isn't decided yet); skipped days don't count; data before a reset is ignored.
 */
export interface HabitModel {
  habitId: string;
  /** P(done at least the minimum) on a scheduled day. */
  done: Estimate;
  /** P(done in full) on a normal (not low-energy) day. */
  full: Estimate;
  /** P(done) per weekday (index 0 = Sunday), shrunk toward `done` — null when never scheduled. */
  byWeekday: (Estimate | null)[];
  /** Recency-weighted amount logged on scheduled days (numeric quests). */
  avgValue: { value: number; n: number } | null;
  /** Days observed (raw count). */
  observed: number;
}

/** How strongly a weekday estimate leans on the quest's overall rate (in observations). */
const WEEKDAY_PRIOR = 2;
/**
 * Weekday patterns ("Sundays are hard") are stable and each weekday sees only 1 day in 7, so
 * they remember longer than the overall rate.
 */
const WEEKDAY_HALF_LIFE = ADAPTIVE.halfLifeDays * 3;

export function observationsOf(input: AdaptiveInput, habitId: string): InstanceObs[] {
  const from = learnFrom(input.events, habitId);
  return input.instances.filter(
    (i) =>
      i.habitId === habitId &&
      i.day < input.today &&
      i.day >= from &&
      i.status !== 'skipped' &&
      (input.startDay === null || i.day > input.startDay), // Day 1 is a trial day
  );
}

/** The user's own overall rate — the prior every quest starts from (cold start). */
export function overallPrior(input: AdaptiveInput): number {
  const from = learnFrom(input.events, null);
  const obs = input.instances
    .filter((i) => i.day < input.today && i.day >= from && i.status !== 'skipped')
    .map((i) => ({ day: i.day, success: isDone(i.status) }));
  return betaEstimate(obs, input.today).p;
}

export function habitModel(
  input: AdaptiveInput,
  habitId: string,
  prior = overallPrior(input),
): HabitModel {
  const obs = observationsOf(input, habitId);
  const done = betaEstimate(
    obs.map((o) => ({ day: o.day, success: isDone(o.status) })),
    input.today,
    prior,
  );
  const full = betaEstimate(
    obs.filter((o) => !o.lowEnergy).map((o) => ({ day: o.day, success: o.status === 'done_full' })),
    input.today,
    prior * 0.8,
  );
  const byWeekday: (Estimate | null)[] = Array.from({ length: 7 }, (_, wd) => {
    const mine = obs.filter((o) => weekdayOf(o.day) === wd);
    if (mine.length === 0) return null;
    return betaEstimate(
      mine.map((o) => ({ day: o.day, success: isDone(o.status) })),
      input.today,
      done.p,
      WEEKDAY_PRIOR,
      WEEKDAY_HALF_LIFE,
    );
  });
  const values = obs.flatMap((o) => (o.value === null ? [] : [{ day: o.day, value: o.value }]));
  return {
    habitId,
    done,
    full,
    byWeekday,
    avgValue: recencyAverage(values, input.today),
    observed: obs.length,
  };
}

/** Models for every active daily quest. */
export function habitModels(input: AdaptiveInput): Map<string, HabitModel> {
  const prior = overallPrior(input);
  const out = new Map<string, HabitModel>();
  for (const h of input.habits) {
    if (h.status === 'active') out.set(h.id, habitModel(input, h.id, prior));
  }
  return out;
}

/** Chance of a quest being done on a given day: its weekday estimate, else its overall one. */
export function chanceOn(model: HabitModel, day: DayString): Estimate {
  return model.byWeekday[weekdayOf(day) as Weekday] ?? model.done;
}

/** Number of the same weekday observed for a quest — used in explanations. */
export function weekdayCount(model: HabitModel, day: DayString): number {
  return model.byWeekday[weekdayOf(day)]?.count ?? 0;
}

export { ADAPTIVE };

import { observationsOf } from '@/core/adaptive/habits';
import type { AdaptiveInput } from '@/core/adaptive/input';
import { betaEstimate } from '@/core/adaptive/model';
import type { DayString, Habit } from '@/core/db/types';
import { addDays } from '@/core/time';

/**
 * Adaptive difficulty (SPEC 6.7 A — replaces the 3-day / 7-day rules of SPEC 6.1), pure.
 * Each numeric daily quest aims at being done in full on about 4 days in 5:
 * - done in full on clearly fewer days (< 65 %) → suggest a smaller target (never below the
 *   minimum; at most two quests at once);
 * - done in full on nearly every day (> 92 %, confident) → suggest raising one a little;
 * - in between is a dead band where nothing changes, and a quest is only judged on days at its
 *   current target — after any change it needs 7 days (ease) / 14 days (raise) of fresh data
 *   first. Together this keeps it from swinging back and forth.
 * Never harder during a low-energy streak; sleep targets are never touched (never less sleep).
 * Low energy 4 days in a row (today included) → a gentle check-in instead, no changes.
 */
export type SuggestionKind = 'low_energy' | 'ease' | 'raise';

export interface HabitChange {
  habitId: string;
  title: string;
  measure: Habit['measure'];
  from: number;
  to: number;
  /** Full-target days / days judged, for the explanation. */
  fullDays: number;
  days: number;
}

export interface Suggestion {
  kind: SuggestionKind;
  /** Target changes to apply (ease: smaller; raise: one quest, larger). Empty for low energy. */
  changes: HabitChange[];
}

export interface DifficultyInput {
  input: AdaptiveInput;
  /** Day until which each kind stays hidden (dismissed or applied). */
  snoozedUntil: Partial<Record<SuggestionKind, DayString>>;
}

export const SNOOZE_DAYS: Record<SuggestionKind, number> = { low_energy: 7, ease: 7, raise: 14 };

export const DIFFICULTY = {
  /** The success rate aimed at. */
  aim: 0.8,
  easeBelow: 0.65,
  raiseAbove: 0.92,
  /** Days at the current target before a quest is judged. */
  easeAfterDays: 7,
  raiseAfterDays: 14,
  maxEased: 2,
} as const;

/** Measures whose target can be nudged (sleep is a health number, not a challenge). */
const ADJUSTABLE = new Set<Habit['measure']>(['minutes', 'count', 'steps']);

const stepOf = (m: Habit['measure']) => (m === 'minutes' ? 5 : m === 'steps' ? 500 : 1);

/** A tidy number near `v`: minutes in 5s, steps in 500s, counts whole. */
function tidy(measure: Habit['measure'], v: number): number {
  const step = stepOf(measure);
  return Math.max(step, Math.round(v / step) * step);
}

/** A smaller target (15 % less, 25 % when it's rarely reached), never below the minimum. */
export function smallerTarget(
  h: Pick<Habit, 'measure' | 'target_value' | 'min_value'>,
  rate = 0.5,
): number | null {
  if (!h.target_value) return null;
  const factor = rate < 0.4 ? 0.75 : 0.85;
  const to = Math.max(h.min_value ?? 0, tidy(h.measure, h.target_value * factor));
  return to < h.target_value ? to : null;
}

export function largerTarget(h: Pick<Habit, 'measure' | 'target_value'>): number | null {
  if (!h.target_value) return null;
  return Math.max(h.target_value + stepOf(h.measure), tidy(h.measure, h.target_value * 1.1));
}

export function difficultySuggestion({ input, snoozedUntil }: DifficultyInput): Suggestion | null {
  const { today } = input;
  const snoozed = (k: SuggestionKind) => (snoozedUntil[k] ?? '') >= today;
  const low = new Set(input.lowEnergyDays);

  // 1. Low energy 4 days in a row, today included: care first, no changes.
  const lastFour = [0, 1, 2, 3].map((k) => addDays(today, -k));
  if (!snoozed('low_energy') && lastFour.every((d) => low.has(d))) {
    return { kind: 'low_energy', changes: [] };
  }
  const lowStreak = [0, 1, 2].filter((k) => low.has(addDays(today, -k))).length >= 2;

  const judged = input.habits
    .filter((h) => h.status === 'active' && ADJUSTABLE.has(h.measure) && h.target_value)
    .sort((a, b) => a.order - b.order)
    .map((h) => {
      const obs = observationsOf(input, h.id).filter(
        (o) => o.target === h.target_value && !o.lowEnergy,
      );
      const est = betaEstimate(
        obs.map((o) => ({ day: o.day, success: o.status === 'done_full' })),
        today,
        DIFFICULTY.aim,
      );
      const change = (to: number | null): HabitChange | null =>
        to === null || !h.target_value
          ? null
          : {
              habitId: h.id,
              title: h.title,
              measure: h.measure,
              from: h.target_value,
              to,
              fullDays: obs.filter((o) => o.status === 'done_full').length,
              days: obs.length,
            };
      return { h, obs, est, change };
    });

  // 2. Too hard right now → smaller targets (the hardest first).
  if (!snoozed('ease')) {
    const changes = judged
      .filter(
        (j) =>
          j.obs.length >= DIFFICULTY.easeAfterDays &&
          j.est.p < DIFFICULTY.easeBelow &&
          j.est.confidence !== 'early',
      )
      .sort((a, b) => a.est.p - b.est.p)
      .flatMap((j) => {
        const c = j.change(smallerTarget(j.h, j.est.p));
        return c ? [c] : [];
      })
      .slice(0, DIFFICULTY.maxEased);
    if (changes.length > 0) return { kind: 'ease', changes };
  }

  // 3. Clearly easy → raise one quest a little (never during a low-energy streak).
  if (!snoozed('raise') && !lowStreak) {
    const pick = judged
      .filter(
        (j) =>
          j.obs.length >= DIFFICULTY.raiseAfterDays &&
          j.est.p > DIFFICULTY.raiseAbove &&
          j.est.confidence === 'confident',
      )
      .sort((a, b) => b.est.p - a.est.p)[0];
    const c = pick?.change(largerTarget(pick.h));
    if (c) return { kind: 'raise', changes: [c] };
  }
  return null;
}

/** One plain line explaining a change ("Study: full target on 2 of the last 9 days."). */
export function changeReason(c: HabitChange): string {
  return `${c.title}: full target on ${c.fullDays} of the last ${c.days} days.`;
}

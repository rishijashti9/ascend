import { addDays, diffDays, type DayString } from '@/core/time';

/**
 * Observe week and the limit suggestion (SPEC 6.8 setup steps 2–3). For 7 days screen time only
 * measures; then one card suggests a daily limit a realistic step down from the average.
 */
export const OBSERVE_DAYS = 7;
/** Days with data needed before a suggestion (a phone off for days shouldn't skew it). */
export const MIN_OBSERVED_DAYS = 4;
/** The suggested limit is this share of the average, rounded down to 15 min. */
export const STEP_DOWN = 0.8;
export const LIMIT_STEP_MIN = 15;
export const MIN_LIMIT_MIN = 15;

export type ObserveState =
  | { phase: 'off' }
  | { phase: 'observing'; day: number; endsOn: DayString }
  | { phase: 'ready' }
  | { phase: 'waiting_for_data' }
  | { phase: 'set' };

/**
 * Where setup stands. `daysWithData` = observe-week days (start … start+6) that have a record.
 * Today is never part of the observe week's average until it has ended.
 */
export function observeState(
  observeStart: DayString | null,
  today: DayString,
  limitMin: number | null,
  daysWithData: number,
): ObserveState {
  if (limitMin !== null) return { phase: 'set' };
  if (!observeStart) return { phase: 'off' };
  const elapsed = diffDays(observeStart, today);
  if (elapsed < OBSERVE_DAYS) {
    return {
      phase: 'observing',
      day: Math.max(1, elapsed + 1),
      endsOn: addDays(observeStart, OBSERVE_DAYS),
    };
  }
  return daysWithData >= MIN_OBSERVED_DAYS ? { phase: 'ready' } : { phase: 'waiting_for_data' };
}

/** The days the suggestion averages over: the observe week, or the last 7 closed days later. */
export function observeWindow(observeStart: DayString, today: DayString): DayString[] {
  const from =
    diffDays(observeStart, today) > OBSERVE_DAYS * 2 ? addDays(today, -OBSERVE_DAYS) : observeStart;
  return Array.from({ length: OBSERVE_DAYS }, (_, i) => addDays(from, i)).filter((d) => d < today);
}

export interface LimitSuggestion {
  averageMin: number;
  limitMin: number;
}

/** Average entertainment minutes over the days with data, and the suggested limit. */
export function suggestLimit(dailySeconds: readonly number[]): LimitSuggestion | null {
  if (dailySeconds.length === 0) return null;
  const averageMin = dailySeconds.reduce((a, b) => a + b, 0) / dailySeconds.length / 60;
  const stepped = Math.floor((averageMin * STEP_DOWN) / LIMIT_STEP_MIN) * LIMIT_STEP_MIN;
  return { averageMin: Math.round(averageMin), limitMin: Math.max(MIN_LIMIT_MIN, stepped) };
}

/** "2h 05m" / "45 min". */
export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

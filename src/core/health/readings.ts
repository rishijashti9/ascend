import type { DayString } from '@/core/db/types';

/**
 * Health Connect readings → one day's numbers (SPEC 6.4, task 10.1). Pure, so the rules are
 * tested without a phone. The platform layer (app/health.ts) only fetches raw samples.
 */

/** A workout this long completes the workout quest in full; at least the minimum counts. */
export const WORKOUT_FULL_MIN = 30;
export const WORKOUT_MIN_MIN = 10;

export interface SleepSampleLike {
  startDate: string;
  endDate: string;
  sleepState?: string;
  stages?: { stage: string; durationMinutes: number }[];
  hasStageData?: boolean;
}

export interface WorkoutLike {
  startDate: string;
  endDate: string;
  duration: number; // seconds
}

/** What Health Connect says about one app day; null = nothing recorded. */
export interface DayReading {
  day: DayString;
  steps: number | null;
  sleepHours: number | null;
  workoutMinutes: number | null;
}

const NOT_ASLEEP = new Set(['awake', 'inBed']);

/**
 * Sleep counts for the day you wake into (SPEC 4.8): every sleep session that ENDS inside the
 * app day [dayStart, nextDayStart) is added up — stages marked awake / in bed are left out
 * when the phone knows the stages. Rounded to 0.1 h.
 */
export function sleepHoursFor(
  samples: readonly SleepSampleLike[],
  dayStartMs: number,
  nextDayStartMs: number,
): number | null {
  let minutes = 0;
  let any = false;
  for (const s of samples) {
    const end = Date.parse(s.endDate);
    if (!(end >= dayStartMs && end < nextDayStartMs)) continue;
    if (s.sleepState && NOT_ASLEEP.has(s.sleepState)) continue;
    any = true;
    if (s.hasStageData && s.stages && s.stages.length > 0) {
      minutes += s.stages
        .filter((st) => !NOT_ASLEEP.has(st.stage))
        .reduce((t, st) => t + st.durationMinutes, 0);
    } else {
      minutes += Math.max(0, (end - Date.parse(s.startDate)) / 60_000);
    }
  }
  return any ? Math.round(minutes / 6) / 10 : null;
}

/** Total workout minutes that STARTED inside the app day. */
export function workoutMinutesFor(
  workouts: readonly WorkoutLike[],
  dayStartMs: number,
  nextDayStartMs: number,
): number | null {
  const mine = workouts.filter((w) => {
    const start = Date.parse(w.startDate);
    return start >= dayStartMs && start < nextDayStartMs;
  });
  if (mine.length === 0) return null;
  return Math.round(mine.reduce((t, w) => t + Math.max(0, w.duration), 0) / 60);
}

/** The workout quest's version for these minutes, or null when it's too short to count. */
export function workoutVersion(minutes: number | null): 'full' | 'min' | null {
  if (minutes === null) return null;
  if (minutes >= WORKOUT_FULL_MIN) return 'full';
  return minutes >= WORKOUT_MIN_MIN ? 'min' : null;
}

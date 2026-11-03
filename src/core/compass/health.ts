import type { AdaptiveInput } from '@/core/adaptive/input';
import { isDone } from '@/core/engine/progress';
import { diffDays, type DayString } from '@/core/time';
import type { Guideline } from '@/data/compass/schema';
import { pack } from './pack';
import { lowMoodSupport, weightDropWarning } from './safety';

/**
 * Health check-in and gap analysis against WHO / sleep-science guidelines (SPEC 6.7 B), pure.
 * Real data first (workout quests, steps, sleep, weight, check-ins); the check-in answers fill
 * in what isn't tracked. Everything stays on the device.
 */
export const HEALTH_GOALS = [
  { id: 'strength', label: 'Get stronger' },
  { id: 'fat_loss', label: 'Lose fat' },
  { id: 'stamina', label: 'More stamina' },
  { id: 'better_sleep', label: 'Sleep better' },
  { id: 'less_stress', label: 'Less stress' },
] as const;
export type HealthGoal = (typeof HEALTH_GOALS)[number]['id'];

export interface HealthCheckIn {
  activity: 'none' | 'light' | 'moderate' | 'active';
  /** Strength sessions in a usual week. */
  strengthDays: 0 | 1 | 2 | 3;
  sleep: 'under6' | '6to7' | '7to8' | 'over8';
  energy: 1 | 2 | 3 | 4 | 5;
  goals: HealthGoal[];
}

export type GapStatus = 'meets' | 'close' | 'below' | 'unknown';

export interface HealthGapItem {
  guideline: Guideline;
  status: GapStatus;
  /** What the data (or the check-in) says, in words. */
  yours: string;
  /** Where the number came from. */
  basis: 'data' | 'check-in' | 'none';
}

export interface HealthGap {
  items: HealthGapItem[];
  /** Safety notes that come first (weight dropping too fast, sustained low mood). */
  safety: { text: string; kind: 'weight' | 'mood' }[];
  lowEnergyDays: number;
}

const WINDOW = 14;
const SLEEP_MID: Record<HealthCheckIn['sleep'], number> = {
  under6: 5.5,
  '6to7': 6.5,
  '7to8': 7.5,
  over8: 8.5,
};
const ACTIVITY_MIN: Record<HealthCheckIn['activity'], number> = {
  none: 0,
  light: 60,
  moderate: 150,
  active: 300,
};

const recent = <T extends { day: DayString }>(xs: readonly T[], today: DayString, days = WINDOW) =>
  xs.filter((x) => diffDays(x.day, today) >= 1 && diffDays(x.day, today) <= days);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function healthGap(
  input: AdaptiveInput,
  checkIn: HealthCheckIn | null,
  country: string | null,
): HealthGap {
  const g = new Map(pack().guidelines.map((x) => [x.id, x]));
  const items: HealthGapItem[] = [];
  const today = input.today;

  // Aerobic: workout days and steps (≈ 7,500+ steps a day is roughly 30 brisk minutes).
  const aerobic = g.get('activity-aerobic');
  if (aerobic) {
    const workouts = recent(input.instances, today).filter((i) => i.workout && isDone(i.status));
    const workoutDays = new Set(workouts.map((w) => w.day)).size;
    const steps = mean(recent(input.steps ?? [], today).map((s) => s.value));
    const perWeek = Math.round((workoutDays / WINDOW) * 7 * 10) / 10;
    const haveData = workouts.length > 0 || steps !== null;
    const target = aerobic.numbers.moderate_min_week ?? 150;
    const estMin = haveData
      ? perWeek * 30 + (steps !== null ? Math.max(0, (steps - 4000) / 3500) * 30 * 7 : 0)
      : checkIn
        ? ACTIVITY_MIN[checkIn.activity]
        : null;
    items.push({
      guideline: aerobic,
      status:
        estMin === null
          ? 'unknown'
          : estMin >= target
            ? 'meets'
            : estMin >= target * 0.6
              ? 'close'
              : 'below',
      basis: haveData ? 'data' : checkIn ? 'check-in' : 'none',
      yours: haveData
        ? `About ${perWeek} workout days a week${steps !== null ? ` and ${Math.round(steps).toLocaleString('en-IN')} steps a day` : ''} (last 2 weeks) — roughly ${Math.round(estMin ?? 0)} active minutes a week.`
        : checkIn
          ? `You said you’re ${checkIn.activity === 'none' ? 'not active yet' : `${checkIn.activity}ly active`}.`
          : 'No activity data yet.',
    });
  }

  const strength = g.get('activity-strength');
  if (strength) {
    const days = checkIn?.strengthDays ?? null;
    const target = strength.numbers.strength_days_week ?? 2;
    items.push({
      guideline: strength,
      status:
        days === null
          ? 'unknown'
          : days >= target
            ? 'meets'
            : days === target - 1
              ? 'close'
              : 'below',
      basis: days === null ? 'none' : 'check-in',
      yours:
        days === null
          ? 'Not known yet — take the check-in.'
          : `${days} strength day${days === 1 ? '' : 's'} a week (your check-in).`,
    });
  }

  const sleep = g.get('sleep-duration');
  if (sleep) {
    const logged = recent(input.sleep, today);
    const avg = mean(logged.map((s) => s.value));
    const value =
      logged.length >= 4 && avg !== null ? avg : checkIn ? SLEEP_MID[checkIn.sleep] : null;
    const target = sleep.numbers.min_hours ?? 7;
    items.push({
      guideline: sleep,
      status:
        value === null
          ? 'unknown'
          : value >= target
            ? 'meets'
            : value >= target - 0.5
              ? 'close'
              : 'below',
      basis: logged.length >= 4 ? 'data' : checkIn ? 'check-in' : 'none',
      yours:
        value === null
          ? 'No sleep data yet.'
          : `About ${value.toFixed(1)} h a night${logged.length >= 4 ? ' (last 2 weeks)' : ' (your check-in)'}.`,
    });
  }

  // Guidance with no tracked number: shown as habits to build, not judged.
  for (const id of ['activity-sitting', 'diet-plate', 'diet-limits', 'mental-wellbeing']) {
    const gl = g.get(id);
    if (gl) items.push({ guideline: gl, status: 'unknown', basis: 'none', yours: '' });
  }

  const safety: HealthGap['safety'] = [];
  const weight = weightDropWarning(input.weight, today);
  if (weight) safety.push({ kind: 'weight', text: weight });
  const mood = lowMoodSupport(input.mood, today, country);
  if (mood) safety.push({ kind: 'mood', text: mood.text });

  return {
    items,
    safety,
    lowEnergyDays: input.lowEnergyDays.filter(
      (d) => diffDays(d, today) >= 1 && diffDays(d, today) <= 28,
    ).length,
  };
}

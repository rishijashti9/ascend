import type { AutoSource, Difficulty, Measure, Stat, Weekday } from '@/core/db/types';
import { HABIT_DEFAULTS, habitProblems } from '@/core/pipeline/actions/habitSchema';

/** The habit fields a person edits (onboarding and the Quests screen). */
export interface EditableHabit {
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  measure: Measure;
  target_value: number | null;
  min_value: number | null;
  full_version: string;
  min_version: string;
  auto_source: AutoSource;
  schedule?: Weekday[];
  /** Skills it counts for (Quests screen only; onboarding has none yet). */
  skill_ids?: string[];
}

export const MEASURES: { value: Measure; label: string }[] = [
  { value: 'check', label: 'Done / not done' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'count', label: 'Count' },
  { value: 'steps', label: 'Steps' },
  { value: 'sleep_hours', label: 'Sleep hours' },
];

const NUMERIC_DEFAULTS: Record<Exclude<Measure, 'check'>, [number, number]> = {
  minutes: [30, 10],
  count: [10, 3],
  steps: [8000, 3000],
  sleep_hours: [7.5, 6.5],
};

export const UNIT: Record<Measure, string> = {
  check: '',
  minutes: ' min',
  count: '',
  steps: ' steps',
  sleep_hours: ' h',
};

/** One line describing full and minimum versions. */
export function habitSummary(h: EditableHabit): string {
  if (h.measure === 'check') return `${h.full_version} · minimum: ${h.min_version}`;
  const fmt = (v: number | null) => `${(v ?? 0).toLocaleString()}${UNIT[h.measure]}`;
  return `${fmt(h.target_value)} · minimum ${fmt(h.min_value)}`;
}

/** Switching the measure resets the values that no longer fit. */
export function changeMeasure<T extends EditableHabit>(h: T, measure: Measure): T {
  if (measure === 'check') {
    return {
      ...h,
      measure,
      target_value: null,
      min_value: null,
      full_version: '',
      min_version: '',
    };
  }
  const [target, min] = NUMERIC_DEFAULTS[measure];
  return { ...h, measure, target_value: target, min_value: min, full_version: '', min_version: '' };
}

/** Problems in plain words (empty = valid). */
export function editProblems(h: EditableHabit): string[] {
  const problems = habitProblems({
    ...HABIT_DEFAULTS,
    title: h.title,
    stat: h.stat,
    difficulty: h.difficulty,
    measure: h.measure,
    target_value: h.target_value,
    min_value: h.min_value,
    full_version: h.full_version,
    min_version: h.min_version,
    auto_source: h.auto_source,
    schedule: [...(h.schedule ?? HABIT_DEFAULTS.schedule)],
    skill_ids: [],
  });
  if (!h.title.trim()) problems.unshift('add a title');
  if (h.schedule && h.schedule.length === 0) problems.push('pick at least one day');
  return problems;
}

export const WEEKDAYS: { day: Weekday; short: string; long: string }[] = [
  { day: 1, short: 'M', long: 'Mon' },
  { day: 2, short: 'T', long: 'Tue' },
  { day: 3, short: 'W', long: 'Wed' },
  { day: 4, short: 'T', long: 'Thu' },
  { day: 5, short: 'F', long: 'Fri' },
  { day: 6, short: 'S', long: 'Sat' },
  { day: 0, short: 'S', long: 'Sun' },
];

export function scheduleLabel(schedule: readonly Weekday[]): string {
  if (schedule.length === 7) return 'Every day';
  const set = new Set(schedule);
  if (set.size === 5 && ([1, 2, 3, 4, 5] as const).every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return WEEKDAYS.filter((w) => set.has(w.day))
    .map((w) => w.long)
    .join(', ');
}

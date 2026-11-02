import type { AutoSource, Difficulty, Measure, Stat } from '@/core/db/types';
import { parseTime } from '@/core/time';

/**
 * Onboarding suggestions (SPEC 7.1), pre-filled from Rishi's answers (DECISIONS.md).
 * `selected` ones are ticked by default; the rest are extra suggestions.
 */
export interface StarterHabit {
  key: string;
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  measure: Measure;
  target_value: number | null;
  min_value: number | null;
  full_version: string;
  min_version: string;
  core: boolean;
  auto_source: AutoSource;
  selected: boolean;
}

const check = { measure: 'check' as const, target_value: null, min_value: null };
const numeric = (measure: Measure, target: number, min: number) => ({
  measure,
  target_value: target,
  min_value: min,
  full_version: '',
  min_version: '',
});

export const WAKE_HABIT_KEY = 'wake';

/** The habit fields of a suggestion (without the onboarding-only `key` and `selected`). */
export function habitFieldsOf(h: StarterHabit) {
  return {
    title: h.title,
    stat: h.stat,
    difficulty: h.difficulty,
    measure: h.measure,
    target_value: h.target_value,
    min_value: h.min_value,
    full_version: h.full_version,
    min_version: h.min_version,
    core: h.core,
    auto_source: h.auto_source,
  };
}

export const STARTER_HABITS: readonly StarterHabit[] = [
  {
    key: WAKE_HABIT_KEY,
    title: 'Wake up on time',
    stat: 'WIL',
    difficulty: 'normal',
    ...check,
    ...wakeWording('05:00', 20, '07:00'),
    core: true,
    auto_source: 'wake_checkin',
    selected: true,
  },
  {
    key: 'ai-study',
    title: 'AI & Robotics study (phone-free)',
    stat: 'INT',
    difficulty: 'hard',
    ...numeric('minutes', 150, 30),
    core: true,
    auto_source: 'none',
    selected: true,
  },
  {
    key: 'workout',
    title: 'Workout',
    stat: 'STR',
    difficulty: 'normal',
    ...check,
    full_version: '30 min workout',
    min_version: '10 push-ups',
    core: true,
    auto_source: 'workout',
    selected: true,
  },
  {
    key: 'gamedev-study',
    title: 'Game dev study (phone-free)',
    stat: 'INT',
    difficulty: 'normal',
    ...numeric('minutes', 60, 15),
    core: false,
    auto_source: 'none',
    selected: true,
  },
  {
    key: 'walk',
    title: 'Walk',
    stat: 'STR',
    difficulty: 'easy',
    ...numeric('steps', 8000, 3000),
    core: false,
    auto_source: 'steps',
    selected: true,
  },
  {
    key: 'sleep',
    title: 'Sleep',
    stat: 'STR',
    difficulty: 'normal',
    ...numeric('sleep_hours', 7.5, 6.5),
    core: false,
    auto_source: 'sleep',
    selected: true,
  },
  {
    key: 'journal',
    title: 'Journal',
    stat: 'WIL',
    difficulty: 'easy',
    ...check,
    full_version: '10 min writing',
    min_version: '3 lines (one win, one lesson)',
    core: false,
    auto_source: 'none',
    selected: true,
  },
  {
    key: 'meditate',
    title: 'Meditate',
    stat: 'WIL',
    difficulty: 'easy',
    ...numeric('minutes', 10, 2),
    core: false,
    auto_source: 'none',
    selected: true,
  },
  {
    key: 'read',
    title: 'Read',
    stat: 'INT',
    difficulty: 'easy',
    ...numeric('minutes', 20, 5),
    core: false,
    auto_source: 'none',
    selected: false,
  },
  {
    key: 'stretch',
    title: 'Stretch',
    stat: 'STR',
    difficulty: 'easy',
    ...numeric('minutes', 10, 3),
    core: false,
    auto_source: 'none',
    selected: false,
  },
  {
    key: 'phone-free-morning',
    title: 'Phone-free first hour',
    stat: 'WIL',
    difficulty: 'normal',
    ...check,
    full_version: 'No phone for the first hour after waking',
    min_version: 'No phone for the first 15 minutes',
    core: false,
    auto_source: 'none',
    selected: false,
  },
];

export const STARTER_DREAM = {
  title: 'Become a robotics engineer at a top company or research lab',
  why: 'Build humanoids and advanced robots.',
};

export const STARTER_MAIN_QUESTS: readonly { title: string; stat: Stat }[] = [
  { title: 'Core robotics skills', stat: 'INT' },
  { title: 'Robotics portfolio', stat: 'INT' },
  { title: 'Game dev foundations', stat: 'INT' },
  { title: 'MS in AI/Robotics in Germany', stat: 'INT' },
];

/** "5:20 AM" from "05:20". */
export function formatTime(hhmm: string): string {
  const minutes = parseTime(hhmm);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Add minutes to an "HH:MM" time (wraps at midnight). */
export function addMinutes(hhmm: string, add: number): string {
  const total = (((parseTime(hhmm) + add) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Full/minimum wording of the wake-up quest for a wake time, window and late cutoff. */
export function wakeWording(wakeTime: string, windowMin: number, cutoff: string) {
  return {
    full_version: `"I'm up" by ${formatTime(addMinutes(wakeTime, windowMin))}`,
    min_version: `Late check-in (by ${formatTime(cutoff)})`,
  };
}

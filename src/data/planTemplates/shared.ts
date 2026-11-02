import type { Weekday } from '@/core/db/types';
import type { Answers, PlanHabit, Question } from '@/core/planner/types';

/** Questions every plan asks (once per goal; answers are remembered in planner_context). */
export const LEVEL: Question = {
  id: 'level',
  label: 'Where are you starting from?',
  kind: 'chips',
  options: [
    { value: 'beginner', label: 'Beginner' },
    { value: 'some', label: 'Some experience' },
    { value: 'advanced', label: 'Advanced' },
  ],
  default: 'beginner',
};

export const MINUTES: Question = {
  id: 'minutes_per_day',
  label: 'Time you can give this on a normal day',
  kind: 'slider',
  min: 15,
  max: 240,
  step: 15,
  unit: 'min',
  default: 60,
};

export const DAYS: Question = {
  id: 'days',
  label: 'Which days?',
  kind: 'chips',
  options: [
    { value: 'every', label: 'Every day' },
    { value: 'weekdays', label: 'Weekdays' },
    { value: 'six', label: '6 days (Sunday off)' },
  ],
  default: 'every',
};

export const OBSTACLE: Question = {
  id: 'obstacle',
  label: 'What has stopped you before?',
  kind: 'chips',
  options: [
    { value: 'time', label: 'Not enough time' },
    { value: 'motivation', label: 'Motivation' },
    { value: 'focus', label: 'Distractions' },
    { value: 'unclear', label: 'Unclear next step' },
    { value: 'none', label: 'Nothing yet' },
  ],
  default: 'none',
};

export const DONE_LOOKS_LIKE: Question = {
  id: 'done_looks_like',
  label: 'What does “done” look like? (optional)',
  kind: 'text',
  optional: true,
};

export function num(a: Answers, key: string, fallback: number): number {
  const v = a[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function str(a: Answers, key: string, fallback: string): string {
  const v = a[key];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

export function scheduleFor(a: Answers): Weekday[] {
  const days = str(a, 'days', 'every');
  if (days === 'weekdays') return [1, 2, 3, 4, 5];
  if (days === 'six') return [1, 2, 3, 4, 5, 6];
  return [0, 1, 2, 3, 4, 5, 6];
}

/** A daily minutes habit with a kind minimum (a quarter of the target, at least 10 min). */
export function minutesHabit(
  title: string,
  stat: PlanHabit['stat'],
  minutes: number,
  a: Answers,
): PlanHabit {
  const target = Math.max(15, Math.round(minutes / 5) * 5);
  // When motivation has been the problem, the minimum is extra small (SPEC: minimum versions).
  const share = str(a, 'obstacle', 'none') === 'motivation' ? 0.15 : 0.25;
  const min = Math.max(10, Math.round((target * share) / 5) * 5);
  return {
    title,
    stat,
    difficulty: target >= 120 ? 'hard' : target >= 45 ? 'normal' : 'easy',
    measure: 'minutes',
    target_value: target,
    min_value: Math.min(min, target),
    full_version: '',
    min_version: '',
    schedule: scheduleFor(a),
  };
}

/** Extra weekly step when "unclear next step" has been the obstacle. */
export function obstacleWeekly(a: Answers): string[] {
  return str(a, 'obstacle', 'none') === 'unclear'
    ? ['Write down next week’s three concrete steps']
    : [];
}

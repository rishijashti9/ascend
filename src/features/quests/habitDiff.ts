import type { Habit } from '@/core/db/types';
import type { EditableHabit } from '@/ui/habit/habitEdit';

const FIELDS = [
  'title',
  'stat',
  'difficulty',
  'measure',
  'target_value',
  'min_value',
  'full_version',
  'min_version',
  'auto_source',
] as const;

export function editableOf(h: Habit): EditableHabit {
  return {
    title: h.title,
    stat: h.stat,
    difficulty: h.difficulty,
    measure: h.measure,
    target_value: h.target_value,
    min_value: h.min_value,
    full_version: h.full_version,
    min_version: h.min_version,
    auto_source: h.auto_source,
    schedule: [...h.schedule],
    skill_ids: [...h.skill_ids],
  };
}

/** Only the fields that really changed (habit.update rejects an empty change). */
export function changesOf(before: Habit, after: EditableHabit): Partial<EditableHabit> {
  const changes: Record<string, unknown> = {};
  for (const key of FIELDS) {
    const value = key === 'title' ? after.title.trim() : after[key];
    if (value !== before[key]) changes[key] = value;
  }
  if (after.schedule && after.schedule.join() !== [...before.schedule].sort().join()) {
    changes.schedule = after.schedule;
  }
  if (after.skill_ids && after.skill_ids.join() !== before.skill_ids.join()) {
    changes.skill_ids = after.skill_ids;
  }
  return changes as Partial<EditableHabit>;
}

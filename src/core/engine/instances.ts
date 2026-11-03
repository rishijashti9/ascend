import type { BaseRecord, DayString, Habit, QuestInstance } from '@/core/db/types';
import { weekdayOf } from '@/core/time';

/**
 * Daily quest instances (pure). One instance per habit per scheduled day, with a
 * deterministic id so the same quest on two devices is one record (SPEC 9).
 */

export function habitInstanceId(habitId: string, day: DayString): string {
  return `${habitId}:${day}`;
}

/** Recovery quests have a deterministic id per day, so two devices never create two. */
export function recoveryQuestId(day: DayString): string {
  return `recovery:${day}`;
}

export function isRecoveryId(id: string): boolean {
  return id.startsWith('recovery:');
}

/** A habit is scheduled on a day if it is active and the weekday is in its schedule. */
export function isScheduled(habit: Habit, day: DayString): boolean {
  return (
    habit.status === 'active' &&
    habit.deleted_at === null &&
    habit.schedule.includes(weekdayOf(day))
  );
}

type Snapshot = Pick<
  QuestInstance,
  | 'title_snapshot'
  | 'stat_snapshot'
  | 'difficulty_snapshot'
  | 'measure_snapshot'
  | 'target_snapshot'
  | 'min_snapshot'
  | 'full_version_snapshot'
  | 'min_version_snapshot'
  | 'core_snapshot'
  | 'auto_source_snapshot'
  | 'skill_ids_snapshot'
>;

/** What the habit looks like right now, frozen onto an instance. */
export function habitSnapshot(habit: Habit): Snapshot {
  return {
    title_snapshot: habit.title,
    stat_snapshot: habit.stat,
    difficulty_snapshot: habit.difficulty,
    measure_snapshot: habit.measure,
    target_snapshot: habit.target_value,
    min_snapshot: habit.min_value,
    full_version_snapshot: habit.full_version,
    min_version_snapshot: habit.min_version,
    core_snapshot: habit.core,
    auto_source_snapshot: habit.auto_source,
    skill_ids_snapshot: [...habit.skill_ids],
  };
}

/** A new pending instance of `habit` on `day`. The id always comes from habit + day. */
export function buildHabitInstance(habit: Habit, day: DayString, base: BaseRecord): QuestInstance {
  return {
    ...base,
    id: habitInstanceId(habit.id, day),
    source_type: 'habit',
    source_id: habit.id,
    day,
    status: 'pending',
    ...habitSnapshot(habit),
    completed_at: null,
    completed_via: null,
    award_revision: 0,
  };
}

/**
 * After a habit is edited: today's instance takes the new values only while it is still
 * pending; a completed instance keeps its snapshot (DECISIONS 5). The core flag is never
 * changed mid-day — core changes apply from tomorrow. Returns null if nothing changes.
 */
export function refreshedSnapshot(instance: QuestInstance, habit: Habit): Snapshot | null {
  if (instance.status !== 'pending') return null;
  const next = { ...habitSnapshot(habit), core_snapshot: instance.core_snapshot };
  const changed = (Object.keys(next) as (keyof Snapshot)[]).some((k) =>
    k === 'skill_ids_snapshot'
      ? (instance[k] ?? []).join() !== (next[k] ?? []).join()
      : instance[k] !== next[k],
  );
  return changed ? next : null;
}

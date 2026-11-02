import type { AscendDB } from '@/core/db/db';
import type { DayString, Settings } from '@/core/db/types';
import { buildHabitInstance, habitInstanceId, isScheduled } from '@/core/engine/instances';
import { currentTimeZone, dayOf } from '@/core/time';
import { newBase } from './records';

/** Shared helpers for actions. They only use Dexie, so they are safe inside transactions. */

export async function getSettings(db: AscendDB): Promise<Settings> {
  const settings = await db.settings.get('settings');
  if (!settings) throw new Error('Settings record is missing');
  return settings;
}

/** The app-day an instant belongs to, using the current timezone and day-start hour. */
export async function appDayOf(db: AscendDB, iso: string): Promise<DayString> {
  const settings = await getSettings(db);
  return dayOf(Date.parse(iso), currentTimeZone(), settings.day_start_hour);
}

/**
 * Makes sure every habit scheduled on `day` has an instance. Never overwrites an
 * existing instance (so completions and snapshots are kept). Returns how many were created.
 */
export async function ensureInstancesForDay(db: AscendDB, day: DayString): Promise<number> {
  const habits = await db.habits.where('status').equals('active').toArray();
  let created = 0;
  for (const habit of habits) {
    if (!isScheduled(habit, day)) continue;
    const id = habitInstanceId(habit.id, day);
    const existing = await db.quest_instances.get(id);
    if (existing && existing.deleted_at === null) continue;
    // A soft-deleted instance (habit was paused earlier today) comes back fresh.
    await db.quest_instances.put(buildHabitInstance(habit, day, newBase(id)));
    created++;
  }
  return created;
}

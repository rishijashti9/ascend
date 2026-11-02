import type { AscendDB } from '@/core/db/db';
import type { DayRecord, DayString, IsoTime } from '@/core/db/types';
import { evaluateDay } from '@/core/engine/dayEval';
import { currentTimeZone } from '@/core/time';
import { newBase, touch } from './records';

/**
 * Keeps a day's record current: called inside the same transaction as every change that
 * can affect the day (completions, habit edits, low energy, rollover).
 * Streak fields (shield_used, shields_after, repaired, streak_*) belong to the progress
 * engine (task 2.5) and are not touched here.
 */
export async function refreshDayRecord(
  db: AscendDB,
  day: DayString,
  at: IsoTime,
  changes: Partial<Pick<DayRecord, 'low_energy' | 'low_energy_set_at'>> = {},
): Promise<DayRecord> {
  const existing = await db.days.get(day);
  const instances = await db.quest_instances.where('day').equals(day).toArray();
  const lowEnergy = changes.low_energy ?? existing?.low_energy ?? false;
  const evaluation = evaluateDay(instances, lowEnergy);

  const record: DayRecord = existing
    ? { ...existing, ...changes, ...touch(at) }
    : {
        ...newBase(day, at),
        day,
        // The device's timezone when the day was first recorded (SPEC 4.8).
        timezone: currentTimeZone(),
        low_energy: false,
        low_energy_set_at: null,
        active: false,
        neutral: true,
        daily_clear: false,
        shield_used: false,
        shields_after: 0,
        repaired: false,
        streak_at_start: 0,
        streak_after: 0,
        closed_at: null,
        ...changes,
      };
  record.active = evaluation.active;
  record.neutral = evaluation.neutral;
  record.daily_clear = evaluation.dailyClear;

  const unchanged =
    existing &&
    existing.active === record.active &&
    existing.neutral === record.neutral &&
    existing.daily_clear === record.daily_clear &&
    existing.low_energy === record.low_energy &&
    existing.low_energy_set_at === record.low_energy_set_at;
  if (!unchanged) await db.days.put(record);
  return unchanged ? existing : record;
}

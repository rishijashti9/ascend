import type { AscendDB } from '@/core/db/db';
import type { DayRecord, DayString, IsoTime } from '@/core/db/types';
import { evaluateDay } from '@/core/engine/dayEval';
import { currentTimeZone } from '@/core/time';
import { newBase, touch } from './records';
import { refreshStreaks } from './streaks';

/**
 * Keeps a day's record current: called inside the same transaction as every change that
 * can affect the day (completions, habit edits, low energy, rollover).
 * When the day's result (active / neutral / closed) changes, every day's streak fields are
 * recomputed too (pipeline/streaks.ts).
 */
export async function refreshDayRecord(
  db: AscendDB,
  day: DayString,
  at: IsoTime,
  changes: Partial<Pick<DayRecord, 'low_energy' | 'low_energy_set_at' | 'closed_at'>> = {},
  /**
   * Many days at once (rollover after an absence, the consistency check): the caller
   * recomputes streaks once at the end, instead of once per day (task 10.6 — that was
   * quadratic in the length of the history).
   */
  options: { deferStreaks?: boolean } = {},
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
    existing.low_energy_set_at === record.low_energy_set_at &&
    existing.closed_at === record.closed_at;
  if (unchanged) return existing;
  await db.days.put(record);
  const streaksAffected =
    !existing ||
    existing.active !== record.active ||
    existing.neutral !== record.neutral ||
    existing.closed_at !== record.closed_at;
  if (streaksAffected && !options.deferStreaks) {
    await refreshStreaks(db, at);
    return (await db.days.get(day)) ?? record;
  }
  return record;
}

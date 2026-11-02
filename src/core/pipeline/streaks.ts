import type { AscendDB } from '@/core/db/db';
import type { DayString, IsoTime } from '@/core/db/types';
import { isDone } from '@/core/engine/progress';
import { computeStreaks, type StreakSummary } from '@/core/engine/streaks';
import { touch } from './records';

/**
 * Writes the streak fields of every `days` record from the pure streak engine (task 2.5).
 * Called in the same transaction as anything that can change them: a day's active/neutral
 * result, a day closing, or a Recovery quest being (un)completed.
 */

/** Recovery quests have a deterministic id per day, so two devices never create two. */
export function recoveryQuestId(day: DayString): string {
  return `recovery:${day}`;
}

export function isRecoveryId(id: string): boolean {
  return id.startsWith('recovery:');
}

export async function refreshStreaks(db: AscendDB, at: IsoTime): Promise<StreakSummary> {
  const days = (await db.days.toArray()).filter((d) => d.deleted_at === null);
  const recoveries = await db.quest_instances.where(':id').startsWith('recovery:').toArray();
  const recoveredDays = new Set(
    recoveries.filter((i) => i.deleted_at === null && isDone(i.status)).map((i) => i.day),
  );
  const { days: computed, summary } = computeStreaks(
    days.map((d) => ({
      day: d.day,
      active: d.active,
      neutral: d.neutral,
      open: d.closed_at === null,
      recovered: recoveredDays.has(d.day),
    })),
  );
  for (const [i, record] of days.entries()) {
    const next = computed[i];
    if (!next) continue;
    const changed =
      record.streak_at_start !== next.streak_at_start ||
      record.streak_after !== next.streak_after ||
      record.shield_used !== next.shield_used ||
      record.shields_after !== next.shields_after ||
      record.repaired !== next.repaired;
    if (changed) await db.days.put({ ...record, ...next, ...touch(at) });
  }
  return summary;
}

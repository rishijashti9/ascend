import type { AscendDB } from '@/core/db/db';
import type { IsoTime } from '@/core/db/types';
import { isRecoveryId, recoveryQuestId } from '@/core/engine/instances';
import { isDone } from '@/core/engine/progress';
import { computeStreaks, toStreakInputs, type StreakSummary } from '@/core/engine/streaks';
import { touch } from './records';

export { isRecoveryId, recoveryQuestId };

/**
 * Writes the streak fields of every `days` record from the pure streak engine (task 2.5).
 * Called in the same transaction as anything that can change them: a day's active/neutral
 * result, a day closing, or a Recovery quest being (un)completed.
 */

export async function refreshStreaks(db: AscendDB, at: IsoTime): Promise<StreakSummary> {
  const days = (await db.days.toArray()).filter((d) => d.deleted_at === null);
  const recoveries = await db.quest_instances
    .where(':id')
    .startsWith(recoveryQuestId(''))
    .toArray();
  const recoveredDays = new Set(
    recoveries
      .filter((i) => i.deleted_at === null && isRecoveryId(i.id) && isDone(i.status))
      .map((i) => i.day),
  );
  const { days: computed, summary } = computeStreaks(toStreakInputs(days, recoveredDays));
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

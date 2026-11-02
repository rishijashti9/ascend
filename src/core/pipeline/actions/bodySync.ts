import type { BodyLog, DayString } from '@/core/db/types';
import { newBase, touch } from '../records';
import type { ActionContext } from '../registry';

/**
 * Steps and sleep have ONE number per day (DECISIONS, task 4.7): the Walk / Sleep quest and
 * the Body log always show the same value. Whichever screen it's entered on, both are updated
 * in the same transaction. This module holds the body-log side (no imports from the quest
 * actions, so both directions can use it without a cycle).
 */
export const bodyLogId = (d: DayString) => `body:${d}`;

export function emptyBodyLog(d: DayString, at: string): BodyLog {
  return {
    ...newBase(bodyLogId(d), at),
    day: d,
    weight: null,
    waist: null,
    sleep_hours: null,
    steps: null,
    workout_notes: null,
    photo_id: null,
    source: 'manual',
    manual_override: false,
  };
}

/** Which body-log field a quest measure maps to (only steps and sleep are shared). */
export function bodyFieldFor(measure: string): 'steps' | 'sleep_hours' | null {
  return measure === 'steps' ? 'steps' : measure === 'sleep_hours' ? 'sleep_hours' : null;
}

/** Sets one shared field on a day's body log; writes nothing if it already has that value. */
export async function setBodyMetric(
  ctx: ActionContext,
  day: DayString,
  field: 'steps' | 'sleep_hours',
  value: number | null,
): Promise<void> {
  const log = (await ctx.db.body_logs.get(bodyLogId(day))) ?? emptyBodyLog(day, ctx.processedAt);
  if (log[field] === value && log.deleted_at === null) return;
  await ctx.db.body_logs.put({
    ...log,
    [field]: value,
    source: 'manual',
    manual_override: true,
    deleted_at: null,
    ...touch(ctx.processedAt),
  });
  ctx.emit({ type: 'BodyLogged', payload: { day } });
}

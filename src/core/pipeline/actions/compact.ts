import { z } from 'zod';
import {
  applyCompaction,
  COMPACTION_TABLES,
  monthStart,
  planCompaction,
} from '@/core/compaction/apply';
import { compactedBefore } from '@/core/compaction/expanded';
import type { AscendDB } from '@/core/db/db';
import type { Compaction } from '@/core/db/types';
import { addDays } from '@/core/time';
import { appDayOf } from '../helpers';
import { defineAction, RuleError } from '../registry';

/**
 * Compaction (SPEC 6.7 D). The screen saves the automatic full export and shows the preview
 * first; this action then summarises and removes the detail in one transaction. Only history
 * at least a year old can be compacted (the Adaptive System reads the last 365 days, so what
 * it has learned is unaffected).
 */
export const MIN_AGE_DAYS = 365;

export const compactData = defineAction({
  type: 'data.compact',
  schema: z
    .object({
      cutoff_day: z.string().regex(/^\d{4}-\d{2}-01$/),
      remove_photos: z.boolean(),
    })
    .strict(),
  tables: [...COMPACTION_TABLES, 'settings'],
  async run(ctx, { cutoff_day, remove_photos }): Promise<Compaction> {
    const today = await appDayOf(ctx.db, ctx.processedAt);
    if (cutoff_day > monthStart(addDays(today, -MIN_AGE_DAYS)))
      throw new RuleError('Only history at least a year old can be compacted');
    if (cutoff_day <= (await compactedBefore(ctx.db)))
      throw new RuleError('That period is already compacted');
    const plan = await planCompaction(ctx.db, cutoff_day, remove_photos);
    const record = await applyCompaction(ctx.db, plan, ctx.processedAt);
    ctx.emit({ type: 'DataCompacted', payload: { cutoff: record.cutoff_day } });
    return record;
  },
});

/**
 * Another device compacted (its summaries and compaction record arrived by sync): remove this
 * device's copy of the same old detail, so nothing is counted twice. Only once the summaries
 * themselves are here. Returns how many records were removed.
 */
export const compactLocal = defineAction({
  type: 'data.compactLocal',
  schema: z.object({}).strict(),
  tables: [...COMPACTION_TABLES, 'settings'],
  async run(ctx) {
    const removed = await removeCompactedDetail(ctx.db);
    if (removed > 0)
      ctx.emit({ type: 'DataCompacted', payload: { cutoff: await compactedBefore(ctx.db) } });
    return removed;
  },
});

/**
 * Removes detail older than the latest compaction that is already summarised (synced from
 * another device, or brought back by importing an older backup). Inside the caller's
 * transaction over COMPACTION_TABLES.
 */
export async function removeCompactedDetail(db: AscendDB): Promise<number> {
  const cutoff = await compactedBefore(db);
  if (!cutoff || (await db.summaries.count()) === 0) return 0;
  const plan = await planCompaction(db, cutoff, false);
  let removed = 0;
  for (const [table, ids] of Object.entries(plan.remove)) {
    if (!ids?.length || table === 'photos') continue;
    await db.table(table).bulkDelete(ids);
    removed += ids.length;
  }
  return removed;
}

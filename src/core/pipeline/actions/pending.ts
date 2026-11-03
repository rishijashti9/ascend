import { z } from 'zod';
import type { PendingAction } from '@/core/db/types';
import { newBase, touch } from '../records';
import { defineAction } from '../registry';

/**
 * The pending-actions queue (SPEC 6.4, task 10.3). Widget taps are first copied from the
 * phone's native queue into `pending_actions` (so nothing is lost if the app closes halfway),
 * then each is run through the normal pipeline with its real tap time and marked processed.
 */
/** Also queued by the phone: "I'm on a break" tapped on the screen-time reminder (Phase 11). */
export const WIDGET_ACTIONS = ['quest.complete', 'quest.wakeCheckin', 'screen.takeBreak'] as const;

const tap = z
  .object({
    id: z.string().min(1).max(100),
    type: z.enum(WIDGET_ACTIONS),
    payload: z.record(z.string(), z.unknown()),
    occurred_at: z.iso.datetime(),
  })
  .strict();

export const enqueuePending = defineAction({
  type: 'pending.enqueue',
  schema: z.object({ taps: z.array(tap).max(200) }).strict(),
  tables: ['pending_actions'],
  async run(ctx, { taps }) {
    let added = 0;
    for (const t of taps) {
      if (await ctx.db.pending_actions.get(t.id)) continue; // already copied
      const row: PendingAction = {
        ...newBase(t.id, ctx.processedAt),
        action: t.type,
        payload: t.payload,
        occurred_at: t.occurred_at,
        source: 'widget',
        processed_at: null,
      };
      await ctx.db.pending_actions.add(row);
      added += 1;
    }
    return added;
  },
});

export const markPendingProcessed = defineAction({
  type: 'pending.markProcessed',
  schema: z.object({ id: z.string().min(1) }).strict(),
  tables: ['pending_actions'],
  async run(ctx, { id }) {
    const row = await ctx.db.pending_actions.get(id);
    if (!row || row.processed_at) return false;
    await ctx.db.pending_actions.put({
      ...row,
      processed_at: ctx.processedAt,
      ...touch(ctx.processedAt),
    });
    return true;
  },
});

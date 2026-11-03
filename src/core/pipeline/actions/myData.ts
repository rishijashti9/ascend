import { z } from 'zod';
import { OUTBOUND_KEEP, OUTBOUND_KEY, type OutboundEntry } from '@/core/data/outbound';
import { defineAction } from '../registry';

/** Log one request that left the device (SPEC 6.7 D). Only when, where and how much — no content. */
export const recordOutbound = defineAction({
  type: 'outbound.record',
  schema: z
    .object({
      service: z.literal('gemini'),
      kind: z.string().regex(/^[a-z_]{1,30}$/),
      chars: z.number().int().min(0).max(100_000),
    })
    .strict(),
  tables: ['meta'],
  async run(ctx, p) {
    const v = (await ctx.db.meta.get(OUTBOUND_KEY))?.value;
    const log = Array.isArray(v) ? (v as OutboundEntry[]) : [];
    const next = [...log, { at: ctx.occurredAt, ...p }].slice(-OUTBOUND_KEEP);
    await ctx.db.meta.put({ id: OUTBOUND_KEY, value: next });
    return next.length;
  },
});

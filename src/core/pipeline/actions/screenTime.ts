import { z } from 'zod';
import { SCREEN_META } from '@/core/screentime/trustedTime';
import { defineAction } from '../registry';

/**
 * Screen time (SPEC 6.8). Every change to the rules, the lock, breaks and the daily totals goes
 * through these actions.
 */

/** Remembers the server's time for lock checks — only ever moves forward. */
export const noteServerTime = defineAction({
  type: 'screen.noteServerTime',
  schema: z.object({ ms: z.number().int().positive() }).strict(),
  tables: ['meta'],
  async run(ctx, { ms }) {
    const old = (await ctx.db.meta.get(SCREEN_META.trusted))?.value;
    if (typeof old === 'number' && old >= ms) return false;
    await ctx.db.meta.put({ id: SCREEN_META.trusted, value: ms });
    return true;
  },
});

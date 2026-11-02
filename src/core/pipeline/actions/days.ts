import { z } from 'zod';
import { refreshDayRecord } from '../days';
import { appDayOf } from '../helpers';
import { defineAction } from '../registry';

/**
 * Low-energy mode (SPEC 4.8 / 6.4): today only. Can be switched on any time before the
 * day closes and off again the same day; anything already done stays done.
 */
export const setLowEnergy = defineAction({
  type: 'day.setLowEnergy',
  schema: z.object({ on: z.boolean() }).strict(),
  tables: ['days', 'quest_instances', 'settings'],
  async run(ctx, { on }) {
    const today = await appDayOf(ctx.db, ctx.processedAt);
    const record = await refreshDayRecord(ctx.db, today, ctx.processedAt, {
      low_energy: on,
      low_energy_set_at: on ? ctx.processedAt : null,
    });
    ctx.emit({ type: 'DayChanged', payload: { day: today } });
    return record;
  },
});

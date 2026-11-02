import { z } from 'zod';
import type { BodyLog } from '@/core/db/types';
import { appDayOf } from '../helpers';
import { touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { QUEST_TABLES } from './questCommon';
import { bodyFieldFor, bodyLogId, emptyBodyLog } from './bodySync';
import { logProgress, untickQuest } from './quests';

export { bodyLogId };

/**
 * Body logs (SPEC 7.6): one record per day — weight, waist, sleep, steps, workout notes.
 * A manual entry always wins over Health Connect (SPEC 6.4). Steps and sleep are one number per
 * day: today's go into the matching Walk / Sleep quest too, and entering them on the quest
 * updates this log (bodySync.ts) — both always show the same value.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullable = <T extends z.ZodType>(t: T) => t.nullable().optional();

export const bodyLogSchema = z
  .object({
    /** Defaults to today. Past days can be filled in or corrected. */
    day: day.optional(),
    weight: nullable(z.number().min(20).max(400)),
    waist: nullable(z.number().min(30).max(300)),
    sleep_hours: nullable(z.number().min(0).max(24)),
    steps: nullable(z.number().int().min(0).max(200_000)),
    workout_notes: nullable(z.string().trim().max(500)),
  })
  .strict()
  .refine(
    (p) => ['weight', 'waist', 'sleep_hours', 'steps', 'workout_notes'].some((k) => k in p),
    'nothing to log',
  );

/**
 * Today's steps / sleep go into every daily quest that measures them, so both screens show the
 * same number; clearing the value here undoes the quest's entry (same as Undo on its card).
 */
async function shareWithQuests(
  ctx: ActionContext,
  d: string,
  field: 'steps' | 'sleep_hours',
  value: number | null,
) {
  const instances = (await ctx.db.quest_instances.where('day').equals(d).toArray()).filter(
    (i) =>
      i.deleted_at === null &&
      i.source_type === 'habit' &&
      bodyFieldFor(i.measure_snapshot) === field &&
      i.status !== 'missed',
  );
  for (const quest of instances) {
    if (value === null) {
      await untickQuest.run(ctx, untickQuest.schema.parse({ instanceId: quest.id }));
    } else {
      await logProgress.run(
        ctx,
        logProgress.schema.parse({ instanceId: quest.id, amount: value, source: 'manual' }),
      );
    }
  }
}

export const logBody = defineAction({
  type: 'body.log',
  schema: bodyLogSchema,
  tables: [...QUEST_TABLES, 'body_logs'],
  async run(ctx, { day: given, ...fields }) {
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    const d = given ?? today;
    if (d > today) throw new RuleError('That day hasn’t happened yet');
    const id = bodyLogId(d);
    const existing = await ctx.db.body_logs.get(id);
    const base: BodyLog = existing ?? emptyBodyLog(d, ctx.processedAt);
    const next: BodyLog = {
      ...base,
      ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
      // An empty note clears it, like null does.
      workout_notes:
        fields.workout_notes === undefined ? base.workout_notes : fields.workout_notes || null,
      source: 'manual',
      manual_override: true,
      deleted_at: null,
      ...touch(ctx.processedAt),
    };
    await ctx.db.body_logs.put(next);

    // Past days are history: a closed day's quests never change (SPEC 4.8), only its log does.
    if (d === today) {
      if (fields.steps !== undefined) await shareWithQuests(ctx, d, 'steps', fields.steps);
      if (fields.sleep_hours !== undefined) {
        await shareWithQuests(ctx, d, 'sleep_hours', fields.sleep_hours);
      }
    }
    ctx.emit({ type: 'BodyLogged', payload: { day: d } });
    return next;
  },
});

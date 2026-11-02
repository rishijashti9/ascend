import { z } from 'zod';
import type { BodyLog } from '@/core/db/types';
import { appDayOf } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { QUEST_TABLES } from './questCommon';
import { logProgress } from './quests';

/**
 * Body logs (SPEC 7.6): one record per day — weight, waist, sleep, steps, workout notes.
 * A manual entry always wins over Health Connect (SPEC 6.4). Today's steps and sleep also go
 * into the matching daily quest (auto source steps / sleep), so nothing is entered twice.
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

export const bodyLogId = (d: string) => `body:${d}`;

/** Feeds today's steps / sleep into the daily quest that measures them (if there is one). */
async function feedQuest(ctx: ActionContext, d: string, source: 'steps' | 'sleep', amount: number) {
  const instances = await ctx.db.quest_instances.where('day').equals(d).toArray();
  const quest = instances.find(
    (i) =>
      i.deleted_at === null &&
      i.source_type === 'habit' &&
      i.auto_source_snapshot === source &&
      i.status !== 'missed',
  );
  if (!quest) return;
  await logProgress.run(
    ctx,
    logProgress.schema.parse({ instanceId: quest.id, amount, source: 'manual' }),
  );
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
    const base: BodyLog = existing ?? {
      ...newBase(id, ctx.processedAt),
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

    if (d === today) {
      if (typeof fields.steps === 'number') await feedQuest(ctx, d, 'steps', fields.steps);
      if (typeof fields.sleep_hours === 'number')
        await feedQuest(ctx, d, 'sleep', fields.sleep_hours);
    }
    ctx.emit({ type: 'BodyLogged', payload: { day: d } });
    return next;
  },
});

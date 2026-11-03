import { z } from 'zod';
import type { QuestInstance } from '@/core/db/types';
import { workoutVersion } from '@/core/health/readings';
import { appDayOf } from '../helpers';
import { touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { bodyLogId, emptyBodyLog } from './bodySync';
import { QUEST_TABLES } from './questCommon';
import { completeQuest, logProgress } from './quests';

/**
 * Health Connect readings (SPEC 6.4, task 10.1), applied through the normal pipeline as
 * source `health`:
 * - steps / sleep are day TOTALS: each daily quest measuring them gets a `health_connect`
 *   progress entry (only when the number changed) — a manual entry still wins (SPEC 4.8);
 * - a workout of 10+ minutes completes the workout quest (30+ in full), never downgrading;
 * - days with no such quest still get the Body log filled, unless a value was typed by hand.
 * A reading for yesterday is a real action arriving late: it is accepted for its own day and
 * can turn a missed day active.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reading = z
  .object({
    day,
    /** A moment inside that day the reading stands for (now, or the end of yesterday). */
    at: z.iso.datetime(),
    steps: z.number().int().min(0).max(200_000).nullable(),
    sleepHours: z.number().min(0).max(24).nullable(),
    workoutMinutes: z.number().int().min(0).max(1_440).nullable(),
  })
  .strict();

export const applyHealth = defineAction({
  type: 'health.apply',
  schema: z.object({ readings: z.array(reading).min(1).max(7) }).strict(),
  tables: [...QUEST_TABLES, 'body_logs'],
  async run(ctx, { readings }) {
    let changed = 0;
    for (const r of readings) {
      if ((await appDayOf(ctx.db, r.at)) !== r.day) {
        throw new RuleError(`Reading time is not inside ${r.day}`);
      }
      const dayCtx: ActionContext = { ...ctx, source: 'health', occurredAt: r.at };
      const instances = (await ctx.db.quest_instances.where('day').equals(r.day).toArray()).filter(
        (i) => i.deleted_at === null && i.source_type === 'habit' && i.status !== 'skipped',
      );
      changed += await applyTotal(dayCtx, r.day, instances, 'steps', r.steps);
      changed += await applyTotal(dayCtx, r.day, instances, 'sleep_hours', r.sleepHours);
      changed += await applyWorkout(dayCtx, r.day, instances, r.workoutMinutes);
    }
    return changed;
  },
});

async function applyTotal(
  ctx: ActionContext,
  d: string,
  instances: QuestInstance[],
  field: 'steps' | 'sleep_hours',
  value: number | null,
): Promise<number> {
  if (value === null) return 0;
  const measure = field === 'steps' ? 'steps' : 'sleep_hours';
  const quests = instances.filter((i) => i.measure_snapshot === measure);
  let changed = 0;
  for (const q of quests) {
    const latest = (await ctx.db.progress_entries.where('quest_instance_id').equals(q.id).toArray())
      .filter((e) => e.deleted_at === null && e.source === 'health_connect')
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.hlc.localeCompare(b.hlc))
      .at(-1);
    if (latest?.amount === value) continue;
    await logProgress.run(ctx, {
      instanceId: q.id,
      amount: value,
      source: 'health_connect',
      refId: null,
    });
    changed += 1;
  }
  if (quests.length > 0) return changed; // the quest already shared its value with the Body log

  // No quest measures it: fill the Body log, but never over a number typed by hand.
  const log = (await ctx.db.body_logs.get(bodyLogId(d))) ?? emptyBodyLog(d, ctx.processedAt);
  const typedByHand = log[field] !== null && log.source === 'manual' && log.deleted_at === null;
  if (typedByHand || log[field] === value) return changed;
  await ctx.db.body_logs.put({
    ...log,
    [field]: value,
    source: 'health_connect',
    deleted_at: null,
    ...touch(ctx.processedAt),
  });
  ctx.emit({ type: 'BodyLogged', payload: { day: d } });
  return changed + 1;
}

async function applyWorkout(
  ctx: ActionContext,
  d: string,
  instances: QuestInstance[],
  minutes: number | null,
): Promise<number> {
  const version = workoutVersion(minutes);
  if (!version) return 0;
  let changed = 0;
  for (const q of instances.filter(
    (i) => i.auto_source_snapshot === 'workout' && i.measure_snapshot === 'check',
  )) {
    const upgrade =
      q.status === 'pending' ||
      q.status === 'missed' ||
      (version === 'full' && (q.status === 'done_min' || q.status === 'done_late'));
    if (!upgrade) continue;
    await completeQuest.run(ctx, { instanceId: q.id, version });
    changed += 1;
  }
  const log = (await ctx.db.body_logs.get(bodyLogId(d))) ?? emptyBodyLog(d, ctx.processedAt);
  if (log.workout_notes === null && minutes !== null) {
    await ctx.db.body_logs.put({
      ...log,
      workout_notes: `Workout ${minutes} min (Health Connect)`,
      deleted_at: null,
      ...touch(ctx.processedAt),
    });
    ctx.emit({ type: 'BodyLogged', payload: { day: d } });
  }
  return changed;
}

import { z } from 'zod';
import type { ProgressEntry, QuestInstance } from '@/core/db/types';
import { higherStatus, isDone, progressValue, statusForValue } from '@/core/engine/progress';
import { wakeStatusAt } from '@/core/engine/wake';
import { currentTimeZone } from '@/core/time';
import { getSettings } from '../helpers';
import { newBase } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { applyStatus, guardDay, loadInstance, QUEST_TABLES } from './questCommon';

/**
 * Quest completion actions (SPEC 4.8). Every XP change goes through applyStatus,
 * which writes idempotent XP events — one real action = one award.
 */

const instanceId = z.string().min(1);

/** Full / Minimum tap for `check` quests (one tap, no typing). */
export const completeQuest = defineAction({
  type: 'quest.complete',
  schema: z.object({ instanceId, version: z.enum(['full', 'min']) }).strict(),
  tables: [...QUEST_TABLES],
  async run(ctx, { instanceId: id, version }) {
    const instance = await loadInstance(ctx, id);
    await guardDay(ctx, instance);
    if (instance.measure_snapshot !== 'check') {
      throw new RuleError('This quest is completed by logging progress');
    }
    if (instance.auto_source_snapshot === 'wake_checkin') {
      throw new RuleError('Use the "I\'m up" check-in for the wake-up quest');
    }
    const to = version === 'full' ? 'done_full' : 'done_min';
    if (instance.status === 'done_full' && to === 'done_min') {
      throw new RuleError('Already done in full. Un-tick first to change it.');
    }
    return applyStatus(ctx, instance, to);
  },
});

/**
 * Log progress for numeric quests. minutes/count: `amount` is added.
 * steps/sleep_hours: `amount` is the day total (latest manual entry wins).
 * The status upgrades automatically (min → full gives a top-up, never twice).
 */
export const logProgress = defineAction({
  type: 'quest.logProgress',
  schema: z
    .object({
      instanceId,
      amount: z.number().finite().min(0).max(100_000),
      source: z.enum(['manual', 'focus', 'health_connect', 'job_log', 'widget']).default('manual'),
      refId: z.string().min(1).nullable().default(null),
    })
    .strict(),
  tables: [...QUEST_TABLES],
  async run(ctx, { instanceId: id, amount, source, refId }) {
    const instance = await loadInstance(ctx, id);
    await guardDay(ctx, instance);
    if (instance.measure_snapshot === 'check') {
      throw new RuleError('This quest is completed with Full or Minimum');
    }
    if (
      amount === 0 &&
      (instance.measure_snapshot === 'minutes' || instance.measure_snapshot === 'count')
    ) {
      return instance;
    }
    const entry: ProgressEntry = {
      ...newBase(undefined, ctx.processedAt),
      quest_instance_id: id,
      day: instance.day,
      source,
      amount,
      occurred_at: ctx.occurredAt,
      ref_id: refId,
    };
    await ctx.db.progress_entries.add(entry);
    ctx.emit({ type: 'ProgressAdded', payload: { instanceId: id, day: instance.day, amount } });
    return syncStatusWithProgress(ctx, instance);
  },
});

async function syncStatusWithProgress(
  ctx: ActionContext,
  instance: QuestInstance,
): Promise<QuestInstance> {
  const entries = await ctx.db.progress_entries
    .where('quest_instance_id')
    .equals(instance.id)
    .toArray();
  const value = progressValue(instance.measure_snapshot, entries);
  const reached = statusForValue(value, instance.target_snapshot, instance.min_snapshot);
  const next = higherStatus(instance.status, reached);
  return next === instance.status ? instance : applyStatus(ctx, instance, next);
}

/**
 * "I'm up" wake-up check-in. The TAP time counts (occurred_at), not processing time:
 * by wake time + window → done in full (early taps too); until the late cutoff →
 * done (late); after the cutoff the quest is missed for the day (DECISIONS 1).
 */
export const wakeCheckin = defineAction({
  type: 'quest.wakeCheckin',
  schema: z.object({ instanceId }).strict(),
  tables: [...QUEST_TABLES],
  async run(ctx, { instanceId: id }) {
    const instance = await loadInstance(ctx, id);
    if (instance.auto_source_snapshot !== 'wake_checkin') {
      throw new RuleError('This quest is not the wake-up check-in');
    }
    await guardDay(ctx, instance);
    if (isDone(instance.status)) return instance;
    const status = wakeStatusAt(
      Date.parse(ctx.occurredAt),
      instance.day,
      await getSettings(ctx.db),
      currentTimeZone(),
    );
    if (status === 'missed') throw new RuleError('The wake-up window has closed for today');
    return applyStatus(ctx, instance, status);
  },
});

/**
 * Same-day un-tick (correcting a mistaken tap). Writes a compensating XP event and,
 * for numeric quests, a compensating progress entry so progress returns to zero.
 * Only allowed while the day is open (guardDay).
 */
export const untickQuest = defineAction({
  type: 'quest.untick',
  schema: z.object({ instanceId }).strict(),
  tables: [...QUEST_TABLES],
  async run(ctx, { instanceId: id }) {
    const instance = await loadInstance(ctx, id);
    await guardDay(ctx, instance);
    if (instance.measure_snapshot !== 'check') {
      const entries = await ctx.db.progress_entries.where('quest_instance_id').equals(id).toArray();
      const value = progressValue(instance.measure_snapshot, entries);
      const additive =
        instance.measure_snapshot === 'minutes' || instance.measure_snapshot === 'count';
      if (value !== 0) {
        await ctx.db.progress_entries.add({
          ...newBase(undefined, ctx.processedAt),
          quest_instance_id: id,
          day: instance.day,
          source: 'manual',
          amount: additive ? -value : 0,
          occurred_at: ctx.occurredAt,
          ref_id: null,
        });
      }
    }
    return applyStatus(ctx, instance, 'pending');
  },
});

export { wakeStatusAt };

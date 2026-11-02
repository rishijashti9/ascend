import type { CompletedVia, InstanceStatus, QuestInstance } from '@/core/db/types';
import { netBaseFor, planAward } from '@/core/engine/xp';
import { refreshDayRecord } from '../days';
import { appDayOf } from '../helpers';
import { touch } from '../records';
import { RuleError, type ActionContext, type ActionSource } from '../registry';

/** Tables every completion action touches. */
export const QUEST_TABLES = ['quest_instances', 'progress_entries', 'settings', 'days'] as const;

/** Sources that deliver real actions which may arrive after their day has closed. */
const DELAYED_SOURCES: ActionSource[] = ['widget', 'notification', 'sync', 'health'];

export async function loadInstance(ctx: ActionContext, id: string): Promise<QuestInstance> {
  const instance = await ctx.db.quest_instances.get(id);
  if (!instance || instance.deleted_at) throw new RuleError('That quest no longer exists');
  return instance;
}

/**
 * Day rules (SPEC 4.8):
 * - an action counts for the day it really happened, which must be the quest's day;
 * - after a day closes, Rishi can no longer tick/un-tick it in the app (source 'ui'),
 *   but real actions arriving late (widget queue, notification, sync) are still accepted.
 */
export async function guardDay(ctx: ActionContext, instance: QuestInstance): Promise<void> {
  if (!DELAYED_SOURCES.includes(ctx.source)) {
    const today = await appDayOf(ctx.db, ctx.processedAt);
    if (instance.day < today) throw new RuleError('That day is closed');
  }
  const happenedOn = await appDayOf(ctx.db, ctx.occurredAt);
  if (happenedOn !== instance.day) {
    throw new RuleError(`This quest belongs to ${instance.day}, not ${happenedOn}`);
  }
}

export function viaFor(source: ActionSource): CompletedVia {
  switch (source) {
    case 'widget':
      return 'widget';
    case 'notification':
      return 'notification';
    case 'health':
      return 'health';
    case 'focus':
      return 'focus';
    case 'job_log':
      return 'job_log';
    default:
      return 'tap';
  }
}

/**
 * Moves an instance to a new status and writes the matching XP event(s) through the
 * idempotent pipeline (one net award per instance per day). Returns the updated instance.
 */
export async function applyStatus(
  ctx: ActionContext,
  instance: QuestInstance,
  to: InstanceStatus,
): Promise<QuestInstance> {
  if (instance.status === to) return instance;
  const events = await ctx.db.xp_events.where('ref_id').equals(instance.id).toArray();
  const plan = planAward({
    instanceId: instance.id,
    difficulty: instance.difficulty_snapshot,
    from: instance.status,
    to,
    revision: instance.award_revision,
    currentNetBase: netBaseFor(events, instance.id),
  });

  for (const award of plan.awards) {
    await ctx.addXpEvent({
      day: instance.day,
      occurred_at: ctx.occurredAt,
      stat: instance.stat_snapshot,
      base_amount: award.base_amount,
      reason: award.reason,
      idempotency_key: award.idempotency_key,
      ref_type: 'quest_instance',
      ref_id: instance.id,
    });
  }

  const done = to !== 'pending';
  const next: QuestInstance = {
    ...instance,
    status: to,
    award_revision: plan.revision,
    completed_at: done ? (instance.completed_at ?? ctx.occurredAt) : null,
    completed_via: done ? (instance.completed_via ?? viaFor(ctx.source)) : null,
    ...touch(ctx.processedAt),
  };
  await ctx.db.quest_instances.put(next);
  await refreshDayRecord(ctx.db, next.day, ctx.processedAt);

  ctx.emit(
    done
      ? { type: 'QuestCompleted', payload: { instanceId: next.id, day: next.day, status: to } }
      : { type: 'QuestUncompleted', payload: { instanceId: next.id, day: next.day } },
  );
  ctx.emit({ type: 'DayChanged', payload: { day: next.day } });
  return next;
}

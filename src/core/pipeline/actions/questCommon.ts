import type { CompletedVia, DayString, InstanceStatus, QuestInstance } from '@/core/db/types';
import { addDays } from '@/core/time';
import { netBaseFor, planAward } from '@/core/engine/xp';
import { refreshDayRecord } from '../days';
import { appDayOf } from '../helpers';
import { touch } from '../records';
import { isRecoveryId, refreshStreaks } from '../streaks';
import { RuleError, type ActionContext, type ActionSource } from '../registry';

/** Tables every completion action touches. */
export const QUEST_TABLES = [
  'quest_instances',
  'progress_entries',
  'settings',
  'days',
  'quests',
] as const;

/** Sources that deliver real actions which may arrive after their day has closed. */
const DELAYED_SOURCES: ActionSource[] = ['widget', 'notification', 'sync', 'health'];

export async function loadInstance(ctx: ActionContext, id: string): Promise<QuestInstance> {
  const instance = await ctx.db.quest_instances.get(id);
  if (!instance || instance.deleted_at) throw new RuleError('That quest no longer exists');
  return instance;
}

/** How long an instance stays open: its day (daily, Recovery), its week (weekly) or until done (side). */
export type InstanceSpan = 'day' | 'week' | 'open';

export async function spanOf(ctx: ActionContext, instance: QuestInstance): Promise<InstanceSpan> {
  if (instance.source_type === 'habit' || isRecoveryId(instance.id)) return 'day';
  const quest = await ctx.db.quests.get(instance.source_id);
  return quest?.type === 'weekly' ? 'week' : 'open';
}

/**
 * Day rules (SPEC 4.8). Returns the day the action counts for (its XP goes to that day).
 * - Daily and Recovery quests: the action must happen on the quest's day; after that day
 *   closes, Rishi can no longer tick/un-tick it in the app (source 'ui'), but real actions
 *   arriving late (widget queue, notification, sync) are still accepted.
 * - Weekly quests: any day of their week. Side quests: any day.
 */
export async function guardDay(ctx: ActionContext, instance: QuestInstance): Promise<DayString> {
  const span = await spanOf(ctx, instance);
  const delayed = DELAYED_SOURCES.includes(ctx.source);
  const happenedOn = await appDayOf(ctx.db, ctx.occurredAt);
  if (span === 'day') {
    if (!delayed && instance.day < (await appDayOf(ctx.db, ctx.processedAt))) {
      throw new RuleError('That day is closed');
    }
    if (happenedOn !== instance.day) {
      throw new RuleError(`This quest belongs to ${instance.day}, not ${happenedOn}`);
    }
    return instance.day;
  }
  if (span === 'week') {
    const last = addDays(instance.day, 6);
    if (!delayed && (await appDayOf(ctx.db, ctx.processedAt)) > last) {
      throw new RuleError('That week is over');
    }
    if (happenedOn < instance.day || happenedOn > last) {
      throw new RuleError('This weekly quest belongs to another week');
    }
  }
  return happenedOn;
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
  /** The day the XP counts for (from guardDay); a weekly quest done on Thursday counts on Thursday. */
  xpDay: DayString = instance.day,
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
      day: xpDay,
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
  if (next.source_type === 'habit') await refreshDayRecord(ctx.db, next.day, ctx.processedAt);
  // A Recovery quest doesn't change the day's result, but can repair a missed day.
  if (isRecoveryId(next.id)) await refreshStreaks(ctx.db, ctx.processedAt);
  if (next.source_type === 'quest') {
    const quest = await ctx.db.quests.get(next.source_id);
    if (quest && (quest.status === 'active' || quest.status === 'done')) {
      await ctx.db.quests.put({
        ...quest,
        status: done ? 'done' : 'active',
        ...touch(ctx.processedAt),
      });
    }
  }

  ctx.emit(
    done
      ? { type: 'QuestCompleted', payload: { instanceId: next.id, day: next.day, status: to } }
      : { type: 'QuestUncompleted', payload: { instanceId: next.id, day: next.day } },
  );
  ctx.emit({ type: 'DayChanged', payload: { day: xpDay } });
  return next;
}

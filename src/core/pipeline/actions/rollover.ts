import { z } from 'zod';
import type { DayRecord, DayString, Quest, QuestInstance } from '@/core/db/types';
import { isDone } from '@/core/engine/progress';
import { repairAllowed, type StreakSummary } from '@/core/engine/streaks';
import { addDays, daysBetween } from '@/core/time';
import { recoveryTemplateFor } from '@/data/recovery';
import { refreshDayRecord } from '../days';
import { appDayOf, ensureInstancesForDay } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, type ActionContext } from '../registry';
import { recoveryQuestId, refreshStreaks } from '../streaks';

/**
 * Day rollover (PLAN "Day rollover"): closes every unclosed past day in order, starts today
 * and creates today's Recovery quest when it's needed. Idempotent: running it late, twice or
 * after weeks away gives the same result. Runs on app open/resume and at the day-start hour.
 */
export interface RolloverResult {
  today: DayString;
  /** Days closed by this run, oldest first. */
  closedDays: DayString[];
  /** Closed days the app was never opened on (for the welcome-back message). */
  daysAway: number;
  /** Shields used on the days closed by this run. */
  shieldsUsed: number;
  streak: StreakSummary;
  /** Today's Recovery quest id, if there is one. */
  recoveryQuestId: string | null;
}

export const rollover = defineAction({
  type: 'day.rollover',
  schema: z.object({}).strict(),
  tables: ['days', 'quest_instances', 'quests', 'habits', 'settings', 'profile'],
  async run(ctx): Promise<RolloverResult> {
    const { db } = ctx;
    const today = await appDayOf(db, ctx.processedAt);
    const profile = await db.profile.get('profile');
    const records = (await db.days.toArray()).filter((d) => d.deleted_at === null);
    const first = profile?.start_day ?? records[0]?.day ?? null;

    const known = new Set(records.map((d) => d.day));
    const toClose = new Set(records.filter((d) => !d.closed_at && d.day < today).map((d) => d.day));
    if (first !== null) {
      const lastClosed = records.filter((d) => d.closed_at).at(-1)?.day;
      const from = lastClosed && lastClosed >= first ? addDays(lastClosed, 1) : first;
      for (const day of daysBetween(from, addDays(today, -1))) toClose.add(day);
    }

    const closedDays = [...toClose].sort();
    for (const day of closedDays) await closeDay(ctx, day, first);

    if (first !== null && today >= first) {
      await ensureInstancesForDay(db, today);
      await refreshDayRecord(db, today, ctx.processedAt);
    }
    const streak = await refreshStreaks(db, ctx.processedAt);
    const recoveryId =
      first !== null && today > first ? await ensureRecoveryQuest(ctx, today, streak) : null;

    const closedSet = new Set(closedDays);
    const after = (await db.days.toArray()).filter((d) => closedSet.has(d.day));
    return {
      today,
      closedDays,
      daysAway: closedDays.filter((d) => !known.has(d)).length,
      shieldsUsed: after.filter((d) => d.shield_used).length,
      streak,
      recoveryQuestId: recoveryId,
    };
  },
});

/** Unfinished quests of a closed day become missed (no XP change), then the day is closed. */
async function closeDay(ctx: ActionContext, day: DayString, first: DayString | null) {
  const { db, processedAt } = ctx;
  if (first !== null && day >= first) await ensureInstancesForDay(db, day);

  const instances = await db.quest_instances.where('day').equals(day).toArray();
  for (const instance of instances) {
    if (instance.deleted_at === null && instance.status === 'pending') {
      await db.quest_instances.put({ ...instance, status: 'missed', ...touch(processedAt) });
    }
  }
  const quests = await db.quests.where('due_day').equals(day).toArray();
  for (const quest of quests) {
    if (quest.deleted_at !== null || quest.status !== 'active') continue;
    const instance = instances.find((i) => i.id === quest.id);
    const status = instance && isDone(instance.status) ? 'done' : 'not_done';
    await db.quests.put({ ...quest, status, ...touch(processedAt) });
  }

  await refreshDayRecord(db, day, processedAt, { closed_at: processedAt });
  ctx.emit({ type: 'DayClosed', payload: { day } });
}

/**
 * The Recovery quest appears on the return day after a missed day that no shield covered
 * (SPEC 4.8). It repairs that day only if the streak engine would (exactly one unprotected
 * miss, rolling 7-day limit); otherwise it is a kind fresh start worth Easy XP (DECISIONS 3).
 */
async function ensureRecoveryQuest(
  ctx: ActionContext,
  today: DayString,
  streak: StreakSummary,
): Promise<string | null> {
  const { db, processedAt } = ctx;
  const id = recoveryQuestId(today);
  const existing = await db.quests.get(id);
  if (existing) return existing.deleted_at === null ? id : null;

  const lastDecided = (await db.days.toArray())
    .filter((d) => d.deleted_at === null && d.day < today && d.closed_at && !d.neutral)
    .at(-1);
  if (!lastDecided || !missedUnprotected(lastDecided)) return null;

  const template = recoveryTemplateFor(today);
  const repairs =
    streak.repairable && repairAllowed(streak.lastRepairDay, today) ? streak.repairable.day : null;
  const quest: Quest = {
    ...newBase(id, processedAt),
    type: 'recovery',
    title: template.title,
    stat: template.stat,
    difficulty: 'easy',
    measure: 'check',
    target_value: null,
    min_value: null,
    skill_ids: [],
    week_start: null,
    due_day: today,
    status: 'active',
    planned_by: 'rules',
    carried_over_from: null,
    repairs_day: repairs,
    order: 0,
    linked_goal_type: null,
    linked_goal_id: null,
  };
  const instance: QuestInstance = {
    ...newBase(id, processedAt),
    source_type: 'quest',
    source_id: id,
    day: today,
    status: 'pending',
    title_snapshot: template.title,
    stat_snapshot: template.stat,
    difficulty_snapshot: 'easy',
    measure_snapshot: 'check',
    target_snapshot: null,
    min_snapshot: null,
    full_version_snapshot: template.task,
    min_version_snapshot: template.task,
    core_snapshot: false,
    auto_source_snapshot: 'none',
    completed_at: null,
    completed_via: null,
    award_revision: 0,
  };
  await db.quests.put(quest);
  await db.quest_instances.put(instance);
  return id;
}

function missedUnprotected(day: DayRecord): boolean {
  return !day.active && !day.shield_used && !day.repaired;
}

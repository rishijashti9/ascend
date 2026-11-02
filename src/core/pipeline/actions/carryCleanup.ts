import type { PlanChange, PlanHistory, Quest, QuestInstance } from '@/core/db/types';
import { newBase, touch } from '../records';
import type { ActionContext } from '../registry';

/**
 * A weekly quest planned ahead at the weekly review is carried into next week as a copy
 * (`carried_over_from`). If the original is then finished this week, the copy is no longer
 * needed: it is removed automatically — but only while nobody has started or edited it — and
 * the removal is a Plan history entry, so it can be undone like any plan. Un-ticking the
 * original (the same-day correction) brings the copy back.
 *
 * Runs inside the quest action's transaction (QUEST_TABLES includes plan_history).
 */
export const cleanupTrigger = (originalId: string) => `carry_cleanup:${originalId}`;

// Same as questInstanceId (questDefs.ts imports questCommon, so it can't be imported here).
const instanceIdOf = (q: Quest) => `${q.id}:${q.week_start ?? ''}`;

async function untouchedCopies(
  ctx: ActionContext,
  original: Quest,
): Promise<{ quest: Quest; instance: QuestInstance }[]> {
  const copies = await ctx.db.quests.filter((q) => q.carried_over_from === original.id).toArray();
  const result: { quest: Quest; instance: QuestInstance }[] = [];
  for (const quest of copies) {
    if (
      quest.deleted_at !== null ||
      quest.type !== 'weekly' ||
      quest.status !== 'active' ||
      !quest.week_start ||
      !original.week_start ||
      quest.week_start <= original.week_start ||
      quest.updated_at !== quest.created_at // edited since it was planned
    )
      continue;
    const instance = await ctx.db.quest_instances.get(instanceIdOf(quest));
    if (
      !instance ||
      instance.deleted_at !== null ||
      instance.status !== 'pending' ||
      instance.updated_at !== instance.created_at
    )
      continue;
    const started = await ctx.db.progress_entries
      .where('quest_instance_id')
      .equals(instance.id)
      .count();
    if (started > 0) continue;
    result.push({ quest, instance });
  }
  return result;
}

/** The original was finished: remove its untouched carried copies (logged in Plan history). */
export async function dropCarriedCopies(ctx: ActionContext, original: Quest): Promise<void> {
  if (original.type !== 'weekly') return;
  const at = ctx.processedAt;
  for (const { quest, instance } of await untouchedCopies(ctx, original)) {
    const removedQuest: Quest = { ...quest, status: 'archived', deleted_at: at, ...touch(at) };
    const removedInstance: QuestInstance = { ...instance, deleted_at: at, ...touch(at) };
    await ctx.db.quests.put(removedQuest);
    await ctx.db.quest_instances.put(removedInstance);
    const changes: PlanChange[] = [
      { entity: 'quests', id: quest.id, before: quest, after: removedQuest },
      { entity: 'quest_instances', id: instance.id, before: instance, after: removedInstance },
    ];
    const history: PlanHistory = {
      ...newBase(undefined, at),
      goal_type: quest.linked_goal_type,
      goal_id: quest.linked_goal_id,
      trigger: cleanupTrigger(original.id),
      summary: `“${original.title}” was finished, so its carried-over copy was removed from next week.`,
      changes,
      source: 'rules',
      undone_at: null,
    };
    await ctx.db.plan_history.add(history);
    ctx.emit({ type: 'QuestChanged', payload: { questId: quest.id, change: 'archived' } });
  }
}

/**
 * The original was un-ticked: undo its cleanups, if the removed copies are still exactly as
 * the cleanup left them (otherwise they stay removed; Plan history explains).
 */
export async function restoreCarriedCopies(ctx: ActionContext, original: Quest): Promise<void> {
  if (original.type !== 'weekly') return;
  const at = ctx.processedAt;
  const entries = await ctx.db.plan_history
    .filter((h) => h.trigger === cleanupTrigger(original.id) && !h.undone_at && !h.deleted_at)
    .toArray();
  for (const entry of entries) {
    let intact = true;
    for (const c of entry.changes) {
      const current = (await ctx.db.table(c.entity).get(c.id)) as { hlc: string } | undefined;
      if (!current || current.hlc !== (c.after as { hlc: string }).hlc) intact = false;
    }
    if (!intact) continue;
    // Exactly as planned again (a new hlc for sync, the old updated_at), so ticking the
    // original once more removes the copy again.
    for (const c of [...entry.changes].reverse()) {
      await ctx.db.table(c.entity).put({ ...(c.before as object), hlc: touch(at).hlc });
    }
    await ctx.db.plan_history.put({ ...entry, undone_at: at, ...touch(at) });
    const questId = entry.changes.find((c) => c.entity === 'quests')?.id;
    if (questId) ctx.emit({ type: 'QuestChanged', payload: { questId, change: 'restored' } });
  }
}

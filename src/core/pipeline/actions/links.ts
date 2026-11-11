import { z } from 'zod';
import { writeLearning } from '@/core/adaptive/record';
import type { PlanHistory, PlanProposal } from '@/core/db/types';
import type { ProposalItem } from '@/core/planner/types';
import { addDays } from '@/core/time';
import { appDayOf } from '../helpers';
import { newBase } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { applyProposal, PLAN_TABLES } from './planApply';

/**
 * "Link your daily quests" (linking plan L2, docs/product/LINKING-PLAN.md). Applying links the
 * chosen daily quests to main quests through the plan path — one Plan history entry, with Undo —
 * exactly like the other System suggestions. "Not now" hides the card for a week; "Don't ask
 * again" hides it for good. Both are device-local (meta), like the difficulty snoozes.
 */
export const LINKS_SNOOZE_KEY = 'links_snooze';
export const LINKS_SNOOZE_DAYS = 7;
/** Stored instead of a date when the person said "Don't ask again". */
export const LINKS_NEVER = 'never';

async function hide(ctx: ActionContext, forever: boolean, applied: boolean) {
  const today = await appDayOf(ctx.db, ctx.processedAt);
  if (!applied)
    await writeLearning(ctx, { kind: 'suggestion', type: 'link_quests', outcome: 'rejected' });
  await ctx.db.meta.put({
    id: LINKS_SNOOZE_KEY,
    value: forever ? LINKS_NEVER : addDays(today, LINKS_SNOOZE_DAYS),
  });
}

export const snoozeLinks = defineAction({
  type: 'links.snooze',
  schema: z.object({ forever: z.boolean() }).strict(),
  tables: ['meta', 'settings', 'learning_events'],
  async run(ctx, { forever }) {
    await hide(ctx, forever, false);
    return true;
  },
});

const link = z
  .object({ habitId: z.string().min(1), title: z.string(), mainQuestId: z.string().min(1) })
  .strict();

export const applyLinks = defineAction({
  type: 'links.apply',
  schema: z.object({ links: z.array(link).min(1).max(20) }).strict(),
  tables: [...PLAN_TABLES, 'meta'],
  async run(ctx, { links }): Promise<PlanHistory> {
    const items: ProposalItem[] = [];
    for (const [n, l] of links.entries()) {
      const habit = await ctx.db.habits.get(l.habitId);
      if (!habit || habit.deleted_at || habit.status !== 'active')
        throw new RuleError(`“${l.title}” can’t be linked any more`);
      const quest = await ctx.db.main_quests.get(l.mainQuestId);
      if (!quest || quest.deleted_at || quest.status !== 'active')
        throw new RuleError('That main quest isn’t active any more');
      items.push({
        id: `l${n}`,
        kind: 'habit.update',
        habitId: habit.id,
        title: habit.title,
        selected: true,
        reason: `${habit.title} → ${quest.title}`,
        changes: { linked_goal_type: 'main_quest', linked_goal_id: quest.id },
      });
    }
    const today = await appDayOf(ctx.db, ctx.processedAt);
    const proposal: PlanProposal = {
      ...newBase(undefined, ctx.processedAt),
      goal_type: null,
      goal_id: null,
      trigger: `links:${today}`,
      summary: `Linked ${items.length} daily quest${items.length === 1 ? '' : 's'} to the main quest${items.length === 1 ? '' : 's'} they serve.`,
      items,
      status: 'pending',
      source: 'rules',
      auto_apply_at: null,
      plan_history_id: null,
    };
    await ctx.db.plan_proposals.add(proposal);
    await writeLearning(ctx, { kind: 'suggestion', type: 'link_quests', outcome: 'accepted' });
    const history = await applyProposal(
      ctx,
      proposal,
      items.map((i) => i.id),
    );
    await hide(ctx, false, true);
    return history;
  },
});

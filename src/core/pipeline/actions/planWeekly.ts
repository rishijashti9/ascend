import { z } from 'zod';
import type { PlanHistory, PlanProposal } from '@/core/db/types';
import type { ProposalItem } from '@/core/planner/types';
import { appDayOf } from '../helpers';
import { newBase } from '../records';
import { defineAction } from '../registry';
import { applyProposal, PLAN_TABLES } from './planApply';

/**
 * The weekly plan (SPEC 4.5): once per week, this week's quests are planned and applied
 * immediately (with Undo in Plan history). Idempotent: a second run in the same week does
 * nothing, so it is safe on every app open and on two devices.
 */
export const planWeekly = defineAction({
  type: 'plan.weekly',
  schema: z
    .object({
      week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      items: z.array(z.looseObject({ id: z.string(), kind: z.literal('quest.create') })).max(20),
    })
    .strict(),
  tables: PLAN_TABLES,
  async run(ctx, { week_start, items }): Promise<PlanHistory | null> {
    const key = `weekly_plan:${week_start}`;
    if (await ctx.db.meta.get(key)) return null;
    await ctx.db.meta.put({ id: key, value: ctx.processedAt });
    if (items.length === 0) return null;

    const list = items as unknown as ProposalItem[];
    // Planned ahead during the weekly review, or on the week's first day.
    const ahead = (await appDayOf(ctx.db, ctx.processedAt)) < week_start;
    const carried = list.filter(
      (i) => i.kind === 'quest.create' && i.data.carried_over_from,
    ).length;
    const proposal: PlanProposal = {
      ...newBase(undefined, ctx.processedAt),
      goal_type: null,
      goal_id: null,
      // The week is part of the trigger, so a week planned ahead (weekly review) is recognised.
      trigger: `weekly:${week_start}`,
      summary: `${ahead ? 'Next' : 'This'} week’s quests: ${list.length}${carried ? ` (${carried} carried over)` : ''}.`,
      items: list,
      status: 'pending',
      source: 'rules',
      auto_apply_at: ctx.processedAt,
      plan_history_id: null,
    };
    await ctx.db.plan_proposals.add(proposal);
    return applyProposal(
      ctx,
      proposal,
      list.map((i) => i.id),
    );
  },
});

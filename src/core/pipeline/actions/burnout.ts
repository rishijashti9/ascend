import { z } from 'zod';
import { writeLearning } from '@/core/adaptive/record';
import type { PlanHistory, PlanProposal } from '@/core/db/types';
import { smallerTarget } from '@/core/engine/difficulty';
import type { ProposalItem } from '@/core/planner/types';
import { appDayOf } from '../helpers';
import { newBase } from '../records';
import { defineAction, RuleError } from '../registry';
import { applyProposal, PLAN_TABLES } from './planApply';

/**
 * "Make this week lighter" (SPEC 6.7 A burnout warning): numeric daily quests get smaller
 * targets — non-core 25 % less, core 15 % less — never below their minimum, never sleep.
 * Goes through the plan path: one Plan history entry with Undo.
 */
const ADJUSTABLE = new Set(['minutes', 'count', 'steps']);
const UNIT: Record<string, string> = { minutes: ' min', steps: ' steps', count: '' };

export const lighterWeek = defineAction({
  type: 'adaptive.lighterWeek',
  schema: z.object({}).strict(),
  tables: [...PLAN_TABLES, 'meta'],
  async run(ctx): Promise<PlanHistory> {
    const habits = (await ctx.db.habits.toArray())
      .filter((h) => !h.deleted_at && h.status === 'active' && ADJUSTABLE.has(h.measure))
      .sort((a, b) => a.order - b.order);
    const items: ProposalItem[] = [];
    for (const h of habits) {
      const to = smallerTarget(h, h.core ? 0.5 : 0.3);
      if (to === null || !h.target_value) continue;
      items.push({
        id: `l${items.length}`,
        kind: 'habit.update',
        habitId: h.id,
        title: h.title,
        selected: true,
        reason: `${h.title}: ${h.target_value} → ${to}${UNIT[h.measure] ?? ''} for a lighter week`,
        changes: { target_value: to, min_value: Math.min(h.min_value ?? to, to) },
      });
    }
    if (items.length === 0) throw new RuleError('Your daily quests are already at their minimums');
    const today = await appDayOf(ctx.db, ctx.processedAt);
    const n = items.length;
    const proposal: PlanProposal = {
      ...newBase(undefined, ctx.processedAt),
      goal_type: null,
      goal_id: null,
      trigger: `burnout:${today}`,
      summary: `A lighter week: ${n} daily quest${n === 1 ? '' : 's'} made smaller. The minimums still keep your streak.`,
      items,
      status: 'pending',
      source: 'rules',
      auto_apply_at: null,
      plan_history_id: null,
    };
    await ctx.db.plan_proposals.add(proposal);
    await writeLearning(ctx, { kind: 'suggestion', type: 'burnout', outcome: 'accepted' });
    return applyProposal(
      ctx,
      proposal,
      items.map((i) => i.id),
    );
  },
});

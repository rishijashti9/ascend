import { z } from 'zod';
import { planSuggestionType, writeLearning } from '@/core/adaptive/record';
import type { PlanProposal } from '@/core/db/types';
import { newBase, touch } from '../records';
import { defineAction, RuleError } from '../registry';

/**
 * Goal Planner proposals (SPEC 6.3 steps 3–4). A proposal is saved first and applied only when
 * Rishi approves it (or automatically for weekly plans, task 3.8) — always with Undo (3.7).
 */
const goalType = z.enum(['dream', 'main_quest', 'milestone']);

/** Items come from the rule engine; checked loosely here and strictly when applied. */
const itemSchema = z.looseObject({
  id: z.string().min(1),
  kind: z.string().min(1),
  reason: z.string(),
  selected: z.boolean(),
});

export const proposePlan = defineAction({
  type: 'plan.propose',
  schema: z
    .object({
      goal_type: goalType.nullable(),
      goal_id: z.string().min(1).nullable(),
      trigger: z.string().min(1).max(60),
      summary: z.string().max(500),
      items: z.array(itemSchema).max(200),
      /** Interview answers to remember on the goal (never asked twice). */
      answers: z.record(z.string(), z.unknown()).default({}),
      auto_apply_at: z.string().nullable().default(null),
    })
    .strict(),
  tables: ['plan_proposals', 'dreams', 'main_quests', 'milestones'],
  async run(ctx, p) {
    if (p.goal_type && p.goal_id && Object.keys(p.answers).length > 0) {
      const table =
        p.goal_type === 'dream'
          ? ctx.db.dreams
          : p.goal_type === 'main_quest'
            ? ctx.db.main_quests
            : ctx.db.milestones;
      const goal = await table.get(p.goal_id);
      if (!goal || goal.deleted_at) throw new RuleError('That goal no longer exists');
      await table.put({
        ...goal,
        planner_context: { ...goal.planner_context, ...p.answers },
        ...touch(ctx.processedAt),
      } as never);
    }
    // One open proposal per goal: a newer plan replaces the older one.
    if (p.goal_id) {
      const older = await ctx.db.plan_proposals.where('goal_id').equals(p.goal_id).toArray();
      for (const o of older) {
        if (o.status === 'pending' && o.deleted_at === null) {
          await ctx.db.plan_proposals.put({ ...o, status: 'rejected', ...touch(ctx.processedAt) });
        }
      }
    }
    const proposal: PlanProposal = {
      ...newBase(undefined, ctx.processedAt),
      goal_type: p.goal_type,
      goal_id: p.goal_id,
      trigger: p.trigger,
      summary: p.summary,
      items: p.items,
      status: 'pending',
      source: 'rules',
      auto_apply_at: p.auto_apply_at,
      plan_history_id: null,
    };
    await ctx.db.plan_proposals.add(proposal);
    ctx.emit({ type: 'PlanProposed', payload: { proposalId: proposal.id, goalId: p.goal_id } });
    return proposal;
  },
});

/** "Not now": the proposal is set aside (kept for history). */
export const rejectPlan = defineAction({
  type: 'plan.reject',
  schema: z.object({ id: z.string().min(1) }).strict(),
  tables: ['plan_proposals', 'learning_events', 'settings'],
  async run(ctx, { id }) {
    const p = await ctx.db.plan_proposals.get(id);
    if (!p || p.status !== 'pending') throw new RuleError('That plan is no longer waiting');
    await writeLearning(ctx, {
      kind: 'suggestion',
      type: planSuggestionType(p.trigger),
      outcome: 'rejected',
      ref_id: id,
    });
    await ctx.db.plan_proposals.put({ ...p, status: 'rejected', ...touch(ctx.processedAt) });
    ctx.emit({ type: 'PlanProposed', payload: { proposalId: id, goalId: p.goal_id } });
  },
});

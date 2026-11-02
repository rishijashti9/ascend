import { z } from 'zod';
import type { PlanHistory, PlanProposal } from '@/core/db/types';
import { SNOOZE_DAYS, type SuggestionKind } from '@/core/engine/difficulty';
import type { ProposalItem } from '@/core/planner/types';
import { addDays } from '@/core/time';
import { appDayOf } from '../helpers';
import { newBase } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { applyProposal, PLAN_TABLES } from './planApply';

/**
 * Difficulty suggestions (SPEC 6.1): "Not now" hides one for a while; applying one changes the
 * listed daily quests' targets through the plan path (one Plan history entry, with Undo) and
 * hides it too, since the days that caused it don't change.
 */
export const snoozeKey = (kind: SuggestionKind) => `difficulty_snooze:${kind}`;
const KINDS = ['low_energy', 'ease', 'raise'] as const;

async function snooze(ctx: ActionContext, kind: SuggestionKind, applied: boolean) {
  const today = await appDayOf(ctx.db, ctx.processedAt);
  await ctx.db.meta.put({ id: snoozeKey(kind), value: addDays(today, SNOOZE_DAYS[kind]) });
  ctx.emit({ type: 'SuggestionAnswered', payload: { kind, applied } });
}

export const snoozeSuggestion = defineAction({
  type: 'difficulty.snooze',
  schema: z.object({ kind: z.enum(KINDS) }).strict(),
  tables: ['meta', 'settings'],
  async run(ctx, { kind }) {
    await snooze(ctx, kind, false);
    return true;
  },
});

const change = z
  .object({
    habitId: z.string().min(1),
    title: z.string(),
    measure: z.enum(['minutes', 'count', 'steps']),
    from: z.number().positive(),
    to: z.number().positive().max(100_000),
  })
  .strict();

const UNIT: Record<string, string> = { minutes: ' min', steps: ' steps', count: '' };

export const applySuggestion = defineAction({
  type: 'difficulty.apply',
  schema: z
    .object({ kind: z.enum(['ease', 'raise']), changes: z.array(change).min(1).max(12) })
    .strict(),
  tables: [...PLAN_TABLES, 'meta'],
  async run(ctx, { kind, changes }): Promise<PlanHistory> {
    const items: ProposalItem[] = [];
    for (const [n, c] of changes.entries()) {
      const habit = await ctx.db.habits.get(c.habitId);
      if (!habit || habit.deleted_at || habit.status !== 'active' || !habit.target_value)
        throw new RuleError(`“${c.title}” can’t be changed any more`);
      const min = Math.min(habit.min_value ?? c.to, c.to);
      items.push({
        id: `d${n}`,
        kind: 'habit.update',
        habitId: habit.id,
        title: habit.title,
        selected: true,
        reason: `${habit.title}: ${habit.target_value} → ${c.to}${UNIT[c.measure] ?? ''}`,
        changes: { target_value: c.to, min_value: min },
      });
    }
    const today = await appDayOf(ctx.db, ctx.processedAt);
    const first = changes[0];
    const summary =
      kind === 'raise' && first
        ? `Raised “${first.title}” to ${first.to}${UNIT[first.measure] ?? ''} after 7 days at 100%.`
        : `Made ${changes.length} daily quest${changes.length === 1 ? '' : 's'} smaller after 3 hard days.`;
    const proposal: PlanProposal = {
      ...newBase(undefined, ctx.processedAt),
      goal_type: null,
      goal_id: null,
      trigger: `difficulty:${kind}:${today}`,
      summary,
      items,
      status: 'pending',
      source: 'rules',
      auto_apply_at: null,
      plan_history_id: null,
    };
    await ctx.db.plan_proposals.add(proposal);
    const history = await applyProposal(
      ctx,
      proposal,
      items.map((i) => i.id),
    );
    await snooze(ctx, kind, true);
    return history;
  },
});

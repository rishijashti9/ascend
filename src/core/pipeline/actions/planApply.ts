import { z } from 'zod';
import type { TableName } from '@/core/db/db';
import type { PlanChange, PlanHistory } from '@/core/db/types';
import type { ProposalItem } from '@/core/planner/types';
import { newBase, touch } from '../records';
import { defineAction, RuleError, type ActionContext, type ActionDefinition } from '../registry';
import { createMilestone, setMainQuestStatus, setMilestoneStatus } from './goals';
import { archiveHabit, createHabit, pauseHabit, restoreHabit, updateHabit } from './habits';
import { createQuest, questInstanceId, setQuestArchived } from './questDefs';

/**
 * Applies an approved plan (SPEC 6.3 step 4) in ONE transaction: every selected item runs
 * through the same action code as a manual change (same rules and checks), as source
 * 'planner'. Every touched record's before/after is stored in plan_history so the whole plan
 * can be undone exactly (task 3.7).
 */
export const PLAN_TABLES: TableName[] = [
  'plan_proposals',
  'plan_history',
  'dreams',
  'main_quests',
  'milestones',
  'habits',
  'quests',
  'quest_instances',
  'progress_entries',
  'settings',
  'days',
];

/** Run another action's code inside this transaction (validated by its own schema). */
async function runInside<R>(
  def: ActionDefinition<z.ZodType, R>,
  ctx: ActionContext,
  payload: unknown,
): Promise<R> {
  return def.run(ctx, def.schema.parse(payload));
}

type Snapshot = { entity: TableName; id: string };

async function read(ctx: ActionContext, s: Snapshot): Promise<unknown> {
  return (await ctx.db.table(s.entity).get(s.id)) ?? null;
}

const editSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    target_value: z.number().positive().optional(),
  })
  .strict();

export const applyPlan = defineAction({
  type: 'plan.apply',
  schema: z
    .object({
      id: z.string().min(1),
      /** Item ids Rishi kept ticked. */
      selected: z.array(z.string().min(1)),
      /** Small edits made in the preview (title, daily-quest target). */
      edits: z.record(z.string(), editSchema).default({}),
    })
    .strict(),
  tables: PLAN_TABLES,
  async run(outer, { id, selected, edits }) {
    const proposal = await outer.db.plan_proposals.get(id);
    if (!proposal || proposal.status !== 'pending')
      throw new RuleError('That plan is no longer waiting');
    const ctx: ActionContext = { ...outer, source: 'planner' };
    const keep = new Set(selected);
    const items = (proposal.items as ProposalItem[]).filter((i) => keep.has(i.id));
    const refs = new Map<string, string>(); // `ref:i1` → created milestone id
    const changes: PlanChange[] = [];
    const resolve = (v: string | null) => (v && v.startsWith('ref:') ? (refs.get(v) ?? null) : v);

    const record = async (snaps: Snapshot[], apply: () => Promise<unknown>) => {
      const before = await Promise.all(snaps.map((s) => read(ctx, s)));
      await apply();
      for (const [n, s] of snaps.entries()) {
        changes.push({ entity: s.entity, id: s.id, before: before[n], after: await read(ctx, s) });
      }
    };

    for (const item of items) {
      const edit = edits[item.id] ?? {};
      switch (item.kind) {
        case 'milestone.create': {
          const m = await runInside(createMilestone, ctx, {
            ...item.data,
            title: edit.title ?? item.data.title,
          });
          refs.set(`ref:${item.id}`, m.id);
          changes.push({ entity: 'milestones', id: m.id, before: null, after: m });
          break;
        }
        case 'quest.create': {
          const linked = resolve(item.data.linked_goal_id);
          if (!linked) break; // its milestone was unticked: nothing to attach it to
          const q = await runInside(createQuest, ctx, {
            ...item.data,
            title: edit.title ?? item.data.title,
            linked_goal_id: linked,
            planned_by: 'rules',
          });
          changes.push({ entity: 'quests', id: q.id, before: null, after: q });
          const instId = questInstanceId(q);
          changes.push({
            entity: 'quest_instances',
            id: instId,
            before: null,
            after: await read(ctx, { entity: 'quest_instances', id: instId }),
          });
          break;
        }
        case 'habit.create': {
          const target = edit.target_value ?? item.data.target_value;
          const h = await runInside(createHabit, ctx, {
            ...item.data,
            title: edit.title ?? item.data.title,
            target_value: target,
            min_value:
              item.data.min_value !== null && target !== null
                ? Math.min(item.data.min_value, target)
                : item.data.min_value,
            linked_goal_id: resolve(item.data.linked_goal_id),
            planned_by: 'rules',
          });
          changes.push({ entity: 'habits', id: h.id, before: null, after: h });
          break;
        }
        case 'habit.update':
          await record([{ entity: 'habits', id: item.habitId }], () =>
            runInside(updateHabit, ctx, { id: item.habitId, changes: item.changes }),
          );
          break;
        case 'habit.pause':
        case 'habit.archive':
        case 'habit.restore': {
          const def =
            item.kind === 'habit.pause'
              ? pauseHabit
              : item.kind === 'habit.archive'
                ? archiveHabit
                : restoreHabit;
          await record([{ entity: 'habits', id: item.habitId }], () =>
            runInside(def, ctx, { id: item.habitId }),
          );
          break;
        }
        case 'quest.archive': {
          const q = await ctx.db.quests.get(item.questId);
          if (!q) break;
          await record(
            [
              { entity: 'quests', id: q.id },
              { entity: 'quest_instances', id: questInstanceId(q) },
            ],
            () => runInside(setQuestArchived, ctx, { id: q.id, archived: true }),
          );
          break;
        }
        case 'milestone.setStatus':
          await record([{ entity: 'milestones', id: item.milestoneId }], () =>
            runInside(setMilestoneStatus, ctx, { id: item.milestoneId, status: item.status }),
          );
          break;
        case 'mainQuest.setStatus':
          await record([{ entity: 'main_quests', id: item.mainQuestId }], () =>
            runInside(setMainQuestStatus, ctx, { id: item.mainQuestId, status: item.status }),
          );
          break;
      }
    }

    const history: PlanHistory = {
      ...newBase(undefined, ctx.processedAt),
      goal_type: proposal.goal_type,
      goal_id: proposal.goal_id,
      trigger: proposal.trigger,
      summary: proposal.summary,
      changes,
      source: proposal.source,
      undone_at: null,
    };
    await ctx.db.plan_history.add(history);
    await ctx.db.plan_proposals.put({
      ...proposal,
      status: 'applied',
      plan_history_id: history.id,
      ...touch(ctx.processedAt),
    });
    ctx.emit({ type: 'PlanApplied', payload: { proposalId: proposal.id, historyId: history.id } });
    return history;
  },
});

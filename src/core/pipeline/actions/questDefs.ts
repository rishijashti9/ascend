import { z } from 'zod';
import type { Quest, QuestInstance } from '@/core/db/types';
import { weekStartOf } from '@/core/time';
import { appDayOf, getSettings } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { difficultySchema, statSchema } from './habitSchema';

/**
 * Weekly and side quests (SPEC 4.5). Weekly quests belong to one week (instance id
 * `quest_id:week_start`); side quests are one-off tasks (instance id = quest id) with an
 * optional due day. Both are completed with the normal completion actions, never affect
 * Daily Clear, and their XP counts on the day they are done.
 */
const TABLES = ['quests', 'quest_instances', 'settings', 'milestones', 'main_quests'] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const linkSchema = {
  linked_goal_type: z.enum(['main_quest', 'milestone']).nullable(),
  linked_goal_id: z.string().min(1).nullable(),
};

const fields = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(120),
    stat: statSchema,
    difficulty: difficultySchema,
    measure: z.enum(['check', 'count', 'minutes']),
    target_value: z.number().positive().nullable(),
    ...linkSchema,
    due_day: day.nullable(),
    skill_ids: z.array(z.string().min(1)).max(20),
  })
  .strict();

export const questDefSchema = fields.extend({
  type: z.enum(['weekly', 'side']),
  difficulty: difficultySchema.default('normal'),
  measure: z.enum(['check', 'count', 'minutes']).default('check'),
  target_value: z.number().positive().nullable().default(null),
  linked_goal_type: linkSchema.linked_goal_type.default(null),
  linked_goal_id: linkSchema.linked_goal_id.default(null),
  due_day: day.nullable().default(null),
  skill_ids: z.array(z.string().min(1)).max(20).default([]),
  /** Weekly quests: which week (defaults to the current one). */
  week_start: day.nullable().default(null),
  planned_by: z.enum(['me', 'rules', 'ai']).default('me'),
  carried_over_from: z.string().min(1).nullable().default(null),
});

export type QuestDefInput = z.input<typeof questDefSchema>;

async function checkFields(ctx: ActionContext, q: z.infer<typeof fields>) {
  if (q.measure !== 'check' && q.target_value === null) {
    throw new RuleError('A counted quest needs a target');
  }
  if (q.measure === 'count' && q.target_value !== null && !Number.isInteger(q.target_value)) {
    throw new RuleError('A count must be a whole number');
  }
  if ((q.linked_goal_type === null) !== (q.linked_goal_id === null)) {
    throw new RuleError('A goal link needs both a type and an id');
  }
  if (q.linked_goal_type && q.linked_goal_id) {
    const goal =
      q.linked_goal_type === 'milestone'
        ? await ctx.db.milestones.get(q.linked_goal_id)
        : await ctx.db.main_quests.get(q.linked_goal_id);
    if (!goal || goal.deleted_at) throw new RuleError('The linked goal no longer exists');
  }
}

type Snapshot = Pick<
  QuestInstance,
  | 'title_snapshot'
  | 'stat_snapshot'
  | 'difficulty_snapshot'
  | 'measure_snapshot'
  | 'target_snapshot'
  | 'min_snapshot'
  | 'full_version_snapshot'
  | 'min_version_snapshot'
  | 'core_snapshot'
  | 'auto_source_snapshot'
>;

function snapshot(q: Quest): Snapshot {
  return {
    title_snapshot: q.title,
    stat_snapshot: q.stat,
    difficulty_snapshot: q.difficulty,
    measure_snapshot: q.measure,
    // One completion: the target is both full and minimum (weekly/side quests have no "min version").
    target_snapshot: q.target_value,
    min_snapshot: q.target_value,
    full_version_snapshot: '',
    min_version_snapshot: '',
    core_snapshot: false,
    auto_source_snapshot: 'none',
  };
}

export function questInstanceId(q: Pick<Quest, 'id' | 'type' | 'week_start'>): string {
  return q.type === 'weekly' && q.week_start ? `${q.id}:${q.week_start}` : q.id;
}

/** Creates a weekly/side quest and its instance (used by the Quests screen and the planner). */
export async function insertQuest(
  ctx: ActionContext,
  input: z.infer<typeof questDefSchema>,
  /** A fixed id (e.g. the job tracker's `job:<id>:applied`), so two devices make one quest. */
  id?: string,
): Promise<Quest> {
  const { planned_by, carried_over_from, week_start, type, ...rest } = input;
  await checkFields(ctx, rest);
  const today = await appDayOf(ctx.db, ctx.occurredAt);
  const settings = await getSettings(ctx.db);
  const week = type === 'weekly' ? (week_start ?? weekStartOf(today, settings.week_start)) : null;
  const quest: Quest = {
    ...newBase(id, ctx.processedAt),
    ...rest,
    type,
    min_value: rest.target_value,
    week_start: week,
    due_day: type === 'side' ? rest.due_day : null,
    status: 'active',
    planned_by,
    carried_over_from,
    repairs_day: null,
    order: await ctx.db.quests.where('type').equals(type).count(),
  };
  await ctx.db.quests.add(quest);
  const instanceId = questInstanceId(quest);
  await ctx.db.quest_instances.put({
    ...newBase(instanceId, ctx.processedAt),
    source_type: 'quest',
    source_id: quest.id,
    day: week ?? today,
    status: 'pending',
    ...snapshot(quest),
    completed_at: null,
    completed_via: null,
    award_revision: 0,
  });
  ctx.emit({ type: 'QuestChanged', payload: { questId: quest.id, change: 'created' } });
  return quest;
}

export const createQuest = defineAction({
  type: 'quest.create',
  schema: questDefSchema,
  tables: [...TABLES],
  run: (ctx, input) => insertQuest(ctx, input),
});

async function getQuest(ctx: ActionContext, id: string): Promise<Quest> {
  const q = await ctx.db.quests.get(id);
  if (!q || q.deleted_at || q.type === 'recovery') throw new RuleError('Quest not found');
  return q;
}

export const updateQuest = defineAction({
  type: 'quest.update',
  schema: z
    .object({ id: z.string().min(1), changes: fields.partial().strict() })
    .strict()
    .refine((p) => Object.keys(p.changes).length > 0, 'nothing to change'),
  tables: [...TABLES],
  async run(ctx, { id, changes }) {
    const current = await getQuest(ctx, id);
    const next: Quest = { ...current, ...changes, ...touch(ctx.processedAt) };
    next.min_value = next.target_value;
    await checkFields(ctx, next as z.infer<typeof fields>);
    await ctx.db.quests.put(next);
    // The open instance takes the new values only while it isn't done (like habits).
    const instance = await ctx.db.quest_instances.get(questInstanceId(next));
    if (instance && instance.status === 'pending' && instance.deleted_at === null) {
      await ctx.db.quest_instances.put({
        ...instance,
        ...snapshot(next),
        ...touch(ctx.processedAt),
      });
    }
    ctx.emit({ type: 'QuestChanged', payload: { questId: id, change: 'updated' } });
    return next;
  },
});

/** Archive (kept for history) or restore a weekly/side quest. */
export const setQuestArchived = defineAction({
  type: 'quest.archive',
  schema: z.object({ id: z.string().min(1), archived: z.boolean() }).strict(),
  tables: [...TABLES],
  async run(ctx, { id, archived }) {
    const current = await getQuest(ctx, id);
    const instance = await ctx.db.quest_instances.get(questInstanceId(current));
    const done =
      instance?.status !== undefined &&
      instance.status !== 'pending' &&
      instance.status !== 'missed';
    const status: Quest['status'] = archived ? 'archived' : done ? 'done' : 'active';
    await ctx.db.quests.put({ ...current, status, ...touch(ctx.processedAt) });
    if (instance && instance.status === 'pending') {
      await ctx.db.quest_instances.put({
        ...instance,
        deleted_at: archived ? ctx.processedAt : null,
        ...touch(ctx.processedAt),
      });
    }
    ctx.emit({
      type: 'QuestChanged',
      payload: { questId: id, change: archived ? 'archived' : 'restored' },
    });
    return status;
  },
});

import { z } from 'zod';
import type { Dream, GoalType, MainQuest, Milestone } from '@/core/db/types';
import { newBase, touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { statSchema } from './habitSchema';

/**
 * Goal actions (SPEC 5): dreams → main quests → milestones. Goals are paused, finished or
 * archived — never deleted by accident; archive keeps history and can be restored.
 * Every change emits GoalChanged with `meaningful` (SPEC 6.3): create, deadline, scope/target
 * and status changes are meaningful (they will trigger the Goal Planner); title and "why" edits
 * are not.
 */
const GOAL_TABLES = ['dreams', 'main_quests', 'milestones'] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const title = z.string().trim().min(1, 'title is required').max(160);
const why = z.string().trim().max(1000);

const goalStatus = z.enum(['active', 'paused', 'done', 'archived']);
const milestoneStatus = z.enum(['upcoming', 'active', 'paused', 'done', 'archived']);

const sourceSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('body_metric'),
        metric: z.enum(['weight', 'waist']),
        direction: z.enum(['down', 'up']),
        start_value: z.number().positive(),
      })
      .strict(),
    z.object({ kind: z.literal('linked_quests') }).strict(),
    z
      .object({
        kind: z.literal('job_applications'),
        stage: z.enum(['applied', 'interview', 'offer']),
      })
      .strict(),
    z.object({ kind: z.literal('focus_minutes') }).strict(),
  ])
  .nullable();

const milestoneFields = z
  .object({
    title,
    size_weight: z.number().positive().max(100),
    target_type: z.enum(['metric', 'count', 'manual']),
    target_value: z.number().positive().nullable(),
    current_source: sourceSchema,
    estimated_weekly_quests: z.number().int().positive().max(500).nullable(),
    target_date: day.nullable(),
  })
  .strict();

function emitGoal(
  ctx: ActionContext,
  goalType: GoalType,
  goalId: string,
  change: string,
  meaningful: boolean,
) {
  ctx.emit({ type: 'GoalChanged', payload: { goalType, goalId, change, meaningful } });
}

/** True if any of `keys` differs between before and after (JSON compare for objects). */
const changedAny = (before: object, after: object, keys: readonly string[]) =>
  keys.some(
    (k) =>
      JSON.stringify((before as Record<string, unknown>)[k]) !==
      JSON.stringify((after as Record<string, unknown>)[k]),
  );

async function load<T extends { deleted_at: string | null }>(
  get: Promise<T | undefined>,
  what: string,
): Promise<T> {
  const record = await get;
  if (!record || record.deleted_at) throw new RuleError(`${what} not found`);
  return record;
}

// ---- Dreams ----

export const createDream = defineAction({
  type: 'dream.create',
  schema: z.object({ title, why: why.default('') }).strict(),
  tables: [...GOAL_TABLES],
  async run(ctx, p) {
    const dream: Dream = {
      ...newBase(undefined, ctx.processedAt),
      title: p.title,
      why: p.why,
      status: 'active',
      order: await ctx.db.dreams.count(),
      planner_context: {},
    };
    await ctx.db.dreams.add(dream);
    emitGoal(ctx, 'dream', dream.id, 'created', true);
    return dream;
  },
});

export const updateDream = defineAction({
  type: 'dream.update',
  schema: z
    .object({ id: z.string().min(1), changes: z.object({ title, why }).partial().strict() })
    .strict(),
  tables: [...GOAL_TABLES],
  async run(ctx, { id, changes }) {
    const current = await load(ctx.db.dreams.get(id), 'Dream');
    const next: Dream = { ...current, ...changes, ...touch(ctx.processedAt) };
    await ctx.db.dreams.put(next);
    emitGoal(ctx, 'dream', id, 'updated', false);
    return next;
  },
});

export const setDreamStatus = defineAction({
  type: 'dream.setStatus',
  schema: z.object({ id: z.string().min(1), status: goalStatus }).strict(),
  tables: [...GOAL_TABLES],
  async run(ctx, { id, status }) {
    const current = await load(ctx.db.dreams.get(id), 'Dream');
    if (current.status === status) return current;
    const next: Dream = { ...current, status, ...touch(ctx.processedAt) };
    await ctx.db.dreams.put(next);
    emitGoal(ctx, 'dream', id, status, true);
    return next;
  },
});

// ---- Main quests ----

const mainQuestFields = z
  .object({
    dream_id: z.string().min(1),
    title,
    why,
    stat: statSchema,
    target_date: day.nullable(),
  })
  .strict();

export const createMainQuest = defineAction({
  type: 'mainQuest.create',
  schema: mainQuestFields.extend({
    why: why.default(''),
    target_date: day.nullable().default(null),
  }),
  tables: [...GOAL_TABLES],
  async run(ctx, p) {
    await load(ctx.db.dreams.get(p.dream_id), 'Dream');
    const quest: MainQuest = {
      ...newBase(undefined, ctx.processedAt),
      ...p,
      status: 'active',
      order: await ctx.db.main_quests.where('dream_id').equals(p.dream_id).count(),
      planner_context: {},
      last_checkin_day: null,
    };
    await ctx.db.main_quests.add(quest);
    emitGoal(ctx, 'main_quest', quest.id, 'created', true);
    return quest;
  },
});

export const updateMainQuest = defineAction({
  type: 'mainQuest.update',
  schema: z
    .object({ id: z.string().min(1), changes: mainQuestFields.partial().strict() })
    .strict()
    .refine((p) => Object.keys(p.changes).length > 0, 'nothing to change'),
  tables: [...GOAL_TABLES],
  async run(ctx, { id, changes }) {
    const current = await load(ctx.db.main_quests.get(id), 'Main quest');
    if (changes.dream_id) await load(ctx.db.dreams.get(changes.dream_id), 'Dream');
    const next: MainQuest = { ...current, ...changes, ...touch(ctx.processedAt) };
    await ctx.db.main_quests.put(next);
    const meaningful = changedAny(current, next, ['target_date', 'dream_id', 'stat']);
    emitGoal(ctx, 'main_quest', id, 'updated', meaningful);
    return next;
  },
});

export const setMainQuestStatus = defineAction({
  type: 'mainQuest.setStatus',
  schema: z.object({ id: z.string().min(1), status: goalStatus }).strict(),
  tables: [...GOAL_TABLES],
  async run(ctx, { id, status }) {
    const current = await load(ctx.db.main_quests.get(id), 'Main quest');
    if (current.status === status) return current;
    const next: MainQuest = { ...current, status, ...touch(ctx.processedAt) };
    await ctx.db.main_quests.put(next);
    emitGoal(ctx, 'main_quest', id, status, true);
    return next;
  },
});

/** "Is this goal still important?" answered — the 30-day check-in clock restarts. */
export const checkInMainQuest = defineAction({
  type: 'mainQuest.checkIn',
  schema: z.object({ id: z.string().min(1), day }).strict(),
  tables: [...GOAL_TABLES],
  async run(ctx, { id, day: today }) {
    const current = await load(ctx.db.main_quests.get(id), 'Main quest');
    const next: MainQuest = { ...current, last_checkin_day: today, ...touch(ctx.processedAt) };
    await ctx.db.main_quests.put(next);
    emitGoal(ctx, 'main_quest', id, 'checked_in', false);
    return next;
  },
});

// ---- Milestones ----

const MILESTONE_SCOPE = ['target_type', 'target_value', 'current_source', 'size_weight'] as const;

function checkMilestone(m: z.infer<typeof milestoneFields>) {
  if (m.target_type !== 'manual' && m.target_value === null) {
    throw new RuleError('This milestone needs a target value');
  }
  if (m.target_type === 'metric' && m.current_source?.kind !== 'body_metric') {
    throw new RuleError('A metric milestone needs a body measurement to follow');
  }
  if (m.target_type === 'metric' && m.current_source?.kind === 'body_metric') {
    const { direction, start_value } = m.current_source;
    const target = m.target_value ?? 0;
    if (direction === 'down' ? target >= start_value : target <= start_value) {
      throw new RuleError(
        `The target must be ${direction === 'down' ? 'below' : 'above'} the start`,
      );
    }
  }
}

export const createMilestone = defineAction({
  type: 'milestone.create',
  schema: milestoneFields
    .extend({
      main_quest_id: z.string().min(1),
      status: z.enum(['upcoming', 'active']).default('active'),
      size_weight: z.number().positive().max(100).default(1),
      target_type: z.enum(['metric', 'count', 'manual']).default('manual'),
      target_value: z.number().positive().nullable().default(null),
      current_source: sourceSchema.default(null),
      estimated_weekly_quests: z.number().int().positive().max(500).nullable().default(null),
      target_date: day.nullable().default(null),
    })
    .strict(),
  tables: [...GOAL_TABLES],
  async run(ctx, p) {
    await load(ctx.db.main_quests.get(p.main_quest_id), 'Main quest');
    checkMilestone(p);
    const milestone: Milestone = {
      ...newBase(undefined, ctx.processedAt),
      ...p,
      done_at: null,
      planner_context: {},
      order: await ctx.db.milestones.where('main_quest_id').equals(p.main_quest_id).count(),
    };
    await ctx.db.milestones.add(milestone);
    emitGoal(ctx, 'milestone', milestone.id, 'created', true);
    return milestone;
  },
});

export const updateMilestone = defineAction({
  type: 'milestone.update',
  schema: z
    .object({ id: z.string().min(1), changes: milestoneFields.partial().strict() })
    .strict()
    .refine((p) => Object.keys(p.changes).length > 0, 'nothing to change'),
  tables: [...GOAL_TABLES],
  async run(ctx, { id, changes }) {
    const current = await load(ctx.db.milestones.get(id), 'Milestone');
    const next: Milestone = { ...current, ...changes, ...touch(ctx.processedAt) };
    checkMilestone(next);
    await ctx.db.milestones.put(next);
    const meaningful = changedAny(current, next, ['target_date', ...MILESTONE_SCOPE]);
    emitGoal(ctx, 'milestone', id, 'updated', meaningful);
    return next;
  },
});

/**
 * Milestone status. Marking it done is always Rishi's explicit choice (SPEC 6.6: never
 * automatically from a percentage guess) — the UI asks for confirmation.
 */
export const setMilestoneStatus = defineAction({
  type: 'milestone.setStatus',
  schema: z.object({ id: z.string().min(1), status: milestoneStatus }).strict(),
  tables: [...GOAL_TABLES],
  async run(ctx, { id, status }) {
    const current = await load(ctx.db.milestones.get(id), 'Milestone');
    if (current.status === status) return current;
    const next: Milestone = {
      ...current,
      status,
      done_at: status === 'done' ? ctx.processedAt : null,
      ...touch(ctx.processedAt),
    };
    await ctx.db.milestones.put(next);
    emitGoal(ctx, 'milestone', id, status, true);
    if (status === 'done') ctx.emit({ type: 'MilestoneDone', payload: { milestoneId: id } });
    return next;
  },
});

/** Saves interview answers on a goal so the planner never asks the same thing twice (SPEC 6.3). */
export const savePlannerContext = defineAction({
  type: 'goal.saveContext',
  schema: z
    .object({
      goalType: z.enum(['dream', 'main_quest', 'milestone']),
      id: z.string().min(1),
      answers: z.record(z.string(), z.unknown()),
    })
    .strict(),
  tables: [...GOAL_TABLES],
  async run(ctx, { goalType, id, answers }) {
    const merge = <T extends { planner_context: Record<string, unknown> }>(current: T): T => ({
      ...current,
      planner_context: { ...current.planner_context, ...answers },
      ...touch(ctx.processedAt),
    });
    if (goalType === 'dream') {
      await ctx.db.dreams.put(merge(await load(ctx.db.dreams.get(id), 'Dream')));
    } else if (goalType === 'main_quest') {
      await ctx.db.main_quests.put(merge(await load(ctx.db.main_quests.get(id), 'Main quest')));
    } else {
      await ctx.db.milestones.put(merge(await load(ctx.db.milestones.get(id), 'Milestone')));
    }
    emitGoal(ctx, goalType, id, 'context', false);
  },
});

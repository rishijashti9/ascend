import { z } from 'zod';
import { GAME } from '@/config/game';
import type { AscendDB } from '@/core/db/db';
import type { DayString, Habit, Weekday } from '@/core/db/types';
import {
  buildHabitInstance,
  habitInstanceId,
  isScheduled,
  refreshedSnapshot,
} from '@/core/engine/instances';
import { weekdayOf } from '@/core/time';
import { refreshDayRecord } from '../days';
import { appDayOf } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import {
  createHabitSchema,
  HABIT_DEFAULTS,
  habitProblems,
  updateHabitSchema,
  type HabitFields,
} from './habitSchema';

/**
 * Habit actions (SPEC principle 8): everything is editable, history is protected.
 * Edits apply from today forward; past instances keep their snapshots.
 */

function check(fields: HabitFields): void {
  const problems = habitProblems(fields);
  if (problems.length) throw new RuleError(problems.join('; '));
}

async function activeCoreCount(db: AscendDB, exceptId?: string): Promise<number> {
  const active = await db.habits.where('status').equals('active').toArray();
  return active.filter((h) => h.core && h.deleted_at === null && h.id !== exceptId).length;
}

async function getHabit(db: AscendDB, id: string): Promise<Habit> {
  const habit = await db.habits.get(id);
  if (!habit || habit.deleted_at) throw new RuleError(`Habit ${id} not found`);
  return habit;
}

/**
 * Today's instance for one habit. A habit added today appears today but is not core
 * for today: core status always applies from tomorrow (DECISIONS: core changes).
 */
async function addTodayInstance(ctx: ActionContext, habit: Habit, today: DayString): Promise<void> {
  if (!isScheduled(habit, today)) return;
  const id = habitInstanceId(habit.id, today);
  const existing = await ctx.db.quest_instances.get(id);
  if (existing && existing.deleted_at === null) return;
  const instance = buildHabitInstance(habit, today, newBase(id, ctx.processedAt));
  await ctx.db.quest_instances.put({ ...instance, core_snapshot: false });
  await refreshDayRecord(ctx.db, today, ctx.processedAt);
}

/** Removes today's instance if it is still pending (pause/archive/delete apply from today). */
async function removeTodayPending(
  ctx: ActionContext,
  habitId: string,
  today: DayString,
): Promise<void> {
  const instance = await ctx.db.quest_instances.get(habitInstanceId(habitId, today));
  if (instance && instance.status === 'pending' && instance.deleted_at === null) {
    await ctx.db.quest_instances.put({
      ...instance,
      deleted_at: ctx.processedAt,
      ...touch(ctx.processedAt),
    });
    await refreshDayRecord(ctx.db, today, ctx.processedAt);
  }
}

/** Instances for today exist only once the day has started (rollover or first action). */
async function todayStarted(ctx: ActionContext, today: DayString): Promise<boolean> {
  return (await ctx.db.quest_instances.where('day').equals(today).count()) > 0;
}

const HABIT_TABLES = ['habits', 'quest_instances', 'settings', 'days'] as const;

/**
 * Validates and stores a new habit (shared by habit.create and onboarding). Today's
 * instance is added only if today has already started.
 */
export async function insertHabit(
  ctx: ActionContext,
  payload: z.infer<typeof createHabitSchema>,
): Promise<Habit> {
  const { id = crypto.randomUUID(), ...rest } = payload;
  const fields: HabitFields = {
    ...HABIT_DEFAULTS,
    ...rest,
    schedule: [...(rest.schedule ?? HABIT_DEFAULTS.schedule)],
    skill_ids: [...(rest.skill_ids ?? [])],
  };
  check(fields);
  if (fields.core && (await activeCoreCount(ctx.db)) >= GAME.maxCoreHabits) {
    throw new RuleError(`At most ${GAME.maxCoreHabits} core quests`);
  }
  const order = await ctx.db.habits.count();
  const habit: Habit = {
    ...newBase(id, ctx.processedAt),
    ...fields,
    schedule: fields.schedule as Weekday[],
    status: 'active',
    order,
  };
  await ctx.db.habits.add(habit);
  const today = await appDayOf(ctx.db, ctx.occurredAt);
  if (await todayStarted(ctx, today)) await addTodayInstance(ctx, habit, today);
  ctx.emit({ type: 'HabitChanged', payload: { habitId: habit.id, change: 'created' } });
  return habit;
}

export const createHabit = defineAction({
  type: 'habit.create',
  schema: createHabitSchema,
  tables: [...HABIT_TABLES],
  run: insertHabit,
});

export const updateHabit = defineAction({
  type: 'habit.update',
  schema: updateHabitSchema,
  tables: [...HABIT_TABLES],
  async run(ctx, { id, changes }) {
    const current = await getHabit(ctx.db, id);
    const merged: Habit = {
      ...current,
      ...changes,
      schedule: (changes.schedule ?? current.schedule) as Weekday[],
      ...touch(ctx.processedAt),
    };
    check(merged);
    if (merged.core && !current.core && merged.status === 'active') {
      if ((await activeCoreCount(ctx.db, id)) >= GAME.maxCoreHabits) {
        throw new RuleError(`At most ${GAME.maxCoreHabits} core quests`);
      }
    }
    await ctx.db.habits.put(merged);

    const today = await appDayOf(ctx.db, ctx.occurredAt);
    const instance = await ctx.db.quest_instances.get(habitInstanceId(id, today));
    if (instance && instance.deleted_at === null) {
      if (!merged.schedule.includes(weekdayOf(today))) {
        await removeTodayPending(ctx, id, today); // no longer scheduled today
      } else {
        const snapshot = refreshedSnapshot(instance, merged);
        if (snapshot)
          await ctx.db.quest_instances.put({ ...instance, ...snapshot, ...touch(ctx.processedAt) });
      }
    } else if (await todayStarted(ctx, today)) {
      await addTodayInstance(ctx, merged, today); // newly scheduled for today
    }
    ctx.emit({ type: 'HabitChanged', payload: { habitId: id, change: 'updated' } });
    return merged;
  },
});

const idSchema = z.object({ id: z.string().min(1) }).strict();

function statusAction(type: string, status: Habit['status'], change: 'paused' | 'archived') {
  return defineAction({
    type,
    schema: idSchema,
    tables: [...HABIT_TABLES],
    async run(ctx, { id }) {
      const habit = await getHabit(ctx.db, id);
      const next: Habit = { ...habit, status, ...touch(ctx.processedAt) };
      await ctx.db.habits.put(next);
      await removeTodayPending(ctx, id, await appDayOf(ctx.db, ctx.occurredAt));
      ctx.emit({ type: 'HabitChanged', payload: { habitId: id, change } });
      return next;
    },
  });
}

export const pauseHabit = statusAction('habit.pause', 'paused', 'paused');
export const archiveHabit = statusAction('habit.archive', 'archived', 'archived');

export const restoreHabit = defineAction({
  type: 'habit.restore',
  schema: idSchema,
  tables: [...HABIT_TABLES],
  async run(ctx, { id }) {
    const habit = await getHabit(ctx.db, id);
    // If the core limit is already reached, it comes back as a normal (non-core) quest.
    const keepCore = habit.core && (await activeCoreCount(ctx.db, id)) < GAME.maxCoreHabits;
    const next: Habit = { ...habit, status: 'active', core: keepCore, ...touch(ctx.processedAt) };
    await ctx.db.habits.put(next);
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    if (await todayStarted(ctx, today)) await addTodayInstance(ctx, next, today);
    ctx.emit({ type: 'HabitChanged', payload: { habitId: id, change: 'restored' } });
    return next;
  },
});

export const reorderHabits = defineAction({
  type: 'habit.reorder',
  schema: z.object({ ids: z.array(z.string().min(1)).min(1) }).strict(),
  tables: ['habits'],
  async run(ctx, { ids }) {
    for (const [order, id] of ids.entries()) {
      const habit = await getHabit(ctx.db, id);
      if (habit.order !== order)
        await ctx.db.habits.put({ ...habit, order, ...touch(ctx.processedAt) });
    }
    return ids.length;
  },
});

/**
 * Permanent delete — only behind a clear confirmation in the UI (`confirm: true`).
 * The habit is soft-deleted (`deleted_at`) so past days keep their history; it no longer
 * appears anywhere and can't be restored from the app.
 */
export const deleteHabit = defineAction({
  type: 'habit.delete',
  schema: z.object({ id: z.string().min(1), confirm: z.literal(true) }).strict(),
  tables: [...HABIT_TABLES],
  async run(ctx, { id }) {
    const habit = await getHabit(ctx.db, id);
    await ctx.db.habits.put({
      ...habit,
      status: 'archived',
      deleted_at: ctx.processedAt,
      ...touch(ctx.processedAt),
    });
    await removeTodayPending(ctx, id, await appDayOf(ctx.db, ctx.occurredAt));
    ctx.emit({ type: 'HabitChanged', payload: { habitId: id, change: 'archived' } });
    return true;
  },
});

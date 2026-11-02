import { z } from 'zod';
import type { FocusSession } from '@/core/db/types';
import { countedMinutes, elapsedMinutes, unlinkedFocusXp } from '@/core/engine/focus';
import { isRecoveryId } from '@/core/engine/instances';
import { appDayOf } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { statSchema } from './habitSchema';
import { QUEST_TABLES } from './questCommon';
import { logProgress } from './quests';

/**
 * Focus sessions (SPEC 4.6, 4.8). One session runs at a time. Linked to a quest, its minutes
 * go into that quest through the normal progress path (so the quest gives the XP, never
 * twice); unlinked, a completed session earns 1 XP per minute for its stat.
 */
const TABLES = [...QUEST_TABLES, 'focus_sessions'] as const;

async function runningSession(ctx: ActionContext): Promise<FocusSession | undefined> {
  return (await ctx.db.focus_sessions.toArray()).find(
    (s) => s.ended_at === null && s.deleted_at === null,
  );
}

export const startFocus = defineAction({
  type: 'focus.start',
  schema: z
    .object({
      quest_instance_id: z.string().min(1).nullable().default(null),
      stat: statSchema.nullable().default(null),
      planned_min: z.number().int().min(5).max(180),
      break_min: z.number().int().min(0).max(60).default(5),
      skill_ids: z.array(z.string().min(1)).max(20).default([]),
    })
    .strict()
    .refine(
      (p) => (p.quest_instance_id === null) !== (p.stat === null),
      'link a quest or choose a stat',
    ),
  tables: [...TABLES],
  async run(ctx, p) {
    if (await runningSession(ctx)) throw new RuleError('A focus session is already running');
    if (p.quest_instance_id) {
      const inst = await ctx.db.quest_instances.get(p.quest_instance_id);
      if (!inst || inst.deleted_at) throw new RuleError('That quest no longer exists');
      if (inst.measure_snapshot !== 'minutes' || isRecoveryId(inst.id)) {
        throw new RuleError('Only quests measured in minutes can take focus time');
      }
      if (inst.status === 'missed') throw new RuleError('That quest’s day is over');
    }
    const session: FocusSession = {
      ...newBase(undefined, ctx.processedAt),
      quest_instance_id: p.quest_instance_id,
      stat: p.stat,
      skill_ids: p.skill_ids,
      planned_min: p.planned_min,
      break_min: p.break_min,
      actual_min: 0,
      completed: false,
      face_down: false,
      started_at: ctx.occurredAt,
      ended_at: null,
      day: await appDayOf(ctx.db, ctx.occurredAt),
    };
    await ctx.db.focus_sessions.add(session);
    ctx.emit({ type: 'SessionStarted', payload: { sessionId: session.id } });
    return session;
  },
});

export const finishFocus = defineAction({
  type: 'focus.finish',
  schema: z
    .object({
      id: z.string().min(1),
      /** True when the timer ran to the end; false = ended early (abandoned). */
      completed: z.boolean(),
      /** "Phone face-down" honesty check answered yes. */
      face_down: z.boolean().default(false),
      /** Abandoned only: minutes Rishi says really counted (e.g. 0 after leaving the app). */
      counted_min: z.number().int().min(0).max(180).nullable().default(null),
    })
    .strict(),
  tables: [...TABLES],
  async run(ctx, { id, completed, face_down, counted_min }) {
    const session = await ctx.db.focus_sessions.get(id);
    if (!session || session.deleted_at) throw new RuleError('That session no longer exists');
    if (session.ended_at) throw new RuleError('That session has already ended');
    const endMs = Date.parse(ctx.occurredAt);
    // A minute of slack for clocks; finishing "completed" earlier than that isn't honest.
    if (completed && elapsedMinutes(session.started_at, endMs) < session.planned_min - 1) {
      throw new RuleError('The session isn’t finished yet');
    }
    const measured = countedMinutes({
      startedAt: session.started_at,
      endMs,
      plannedMin: session.planned_min,
      completed,
    });
    // Rishi can only lower an abandoned session's minutes, never raise them.
    const minutes = !completed && counted_min !== null ? Math.min(counted_min, measured) : measured;
    const ended: FocusSession = {
      ...session,
      ended_at: ctx.occurredAt,
      actual_min: minutes,
      completed,
      face_down,
      ...touch(ctx.processedAt),
    };
    await ctx.db.focus_sessions.put(ended);

    if (session.quest_instance_id && minutes > 0) {
      const inst = await ctx.db.quest_instances.get(session.quest_instance_id);
      if (inst && inst.deleted_at === null && inst.status !== 'missed') {
        // Counts for the day the session started (a session past midnight stays with its day).
        await logProgress.run(
          { ...ctx, occurredAt: session.started_at, source: 'focus' },
          logProgress.schema.parse({
            instanceId: inst.id,
            amount: minutes,
            source: 'focus',
            refId: session.id,
          }),
        );
      }
    } else if (!session.quest_instance_id && session.stat && completed && minutes > 0) {
      await ctx.addXpEvent({
        day: session.day,
        occurred_at: session.started_at,
        stat: session.stat,
        base_amount: unlinkedFocusXp(minutes),
        reason: 'focus',
        idempotency_key: `focus:${session.id}`,
        ref_type: 'focus_session',
        ref_id: session.id,
      });
    }
    ctx.emit({ type: 'SessionFinished', payload: { sessionId: id, day: session.day, completed } });
    return ended;
  },
});

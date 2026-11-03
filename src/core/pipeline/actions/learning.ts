import { z } from 'zod';
import { writeLearning } from '@/core/adaptive/record';
import { addDays } from '@/core/time';
import { appDayOf } from '../helpers';
import { defineAction } from '../registry';

/**
 * Recording what the Adaptive System learns from (SPEC 6.7 A). Answers given through other
 * actions (applying a plan, "Not now", …) are recorded inside those actions; these cover the
 * rest: a card being shown, answers that have no action of their own, app opens, and marking
 * suggestions nobody answered as ignored.
 */
const type = z
  .string()
  .regex(/^[a-z0-9_]{1,40}$/)
  .describe('suggestion type');
const ref = z.string().min(1).max(200).nullable();
/** Numbers only — never text. */
const values = z.record(z.string().regex(/^[a-z_]{1,30}$/), z.number().finite()).optional();

/** A suggestion card was shown. Once per type + ref + day (re-renders don't count again). */
export const recordShown = defineAction({
  type: 'learning.shown',
  schema: z.object({ type, ref_id: ref }).strict(),
  tables: ['learning_events', 'settings'],
  async run(ctx, p) {
    const day = await appDayOf(ctx.db, ctx.occurredAt);
    const id = `shown:${p.type}:${p.ref_id ?? '-'}:${day}`;
    if (await ctx.db.learning_events.get(id)) return false;
    await writeLearning(ctx, { id, kind: 'suggestion', outcome: 'shown', ...p });
    return true;
  },
});

/** An answer to a suggestion that has no action of its own (e.g. a nudge option). */
export const recordAnswer = defineAction({
  type: 'learning.answer',
  schema: z
    .object({ type, ref_id: ref, outcome: z.enum(['accepted', 'edited', 'rejected']), values })
    .strict(),
  tables: ['learning_events', 'settings'],
  async run(ctx, p) {
    await writeLearning(ctx, { kind: 'suggestion', ...p });
    ctx.emit({ type: 'LearningChanged', payload: { kind: 'answer' } });
    return true;
  },
});

/**
 * "Reset learning" (SPEC 6.7 A): models ignore everything before today for one daily quest,
 * or for everything (`habit_id` null). Nothing is deleted — the history stays.
 */
export const resetLearning = defineAction({
  type: 'learning.reset',
  schema: z.object({ habit_id: z.string().min(1).nullable() }).strict(),
  tables: ['learning_events', 'settings'],
  async run(ctx, { habit_id }) {
    await writeLearning(ctx, { kind: 'reset', type: 'reset', ref_id: habit_id });
    ctx.emit({ type: 'LearningChanged', payload: { kind: 'reset' } });
    return true;
  },
});

/**
 * "Clear" one item on "What the System knows about you": that item starts learning afresh
 * from today (e.g. `focus_window`, `capacity`, `welcome:plan_weekly`).
 */
export const forgetItem = defineAction({
  type: 'learning.forget',
  schema: z.object({ key: z.string().regex(/^[a-z0-9_:]{1,60}$/) }).strict(),
  tables: ['learning_events', 'settings'],
  async run(ctx, { key }) {
    await writeLearning(ctx, { kind: 'forget', type: key });
    ctx.emit({ type: 'LearningChanged', payload: { kind: 'forget' } });
    return true;
  },
});

/** Minimum gap between two recorded app opens (a quick switch away and back is one open). */
export const APP_OPEN_GAP_MIN = 10;

/** The app was opened or came back to the front. */
export const recordAppOpen = defineAction({
  type: 'learning.appOpen',
  schema: z.object({}).strict(),
  tables: ['learning_events', 'settings'],
  async run(ctx) {
    const day = await appDayOf(ctx.db, ctx.occurredAt);
    const since = Date.parse(ctx.occurredAt) - APP_OPEN_GAP_MIN * 60_000;
    const recent = await ctx.db.learning_events
      .where('day')
      .between(addDays(day, -1), day, true, true)
      .filter((e) => e.kind === 'app_open' && Date.parse(e.at) > since)
      .count();
    if (recent > 0) return false;
    await writeLearning(ctx, { kind: 'app_open', type: 'open' });
    return true;
  },
});

/** How far back unanswered suggestions are looked for (older days were handled already). */
const LOOKBACK_DAYS = 14;

/**
 * Suggestions shown on a past day and not answered that day become `ignored` (once each,
 * id `ignored:<shown id>`). Runs after the day rollover.
 */
export const closeSuggestions = defineAction({
  type: 'learning.closeDays',
  schema: z.object({}).strict(),
  tables: ['learning_events', 'settings'],
  async run(ctx) {
    const today = await appDayOf(ctx.db, ctx.processedAt);
    const events = await ctx.db.learning_events
      .where('day')
      .between(addDays(today, -LOOKBACK_DAYS), today, true, false)
      .filter((e) => e.kind === 'suggestion' && !e.deleted_at)
      .toArray();
    const answered = new Set(
      events
        .filter((e) => e.outcome !== 'shown' && e.outcome !== 'ignored')
        .map((e) => `${e.type}|${e.ref_id ?? '-'}|${e.day}`),
    );
    const done = new Set(events.filter((e) => e.outcome === 'ignored').map((e) => e.id));
    let written = 0;
    for (const e of events) {
      if (e.outcome !== 'shown' || done.has(`ignored:${e.id}`)) continue;
      if (answered.has(`${e.type}|${e.ref_id ?? '-'}|${e.day}`)) continue;
      await writeLearning(ctx, {
        id: `ignored:${e.id}`,
        kind: 'suggestion',
        type: e.type,
        outcome: 'ignored',
        ref_id: e.ref_id,
        at: e.at,
      });
      written++;
    }
    return written;
  },
});

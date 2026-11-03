import { z } from 'zod';
import { writeLearning } from '@/core/adaptive/record';
import type { AscendDB } from '@/core/db/db';
import { isDone, progressValue } from '@/core/engine/progress';
import { addDays, weekStartOf, type Weekday } from '@/core/time';
import { appDayOf, getSettings } from '../helpers';
import { touch } from '../records';
import { defineAction } from '../registry';

/**
 * Notification events and planned-vs-actual weeks for the Adaptive System (SPEC 6.7 A).
 * Numbers only. Ids are deterministic, so two devices record each fact once.
 */
const kind = z.enum(['wake', 'briefing', 'reminder', 'winddown', 'welcome_back', 'job_followup']);
const key = z.string().min(1).max(120);

/**
 * The scheduler's current plan: future reminders are `scheduled` (id `notif:scheduled:<key>`);
 * a future one that left the plan (e.g. the check-in was done first) is removed again.
 */
export const notificationsPlanned = defineAction({
  type: 'learning.notificationsPlanned',
  schema: z
    .object({ items: z.array(z.object({ key, kind, at: z.string().min(10) }).strict()).max(200) })
    .strict(),
  tables: ['learning_events', 'settings'],
  async run(ctx, { items }) {
    const now = ctx.processedAt;
    const planned = new Set<string>();
    for (const n of items) {
      const id = `notif:scheduled:${n.key}`;
      planned.add(id);
      const old = await ctx.db.learning_events.get(id);
      if (old && !old.deleted_at && old.at === n.at) continue;
      await writeLearning(ctx, {
        id,
        kind: 'notification',
        type: n.kind,
        outcome: 'scheduled',
        ref_id: n.key,
        at: n.at,
      });
    }
    const today = await appDayOf(ctx.db, now);
    const future = await ctx.db.learning_events
      .where('day')
      .aboveOrEqual(today)
      .filter((e) => e.kind === 'notification' && e.outcome === 'scheduled' && !e.deleted_at)
      .toArray();
    for (const e of future) {
      if (e.at > now && !planned.has(e.id)) {
        await ctx.db.learning_events.put({ ...e, deleted_at: now, ...touch(now) });
      }
    }
    return items.length;
  },
});

/** A reminder was shown (where the platform reports it) or tapped. */
export const notificationEvent = defineAction({
  type: 'learning.notification',
  schema: z.object({ key, kind, outcome: z.enum(['delivered', 'opened']) }).strict(),
  tables: ['learning_events', 'settings'],
  async run(ctx, { key: k, kind: type, outcome }) {
    const id = `notif:${outcome}:${k}`;
    if (await ctx.db.learning_events.get(id)) return false;
    const due = await ctx.db.learning_events.get(`notif:scheduled:${k}`);
    const late = due
      ? Math.round((Date.parse(ctx.occurredAt) - Date.parse(due.at)) / 60_000)
      : null;
    await writeLearning(ctx, {
      id,
      kind: 'notification',
      type,
      outcome,
      ref_id: k,
      values: late === null ? null : { minutes_from_due: Math.max(0, late) },
    });
    return true;
  },
});

/** Weeks looked back on (older ones were written already, or predate this version). */
const WEEKS_BACK = 3;
/** An opened reminder followed by a completion within this many minutes counts as acted on. */
export const ACTION_WINDOW_MIN = 180;

/**
 * Bookkeeping after the rollover: (1) each closed week gets its planned-vs-actual numbers
 * (id `week:<week start>`); (2) opened reminders get `minutes_to_action` — minutes until the
 * next quest completion that day (-1 when nothing was completed within 3 hours).
 */
export const closeWeeks = defineAction({
  type: 'learning.closeWeeks',
  schema: z.object({}).strict(),
  tables: [
    'learning_events',
    'settings',
    'profile',
    'quest_instances',
    'progress_entries',
    'quests',
    'days',
  ],
  async run(ctx) {
    const settings = await getSettings(ctx.db);
    const today = await appDayOf(ctx.db, ctx.processedAt);
    const start = (await ctx.db.profile.get('profile'))?.start_day;
    if (!start) return 0;
    const thisWeek = weekStartOf(today, settings.week_start as Weekday);
    let written = 0;
    for (let w = 1; w <= WEEKS_BACK; w++) {
      const ws = addDays(thisWeek, -7 * w);
      if (addDays(ws, 6) < start) break;
      const id = `week:${ws}`;
      if (await ctx.db.learning_events.get(id)) continue;
      await writeLearning(ctx, {
        id,
        kind: 'week',
        type: 'planned_actual',
        ref_id: ws,
        at: ctx.processedAt,
        values: await weekNumbers(ctx.db, ws),
      });
      written++;
    }
    await fillMinutesToAction(ctx.db, today, ctx.processedAt);
    return written;
  },
});

/** Planned vs actual for one week (daily quests, their minutes, weekly quests, days). */
export async function weekNumbers(db: AscendDB, ws: string): Promise<Record<string, number>> {
  const end = addDays(ws, 6);
  const instances = (
    await db.quest_instances.where('day').between(ws, end, true, true).toArray()
  ).filter((i) => !i.deleted_at && i.source_type === 'habit' && i.status !== 'skipped');
  const minuteIds = instances.filter((i) => i.measure_snapshot === 'minutes').map((i) => i.id);
  const entries = minuteIds.length
    ? await db.progress_entries.where('quest_instance_id').anyOf(minuteIds).toArray()
    : [];
  let minutesDone = 0;
  for (const id of minuteIds) {
    minutesDone += progressValue(
      'minutes',
      entries.filter((e) => e.quest_instance_id === id),
    );
  }
  const weekly = (await db.quests.where('week_start').equals(ws).toArray()).filter(
    (q) => !q.deleted_at && q.type === 'weekly',
  );
  const days = (await db.days.where('id').between(ws, end, true, true).toArray()).filter(
    (d) => !d.neutral,
  );
  return {
    daily_planned: instances.length,
    daily_done: instances.filter((i) => isDone(i.status)).length,
    daily_full: instances.filter((i) => i.status === 'done_full').length,
    minutes_planned: instances
      .filter((i) => i.measure_snapshot === 'minutes')
      .reduce((s, i) => s + (i.target_snapshot ?? 0), 0),
    minutes_done: Math.round(minutesDone),
    weekly_planned: weekly.length,
    weekly_done: weekly.filter((q) => q.status === 'done').length,
    active_days: days.filter((d) => d.active).length,
    low_energy_days: days.filter((d) => d.low_energy).length,
  };
}

async function fillMinutesToAction(db: AscendDB, today: string, now: string) {
  const opened = await db.learning_events
    .where('day')
    .between(addDays(today, -7), today, true, true)
    .filter((e) => e.kind === 'notification' && e.outcome === 'opened' && !e.deleted_at)
    .toArray();
  for (const e of opened) {
    if (e.values && 'minutes_to_action' in e.values) continue;
    const openMs = Date.parse(e.at);
    const windowEnd = openMs + ACTION_WINDOW_MIN * 60_000;
    if (Date.parse(now) < windowEnd) continue; // still waiting
    const done = (await db.quest_instances.where('day').equals(e.day).toArray())
      .map((i) => (i.completed_at ? Date.parse(i.completed_at) : NaN))
      .filter((t) => t >= openMs - 60_000 && t <= windowEnd)
      .sort((a, b) => a - b)[0];
    await db.learning_events.put({
      ...e,
      values: {
        ...(e.values ?? {}),
        minutes_to_action:
          done === undefined ? -1 : Math.max(0, Math.round((done - openMs) / 60_000)),
      },
      ...touch(now),
    });
  }
}

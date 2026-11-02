import { z } from 'zod';
import { habitInstanceId, refreshedSnapshot } from '@/core/engine/instances';
import { parseTime } from '@/core/time';
import { wakeWording } from '@/data/starter';
import { appDayOf } from '../helpers';
import { touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import type { Settings } from '@/core/db/types';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM');

/** Fields Rishi can change in Settings. All optional: send only what changed. */
export const settingsPatchSchema = z
  .object({
    day_start_hour: z.number().int().min(0).max(6),
    week_start: z.union([z.literal(0), z.literal(1)]),
    wake_time: hhmm,
    wake_window_min: z.number().int().min(5).max(120),
    wake_late_cutoff: hhmm,
    theme: z.enum(['system', 'light', 'dark']),
    notifications: z
      .object({
        wake_checkin: z.boolean(),
        morning_briefing: z.boolean(),
        quest_reminders: z.boolean(),
        evening_winddown: z.boolean(),
        evening_time: hhmm,
        job_followups: z.boolean(),
        browser_notifications: z.boolean(),
      })
      .partial()
      .strict(),
    quiet_hours: z.object({ start: hhmm, end: hhmm }).strict().nullable(),
    focus_presets: z
      .array(
        z
          .object({
            work_min: z.number().int().min(5).max(180),
            break_min: z.number().int().min(0).max(60),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    ai_enabled: z.boolean(),
    ai_monthly_budget: z.number().min(0).max(1000),
    auto_plan: z.boolean(),
    health_connect_enabled: z.boolean(),
    photo_sync: z.boolean(),
    jobs_enabled: z.boolean(),
  })
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, 'nothing to change');

const WAKE_FIELDS = ['wake_time', 'wake_window_min', 'wake_late_cutoff'] as const;

/**
 * The wake-up quest's wording ("I'm up" by 5:20 AM / late check-in by 7:00 AM) follows the
 * wake settings. Today's quest takes the new wording only while it's still pending.
 */
async function rewordWakeHabits(ctx: ActionContext, settings: Settings): Promise<void> {
  const wording = wakeWording(
    settings.wake_time,
    settings.wake_window_min,
    settings.wake_late_cutoff,
  );
  const today = await appDayOf(ctx.db, ctx.occurredAt);
  const habits = (await ctx.db.habits.toArray()).filter(
    (h) => h.auto_source === 'wake_checkin' && h.deleted_at === null,
  );
  for (const habit of habits) {
    const next = { ...habit, ...wording, ...touch(ctx.processedAt) };
    await ctx.db.habits.put(next);
    const instance = await ctx.db.quest_instances.get(habitInstanceId(habit.id, today));
    const snapshot = instance && refreshedSnapshot(instance, next);
    if (instance && snapshot) {
      await ctx.db.quest_instances.put({ ...instance, ...snapshot, ...touch(ctx.processedAt) });
    }
    ctx.emit({ type: 'HabitChanged', payload: { habitId: habit.id, change: 'updated' } });
  }
}

export const updateSettings = defineAction({
  type: 'settings.update',
  schema: settingsPatchSchema,
  tables: ['settings', 'habits', 'quest_instances'],
  async run(ctx, patch) {
    const current = await ctx.db.settings.get('settings');
    if (!current) throw new Error('Settings record is missing');
    const next = {
      ...current,
      ...patch,
      notifications: { ...current.notifications, ...patch.notifications },
      ...touch(ctx.processedAt),
    };
    const onTimeEnd = parseTime(next.wake_time) + next.wake_window_min;
    if (parseTime(next.wake_late_cutoff) <= onTimeEnd) {
      throw new RuleError('The late cutoff must be after the on-time window ends');
    }
    await ctx.db.settings.put(next);
    if (WAKE_FIELDS.some((k) => k in patch)) await rewordWakeHabits(ctx, next);
    ctx.emit({ type: 'SettingsChanged', payload: { changed: Object.keys(patch) } });
    return next;
  },
});

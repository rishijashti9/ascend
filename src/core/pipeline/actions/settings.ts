import { z } from 'zod';
import { touch } from '../records';
import { defineAction } from '../registry';

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

export const updateSettings = defineAction({
  type: 'settings.update',
  schema: settingsPatchSchema,
  tables: ['settings'],
  async run(ctx, patch) {
    const current = await ctx.db.settings.get('settings');
    if (!current) throw new Error('Settings record is missing');
    const next = {
      ...current,
      ...patch,
      notifications: { ...current.notifications, ...patch.notifications },
      ...touch(ctx.processedAt),
    };
    await ctx.db.settings.put(next);
    ctx.emit({ type: 'SettingsChanged', payload: { changed: Object.keys(patch) } });
    return next;
  },
});

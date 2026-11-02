import { z } from 'zod';
import type { Dream, MainQuest, Profile } from '@/core/db/types';
import { buildHabitInstance, isScheduled } from '@/core/engine/instances';
import { addDays } from '@/core/time';
import { refreshDayRecord } from '../days';
import { appDayOf, getSettings } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError } from '../registry';
import { createHabitSchema, statSchema } from './habitSchema';
import { insertHabit } from './habits';

/**
 * Onboarding "Awakening" (SPEC 7.1): saves everything in one transaction, so a half-finished
 * onboarding never leaves partial data. Day 1 is always neutral (DECISIONS 10): today's
 * quests can be done for XP, but nothing is core until tomorrow, so Day 1 can't be "missed".
 */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM');

export const onboardingSchema = z
  .object({
    name: z.string().trim().min(1, 'name is required').max(40),
    wake_time: hhmm,
    theme: z.enum(['system', 'light', 'dark']),
    /** "Start tomorrow" is offered after 6 PM: Day 1 = tomorrow and tonight is neutral. */
    start: z.enum(['today', 'tomorrow']),
    habits: z
      .array(createHabitSchema.omit({ id: true }))
      .min(1, 'pick at least one quest')
      .max(30),
    dream: z
      .object({ title: z.string().trim().min(1).max(160), why: z.string().trim().max(500) })
      .strict()
      .nullable(),
    main_quests: z
      .array(z.object({ title: z.string().trim().min(1).max(120), stat: statSchema }).strict())
      .max(10),
  })
  .strict()
  .refine((p) => p.dream !== null || p.main_quests.length === 0, 'main quests need a dream');

export type OnboardingPayload = z.input<typeof onboardingSchema>;

export const completeOnboarding = defineAction({
  type: 'onboarding.complete',
  schema: onboardingSchema,
  tables: ['profile', 'settings', 'habits', 'quest_instances', 'days', 'dreams', 'main_quests'],
  async run(ctx, payload) {
    const { db, processedAt } = ctx;
    const existing = await db.profile.get('profile');
    if (existing?.onboarded_at) throw new RuleError('ASCEND is already set up');

    const today = await appDayOf(db, processedAt);
    const startDay = payload.start === 'today' ? today : addDays(today, 1);

    const settings = await getSettings(db);
    await db.settings.put({
      ...settings,
      wake_time: payload.wake_time,
      theme: payload.theme,
      ...touch(processedAt),
    });
    ctx.emit({ type: 'SettingsChanged', payload: { changed: ['wake_time', 'theme'] } });

    const profile: Profile = {
      ...(existing ?? newBase('profile', processedAt)),
      ...touch(processedAt),
      name: payload.name,
      start_day: startDay,
      onboarded_at: processedAt,
      display_title: existing?.display_title ?? null,
    };
    await db.profile.put(profile);

    const habits = [];
    for (const fields of payload.habits) habits.push(await insertHabit(ctx, fields));

    if (startDay === today) {
      for (const habit of habits) {
        if (!isScheduled(habit, today)) continue;
        const instance = buildHabitInstance(habit, today, newBase(undefined, processedAt));
        // Day 1 is neutral: core status starts tomorrow.
        await db.quest_instances.put({ ...instance, core_snapshot: false });
      }
      await refreshDayRecord(db, today, processedAt);
      ctx.emit({ type: 'DayChanged', payload: { day: today } });
    }

    if (payload.dream) {
      const dream: Dream = {
        ...newBase(undefined, processedAt),
        title: payload.dream.title,
        why: payload.dream.why,
        status: 'active',
        order: 0,
        planner_context: {},
      };
      await db.dreams.add(dream);
      for (const [order, mq] of payload.main_quests.entries()) {
        const quest: MainQuest = {
          ...newBase(undefined, processedAt),
          dream_id: dream.id,
          title: mq.title,
          why: '',
          stat: mq.stat,
          target_date: null,
          status: 'active',
          order,
          planner_context: {},
          last_checkin_day: null,
        };
        await db.main_quests.add(quest);
      }
    }
    return profile;
  },
});

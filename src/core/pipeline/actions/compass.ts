import { z } from 'zod';
import { INTEREST_ITEMS, STRENGTHS, VALUES } from '@/data/compass/discovery';
import { touch } from '../records';
import { defineAction, RuleError } from '../registry';

/**
 * Growth Compass answers (SPEC 6.7 B), kept on the profile so they sync with the user's own
 * account. Never sent to any online AI.
 */
const itemIds = INTEREST_ITEMS.map((i) => i.id) as [string, ...string[]];
const strengthIds = STRENGTHS.map((s) => s.id) as [string, ...string[]];
const valueIds = VALUES.map((v) => v.id) as [string, ...string[]];

export const saveDiscovery = defineAction({
  type: 'compass.saveDiscovery',
  schema: z
    .object({
      interests: z.record(z.enum(itemIds), z.union([z.literal(0), z.literal(1), z.literal(2)])),
      strengths: z.array(z.enum(strengthIds)).max(3),
      values: z.array(z.enum(valueIds)).max(3),
    })
    .strict(),
  tables: ['profile'],
  async run(ctx, answers) {
    const profile = await ctx.db.profile.get('profile');
    if (!profile) throw new RuleError('Finish setting up first');
    await ctx.db.profile.put({
      ...profile,
      compass: { ...profile.compass, discovery: { ...answers, at: ctx.processedAt } },
      ...touch(ctx.processedAt),
    });
    ctx.emit({ type: 'ProfileChanged', payload: { changed: ['compass'] } });
    return true;
  },
});

export const setTargetCareer = defineAction({
  type: 'compass.setTarget',
  schema: z
    .object({
      career_id: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .nullable(),
    })
    .strict(),
  tables: ['profile'],
  async run(ctx, { career_id }) {
    const profile = await ctx.db.profile.get('profile');
    if (!profile) throw new RuleError('Finish setting up first');
    await ctx.db.profile.put({
      ...profile,
      compass: { ...profile.compass, target_career: career_id },
      ...touch(ctx.processedAt),
    });
    ctx.emit({ type: 'ProfileChanged', payload: { changed: ['compass'] } });
    return career_id;
  },
});

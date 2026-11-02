import { z } from 'zod';
import type { Review } from '@/core/db/types';
import { appDayOf } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError } from '../registry';

/**
 * Reviews (SPEC 7.7): the 1-minute daily check-in (energy, mood, one win, one lesson), and the
 * weekly / monthly / yearly reviews. One record per type and period (`review:<type>:<period>`),
 * so saving again updates it and two devices never make two.
 */
const text = z.string().trim().max(1000);
const scale = z.number().int().min(1).max(5);

export const reviewId = (type: string, period: string) => `review:${type}:${period}`;

const PERIOD: Record<Review['type'], RegExp> = {
  daily: /^\d{4}-\d{2}-\d{2}$/,
  weekly: /^\d{4}-\d{2}-\d{2}$/,
  monthly: /^\d{4}-\d{2}$/,
  yearly: /^\d{4}$/,
};

export const saveReview = defineAction({
  type: 'review.save',
  schema: z
    .object({
      type: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
      period: z.string().min(4).max(10),
      energy: scale.nullable().optional(),
      mood: scale.nullable().optional(),
      win: text.nullable().optional(),
      lesson: text.nullable().optional(),
      text: z.string().trim().max(5000).nullable().optional(),
      answers: z.record(z.string(), z.string().max(2000)).optional(),
    })
    .strict(),
  tables: ['reviews', 'settings'],
  async run(ctx, { type, period, ...fields }) {
    if (!PERIOD[type].test(period)) throw new RuleError('That period isn’t valid');
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    // A period can be reviewed once it has started (today's check-in, this week, …), never ahead.
    if (period > today.slice(0, period.length))
      throw new RuleError('That period hasn’t started yet');

    const id = reviewId(type, period);
    const existing = await ctx.db.reviews.get(id);
    const base: Review = existing ?? {
      ...newBase(id, ctx.processedAt),
      type,
      period,
      energy: null,
      mood: null,
      win: null,
      lesson: null,
      text: null,
      answers: {},
    };
    // Only fields that were sent change; an empty text clears it.
    const changes: Partial<Review> = {};
    if (fields.energy !== undefined) changes.energy = fields.energy;
    if (fields.mood !== undefined) changes.mood = fields.mood;
    for (const key of ['win', 'lesson', 'text'] as const) {
      const v = fields[key];
      if (v !== undefined) changes[key] = v?.trim() || null;
    }
    if (fields.answers) changes.answers = { ...base.answers, ...fields.answers };
    const next: Review = { ...base, ...changes, deleted_at: null, ...touch(ctx.processedAt) };
    await ctx.db.reviews.put(next);
    ctx.emit({ type: 'ReviewSaved', payload: { reviewType: type, period } });
    return next;
  },
});

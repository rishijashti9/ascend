import { z } from 'zod';
import { visibleAchievement } from '@/core/achievements/titles';
import { touch } from '../records';
import { defineAction, RuleError } from '../registry';
import { achievementId } from './achievements';

/** Choose the title to display (an unlocked achievement), or none (SPEC 4.7). */
export const setTitle = defineAction({
  type: 'profile.setTitle',
  schema: z.object({ key: z.string().min(1).max(100).nullable() }).strict(),
  tables: ['profile', 'achievements_unlocked'],
  async run(ctx, { key }) {
    const profile = await ctx.db.profile.get('profile');
    if (!profile) throw new RuleError('Finish setting up first');
    if (key !== null) {
      const unlocked = await ctx.db.achievements_unlocked.get(achievementId(key));
      if (!visibleAchievement(key) || !unlocked || unlocked.deleted_at !== null) {
        throw new RuleError('That title isn’t unlocked yet');
      }
    }
    await ctx.db.profile.put({ ...profile, display_title: key, ...touch(ctx.processedAt) });
    ctx.emit({ type: 'ProfileChanged', payload: { changed: ['display_title'] } });
    return key;
  },
});

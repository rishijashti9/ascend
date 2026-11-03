import { z } from 'zod';
import { isAvailable } from '@/config/features';
import { FACT_TABLES, readFacts } from '@/core/achievements/facts';
import type { AchievementUnlocked } from '@/core/db/types';
import { achievementProgress } from '@/core/engine/achievements';
import { ACHIEVEMENTS } from '@/data/achievements';
import { newBase } from '../records';
import { defineAction } from '../registry';

/** One record per achievement, same id on every device, so sync never makes two. */
export const achievementId = (key: string) => `ach:${key}`;

/**
 * Unlocks every visible achievement whose goal is met and isn't unlocked yet (SPEC 4.7).
 * Unlocks are permanent: the date sticks, even if a number later goes down (e.g. an Undo).
 * Achievements give no XP — XP only comes from quests, focus and the Daily Clear (SPEC 4.8).
 */
export const checkAchievements = defineAction({
  type: 'achievements.check',
  schema: z.object({}).strict(),
  tables: [...FACT_TABLES, 'achievements_unlocked', 'settings'],
  async run(ctx) {
    const facts = await readFacts(ctx.db, ctx.occurredAt);
    const have = new Set(
      (await ctx.db.achievements_unlocked.toArray()).map((a) => a.achievement_key),
    );
    const unlocked: string[] = [];
    const settings = await ctx.db.settings.get('settings');
    for (const def of ACHIEVEMENTS) {
      if (have.has(def.key) || (def.feature && !isAvailable(def.feature, settings))) continue;
      if (!achievementProgress(def, facts).met) continue;
      const record: AchievementUnlocked = {
        ...newBase(achievementId(def.key), ctx.processedAt),
        achievement_key: def.key,
        unlocked_at: ctx.processedAt,
      };
      await ctx.db.achievements_unlocked.put(record);
      unlocked.push(def.key);
      ctx.emit({ type: 'AchievementUnlocked', payload: { key: def.key } });
    }
    return unlocked;
  },
});

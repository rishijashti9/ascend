import { z } from 'zod';
import { GAME, type Rank } from '@/config/game';
import { mergeSeen, newMoment, type Moment, type Seen } from '@/core/engine/moments';
import { defineAction } from '../registry';

export const SEEN_KEY = 'moments_seen';

const RANKS = GAME.ranks.map((r) => r.rank) as [Rank, ...Rank[]];
const level = z.number().int().min(1).max(10_000);

/**
 * Records the player's current level / rank / stat levels and returns the moment to show, if
 * anything went above what was already celebrated. The first time (or `silent`, after an
 * import or reset) it only remembers the current state — old levels are never celebrated.
 * Emits LevelUp / RankUp for anything new.
 */
export const recordMoments = defineAction({
  type: 'moments.record',
  schema: z
    .object({
      level,
      rank: z.enum(RANKS),
      stats: z.object({ STR: level, INT: level, WIL: level }).strict(),
      silent: z.boolean().default(false),
    })
    .strict(),
  tables: ['meta'],
  async run(ctx, { silent, ...current }): Promise<Moment | null> {
    const stored = (await ctx.db.meta.get(SEEN_KEY))?.value as Seen | undefined;
    const moment = stored && !silent ? newMoment(stored, current) : null;
    const next = stored ? mergeSeen(stored, current) : current;
    if (!stored || JSON.stringify(next) !== JSON.stringify(stored)) {
      await ctx.db.meta.put({ id: SEEN_KEY, value: next });
    }
    if (moment?.level) ctx.emit({ type: 'LevelUp', payload: { level: moment.level, stat: null } });
    for (const s of moment?.stats ?? [])
      ctx.emit({ type: 'LevelUp', payload: { level: s.level, stat: s.stat } });
    if (moment?.rank) ctx.emit({ type: 'RankUp', payload: { rank: moment.rank } });
    return moment;
  },
});

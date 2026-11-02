import { GAME, type Rank } from '@/config/game';
import type { Stat } from '@/core/db/types';
import { STATS } from '@/core/db/types';

/**
 * Level-up / rank-up moments (SPEC 8), pure. `Seen` is the highest of everything already
 * celebrated; a moment happens only when something goes above it, so a level lost to an Undo
 * and earned again is never celebrated twice, and a reload never replays a moment.
 */
export interface Seen {
  level: number;
  rank: Rank;
  stats: Record<Stat, number>;
}

export interface Moment {
  /** The new overall level, if it went up. */
  level: number | null;
  /** The new rank, if it went up. */
  rank: Rank | null;
  /** Stats whose level went up. */
  stats: { stat: Stat; level: number }[];
}

const rankIndex = (r: Rank) => GAME.ranks.findIndex((x) => x.rank === r);

/** Everything seen so far combined with now (never lower). */
export function mergeSeen(seen: Seen, current: Seen): Seen {
  return {
    level: Math.max(seen.level, current.level),
    rank: rankIndex(current.rank) > rankIndex(seen.rank) ? current.rank : seen.rank,
    stats: Object.fromEntries(
      STATS.map((s) => [s, Math.max(seen.stats[s], current.stats[s])]),
    ) as Record<Stat, number>,
  };
}

export function newMoment(seen: Seen, current: Seen): Moment | null {
  const moment: Moment = {
    level: current.level > seen.level ? current.level : null,
    rank: rankIndex(current.rank) > rankIndex(seen.rank) ? current.rank : null,
    stats: STATS.filter((s) => current.stats[s] > seen.stats[s]).map((s) => ({
      stat: s,
      level: current.stats[s],
    })),
  };
  return moment.level === null && moment.rank === null && moment.stats.length === 0 ? null : moment;
}

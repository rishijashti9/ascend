/**
 * Every game-balance number in one place (SPEC 4.3, 4.4, 4.8; DECISIONS.md).
 * Change values here, then run `npm run simulate` to see the 5-year effect.
 */
import type { Difficulty } from '@/core/db/types';

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export const GAME = {
  /** Base XP by quest difficulty. */
  xpByDifficulty: { easy: 10, normal: 25, hard: 50, epic: 100 } satisfies Record<
    Difficulty,
    number
  >,
  /** Minimum version = 50% of base. */
  minFraction: 0.5,
  /** Late wake-up check-in = 50% of base. */
  lateFraction: 0.5,
  /** Recovery quests are always this difficulty. */
  recoveryDifficulty: 'easy' as Difficulty,

  /** XP beyond `threshold` in one day is multiplied by `factor`. */
  softCap: { threshold: 300, factor: 0.5 },
  /** +2% per streak day (streak at the start of the day), capped at +30%. */
  streakBonus: { perDay: 0.02, max: 0.3 },
  /** Player-only bonus; no streak bonus, not counted toward the soft cap (DECISIONS 4a). */
  dailyClearBonus: 20,

  /** XP to reach level n from n−1 = round(base · n^exponent). Tuned by scripts/simulate.ts. */
  levelCurve: { base: 80, exponent: 1.15 },

  /** Ranks need BOTH a level and a number of active days. Ranks never go down. */
  ranks: [
    { rank: 'E', minLevel: 1, minActiveDays: 0 },
    { rank: 'D', minLevel: 5, minActiveDays: 14 },
    { rank: 'C', minLevel: 15, minActiveDays: 90 },
    { rank: 'B', minLevel: 25, minActiveDays: 250 },
    { rank: 'A', minLevel: 40, minActiveDays: 600 },
    { rank: 'S', minLevel: 55, minActiveDays: 1150 },
  ] as const satisfies readonly { rank: Rank; minLevel: number; minActiveDays: number }[],

  /** 1 shield per 7 consecutive active days (shielded/repaired days pause the count). */
  shields: { earnEvery: 7, max: 3 },
  /** A Recovery quest can repair a missed day at most once per rolling 7 days. */
  repairWindowDays: 7,

  /** Focus sessions not linked to a quest: XP per focused minute to the chosen stat. */
  unlinkedFocusXpPerMinute: 1,

  /** Maximum number of core habits. */
  maxCoreHabits: 3,
} as const;

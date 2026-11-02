import { GAME, type Rank } from '@/config/game';

/**
 * Level curve (pure). Player level and each stat level use the same curve,
 * applied to total XP and to that stat's XP respectively (SPEC 4.8).
 */

export interface LevelCurve {
  base: number;
  exponent: number;
}

/** XP needed to go from level n−1 to level n. Level 1 needs nothing. */
export function xpToReach(level: number, curve: LevelCurve = GAME.levelCurve): number {
  if (level <= 1) return 0;
  return Math.round(curve.base * Math.pow(level, curve.exponent));
}

// Cumulative XP thresholds, grown on demand. cumulative[n] = total XP needed to be level n.
const cumulative: number[] = [0, 0];

function ensureCumulative(level: number): void {
  for (let n = cumulative.length; n <= level; n++) {
    cumulative[n] = (cumulative[n - 1] ?? 0) + xpToReach(n);
  }
}

/** Total XP needed to be at `level` (level 1 = 0). */
export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  ensureCumulative(level);
  return cumulative[level] ?? 0;
}

export interface LevelInfo {
  level: number;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP needed from the current level to the next one. */
  xpForNext: number;
  /** 0–1 progress toward the next level (for the XP bar). */
  progress: number;
  totalXp: number;
}

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (totalXpForLevel(level + 1) <= xp) level++;
  const floor = totalXpForLevel(level);
  const xpForNext = xpToReach(level + 1);
  const xpIntoLevel = xp - floor;
  return { level, xpIntoLevel, xpForNext, progress: xpIntoLevel / xpForNext, totalXp: xp };
}

/** Highest rank whose level AND active-day requirements are both met. */
export function rankFor(level: number, activeDays: number): Rank {
  let best: Rank = 'E';
  for (const r of GAME.ranks) {
    if (level >= r.minLevel && activeDays >= r.minActiveDays) best = r.rank;
  }
  return best;
}

/** What the next rank needs, or null at S. */
export function nextRank(
  current: Rank,
): { rank: Rank; minLevel: number; minActiveDays: number } | null {
  const i = GAME.ranks.findIndex((r) => r.rank === current);
  return GAME.ranks[i + 1] ?? null;
}

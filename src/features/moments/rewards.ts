import { nextRank } from '@/core/engine/levels';
import type { Moment } from '@/core/engine/moments';
import type { ProgressState } from '@/core/engine/progressState';
import { STAT_META } from '@/ui/statMeta';

export interface RewardTile {
  key: string;
  title: string;
  line: string;
}

/**
 * The 2×2 reward grid on a level-up / rank-up moment (Phase 12) — always real numbers: what
 * just went up first (rank, level, stats), then where you stand (next rank, streak, XP to the
 * next level, total XP), up to four tiles.
 */
export function momentRewards(
  moment: Moment,
  progress: Pick<ProgressState, 'level' | 'rank' | 'streak'> | null,
): RewardTile[] {
  const tiles: RewardTile[] = [];
  if (moment.rank) tiles.push({ key: 'rank', title: `Rank ${moment.rank}`, line: 'New rank' });
  if (moment.rank && moment.level)
    tiles.push({ key: 'level', title: `Level ${moment.level}`, line: 'New level' });
  for (const { stat, level } of moment.stats) {
    tiles.push({
      key: `stat-${stat}`,
      title: `${stat} → ${level}`,
      line: `${STAT_META[stat].label} reached level ${level}`,
    });
  }
  if (progress) {
    const next = nextRank(moment.rank ?? progress.rank);
    if (next)
      tiles.push({
        key: 'next-rank',
        title: `Rank ${next.rank} next`,
        line: `Level ${next.minLevel} · ${next.minActiveDays} active days`,
      });
    const streak = progress.streak.streak;
    if (streak > 0)
      tiles.push({
        key: 'streak',
        title: `${streak}-day streak`,
        line: streak === 1 ? 'Day one of many' : 'Keep showing up',
      });
    const { level, xpForNext, xpIntoLevel, totalXp } = progress.level;
    tiles.push({
      key: 'to-next',
      title: `${(xpForNext - xpIntoLevel).toLocaleString()} XP`,
      line: `To level ${level + 1}`,
    });
    tiles.push({ key: 'total', title: `${totalXp.toLocaleString()} XP`, line: 'Earned in total' });
  }
  return tiles.slice(0, 4);
}

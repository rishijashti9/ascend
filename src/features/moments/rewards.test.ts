import { describe, expect, it } from 'vitest';
import type { ProgressState } from '@/core/engine/progressState';
import { momentRewards } from './rewards';

const progress = {
  level: { level: 5, xpIntoLevel: 40, xpForNext: 300, progress: 0.13, totalXp: 1840 },
  rank: 'D',
  streak: { streak: 9 },
} as unknown as ProgressState;

describe('momentRewards', () => {
  it('puts what went up first, then where you stand, four at most', () => {
    const tiles = momentRewards(
      { level: 5, rank: 'D', stats: [{ stat: 'WIL', level: 3 }] },
      progress,
    );
    expect(tiles.map((t) => t.title)).toEqual(['Rank D', 'Level 5', 'WIL → 3', 'Rank C next']);
    expect(tiles[2]?.line).toBe('Willpower reached level 3');
  });

  it('fills a plain level-up with real numbers', () => {
    const tiles = momentRewards({ level: 5, rank: null, stats: [] }, progress);
    expect(tiles.map((t) => t.key)).toEqual(['next-rank', 'streak', 'to-next', 'total']);
    expect(tiles[1]?.title).toBe('9-day streak');
    expect(tiles[2]).toMatchObject({ title: '260 XP', line: 'To level 6' });
  });

  it('shows only what went up when progress is not loaded', () => {
    expect(momentRewards({ level: 2, rank: null, stats: [] }, null)).toEqual([]);
  });
});

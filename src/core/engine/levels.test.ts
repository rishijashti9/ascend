import { GAME } from '@/config/game';
import { levelFromXp, nextRank, rankFor, totalXpForLevel, xpToReach } from './levels';

describe('level curve round(80 · n^1.15)', () => {
  it('XP to reach a level', () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(2)).toBe(178);
    expect(xpToReach(3)).toBe(283);
    expect(xpToReach(10)).toBe(1130);
    expect(xpToReach(100)).toBe(15962);
  });

  it('cumulative XP thresholds', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(178);
    expect(totalXpForLevel(3)).toBe(461);
    expect(totalXpForLevel(10)).toBe(5747);
    expect(totalXpForLevel(55)).toBe(209263);
  });

  it('accepts a custom curve (for tuning)', () => {
    expect(xpToReach(2, { base: 50, exponent: 1.4 })).toBe(Math.round(50 * 2 ** 1.4));
  });
});

describe('levelFromXp', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelFromXp(0)).toEqual({
      level: 1,
      xpIntoLevel: 0,
      xpForNext: 178,
      progress: 0,
      totalXp: 0,
    });
  });

  it('levels up exactly at the threshold', () => {
    expect(levelFromXp(177).level).toBe(1);
    expect(levelFromXp(178).level).toBe(2);
    expect(levelFromXp(178).xpIntoLevel).toBe(0);
    expect(levelFromXp(460).level).toBe(2);
    expect(levelFromXp(461).level).toBe(3);
  });

  it('reports progress toward the next level', () => {
    const info = levelFromXp(178 + 100);
    expect(info.level).toBe(2);
    expect(info.xpIntoLevel).toBe(100);
    expect(info.xpForNext).toBe(283);
    expect(info.progress).toBeCloseTo(100 / 283);
  });

  it('handles large totals (10+ years) quickly and treats negatives as 0', () => {
    const start = performance.now();
    const info = levelFromXp(2_000_000);
    expect(info.level).toBeGreaterThan(100);
    expect(performance.now() - start).toBeLessThan(50);
    expect(levelFromXp(-5).level).toBe(1);
  });
});

describe('ranks', () => {
  it('needs both level and active days', () => {
    expect(rankFor(1, 0)).toBe('E');
    expect(rankFor(5, 13)).toBe('E');
    expect(rankFor(4, 100)).toBe('E');
    expect(rankFor(5, 14)).toBe('D');
    expect(rankFor(30, 100)).toBe('C'); // level enough for B, days not
    expect(rankFor(25, 250)).toBe('B');
    expect(rankFor(40, 600)).toBe('A');
    expect(rankFor(54, 2000)).toBe('A');
    expect(rankFor(55, 1150)).toBe('S');
  });

  it('thresholds increase strictly', () => {
    for (let i = 1; i < GAME.ranks.length; i++) {
      const prev = GAME.ranks[i - 1];
      const cur = GAME.ranks[i];
      expect(cur?.minLevel).toBeGreaterThan(prev?.minLevel ?? Infinity);
      expect(cur?.minActiveDays).toBeGreaterThan(prev?.minActiveDays ?? Infinity);
    }
  });

  it('describes the next rank', () => {
    expect(nextRank('E')).toEqual({ rank: 'D', minLevel: 5, minActiveDays: 14 });
    expect(nextRank('S')).toBeNull();
  });
});

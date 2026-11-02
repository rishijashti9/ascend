import { heatmapYear, weakestStat, weeklyXp } from './profile';

const summary = (xp: number, active = xp > 0, dailyClear = false) => ({ xp, active, dailyClear });

describe('weeklyXp', () => {
  it('sums XP into the last N weeks, current week last, nothing after today', () => {
    const perDay = {
      '2026-10-19': summary(100), // Mon, 3 weeks ago (outside 3 weeks)
      '2026-10-26': summary(40),
      '2026-11-01': summary(10), // Sunday of that week
      '2026-11-02': summary(5),
      '2026-11-03': summary(999), // after today
    };
    expect(weeklyXp(perDay, '2026-11-02', 1, 3)).toEqual([
      { day: '2026-10-19', value: 100 },
      { day: '2026-10-26', value: 50 },
      { day: '2026-11-02', value: 5 },
    ]);
    expect(weeklyXp(perDay, '2026-11-02', 1, 2)[0]).toEqual({ day: '2026-10-26', value: 50 });
  });
});

describe('heatmapYear', () => {
  it('lays out a year as week columns with padding, levels and outside days', () => {
    const cols = heatmapYear(
      { '2026-01-01': summary(30, true, true), '2026-01-02': summary(10) },
      2026,
      1,
      '2026-11-02',
      '2026-01-01',
    );
    // 2026-01-01 is a Thursday: the first Monday column is 2025-12-29.
    expect(cols[0]?.slice(0, 3)).toEqual([null, null, null]);
    expect(cols[0]?.[3]).toEqual({ day: '2026-01-01', level: 2, xp: 30, outside: false });
    expect(cols[0]?.[4]).toMatchObject({ day: '2026-01-02', level: 1 });
    expect(cols[0]?.[5]).toMatchObject({ day: '2026-01-03', level: 0 });
    expect(cols).toHaveLength(53);
    expect(cols.at(-1)?.[3]).toMatchObject({ day: '2026-12-31', outside: true });
    expect(cols.at(-1)?.[4]).toBeNull();
    expect(cols.flat().filter(Boolean)).toHaveLength(365);
  });
  it('respects a Sunday week start', () => {
    const cols = heatmapYear({}, 2026, 0, '2026-11-02', '2026-01-01');
    expect(cols[0]?.[4]).toMatchObject({ day: '2026-01-01' }); // Thursday is row 4 from Sunday
  });
});

describe('weakestStat', () => {
  it('nudges only when the weakest trails by 2+ levels', () => {
    expect(weakestStat({ STR: 3, INT: 5, WIL: 4 })).toBe('STR');
    expect(weakestStat({ STR: 4, INT: 5, WIL: 4 })).toBeNull();
    expect(weakestStat({ STR: 1, INT: 1, WIL: 1 })).toBeNull();
  });
});

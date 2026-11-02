import { periodOf, periodRange, periodStats, shiftPeriod } from './periodStats';
import type { DaySummary } from './progressState';

const day = (over: Partial<DaySummary> = {}): DaySummary => ({
  xp: 0,
  active: false,
  dailyClear: false,
  streak: 0,
  questsDone: 0,
  ...over,
});

describe('period helpers', () => {
  it('finds a month or year range, including February and leap years', () => {
    expect(periodRange('monthly', '2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodRange('monthly', '2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(periodRange('monthly', '2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(periodRange('yearly', '2026')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
  it('names and shifts periods across year boundaries', () => {
    expect(periodOf('monthly', '2026-11-02')).toBe('2026-11');
    expect(periodOf('yearly', '2026-11-02')).toBe('2026');
    expect(shiftPeriod('monthly', '2026-01', -1)).toBe('2025-12');
    expect(shiftPeriod('monthly', '2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('yearly', '2026', -1)).toBe('2025');
  });
});

describe('periodStats', () => {
  it('sums the month, counts only passed days since the start, and averages check-ins', () => {
    const perDay = {
      '2026-10-31': day({ xp: 5000, active: true, streak: 9 }), // before the month
      '2026-11-01': day({ xp: 100, active: true, dailyClear: true, streak: 10, questsDone: 4 }),
      '2026-11-02': day({ xp: 50, active: true, streak: 11, questsDone: 2 }),
      '2026-11-03': day({ xp: 0, streak: 11 }),
      '2026-12-01': day({ xp: 999, active: true, streak: 12 }), // after
    };
    const s = periodStats({
      from: '2026-11-01',
      to: '2026-11-30',
      today: '2026-11-03',
      startDay: '2026-10-20',
      perDay,
      sessions: [
        { day: '2026-11-02', actual_min: 25 },
        { day: '2026-10-30', actual_min: 50 },
      ],
      milestoneDays: ['2026-11-02', '2026-10-01'],
      checkIns: [
        { type: 'daily', period: '2026-11-01', energy: 4, mood: 3 },
        { type: 'daily', period: '2026-11-02', energy: 3, mood: null },
        { type: 'weekly', period: '2026-11-02', energy: null, mood: null },
      ],
    });
    expect(s).toMatchObject({
      daysSoFar: 3,
      activeDays: 2,
      dailyClears: 1,
      xp: 150,
      focusMin: 25,
      questsDone: 6,
      milestonesDone: 1,
      bestStreak: 11,
      checkIns: 2,
      avgEnergy: 3.5,
      avgMood: 3,
    });
    expect(s.levelEnd).toBeGreaterThanOrEqual(s.levelStart);
  });

  it('starts counting on the first day of play and handles an empty period', () => {
    const s = periodStats({
      from: '2026-01-01',
      to: '2026-12-31',
      today: '2026-11-05',
      startDay: '2026-11-02',
      perDay: {},
      sessions: [],
      milestoneDays: [],
      checkIns: [],
    });
    expect(s).toMatchObject({
      daysSoFar: 4,
      xp: 0,
      bestStreak: 0,
      avgEnergy: null,
      levelStart: 1,
      levelEnd: 1,
    });
    const future = periodStats({
      from: '2027-01-01',
      to: '2027-12-31',
      today: '2026-11-05',
      startDay: '2026-11-02',
      perDay: {},
      sessions: [],
      milestoneDays: [],
      checkIns: [],
    });
    expect(future.daysSoFar).toBe(0);
  });
});

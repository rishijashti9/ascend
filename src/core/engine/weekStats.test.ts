import { weekStats } from './weekStats';

describe('weekStats', () => {
  it('sums the week so far: active days, Daily Clears, XP, focus, weekly quests', () => {
    const s = weekStats({
      weekStart: '2026-11-02',
      today: '2026-11-05',
      perDay: {
        '2026-11-01': { xp: 999, active: true, dailyClear: true }, // last week
        '2026-11-02': { xp: 120, active: true, dailyClear: true },
        '2026-11-03': { xp: 60, active: true, dailyClear: false },
        '2026-11-04': { xp: 0, active: false, dailyClear: false },
      },
      sessions: [
        { day: '2026-11-03', actual_min: 50 },
        { day: '2026-10-30', actual_min: 25 },
      ],
      weeklyQuests: [
        { week_start: '2026-11-02', status: 'done' },
        { week_start: '2026-11-02', status: 'active' },
        { week_start: '2026-11-02', status: 'archived' },
        { week_start: '2026-10-26', status: 'done' },
      ],
    });
    expect(s).toEqual({
      daysSoFar: 4,
      activeDays: 2,
      dailyClears: 1,
      xp: 180,
      focusMin: 50,
      weeklyDone: 1,
      weeklyTotal: 2,
    });
  });
});

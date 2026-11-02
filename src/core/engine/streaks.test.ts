import { addDays } from '@/core/time';
import { computeHabitStreaks, computeStreaks, repairAllowed, type StreakDayInput } from './streaks';

const START = '2026-01-01';

/**
 * Days from a compact pattern, one char per day starting at START:
 * A active · M missed · N neutral · O today (open, not active yet).
 * Lower case = the same plus a Recovery quest completed that day (r, m, n, o).
 */
function days(pattern: string): StreakDayInput[] {
  return [...pattern].map((c, i) => ({
    day: addDays(START, i),
    active: c === 'A' || c === 'r',
    neutral: c === 'N' || c === 'n',
    open: c === 'O' || c === 'o',
    recovered: c === 'r' || c === 'm' || c === 'n' || c === 'o',
  }));
}

const run = (pattern: string) => computeStreaks(days(pattern));
const after = (pattern: string) => run(pattern).days.map((d) => d.streak_after);

describe('computeStreaks — active and neutral days', () => {
  it('counts consecutive active days; streak_at_start is the previous day’s streak', () => {
    const r = run('AAA');
    expect(r.days.map((d) => d.streak_at_start)).toEqual([0, 1, 2]);
    expect(after('AAA')).toEqual([1, 2, 3]);
    expect(r.summary).toMatchObject({ streak: 3, longest: 3, daysActive: 3 });
  });

  it('neutral days neither break nor extend the streak, and do not add to days active', () => {
    expect(after('AANA')).toEqual([1, 2, 2, 3]);
    expect(run('AANA').summary.daysActive).toBe(3);
  });

  it('a miss with no shield breaks the streak; days active never resets', () => {
    const r = run('AAMAA');
    expect(r.days.map((d) => d.streak_after)).toEqual([1, 2, 0, 1, 2]);
    expect(r.summary).toMatchObject({ streak: 2, longest: 2, daysActive: 4 });
  });

  it('a miss with no streak to protect changes nothing', () => {
    expect(run('MMA').days.every((d) => !d.shield_used && !d.repaired)).toBe(true);
    expect(run('MMA').summary.repairable).toBeNull();
  });
});

describe('computeStreaks — shields', () => {
  it('earns one shield per 7 consecutive active days, max 3', () => {
    expect(run('A'.repeat(6)).summary.shields).toBe(0);
    expect(run('A'.repeat(7)).summary.shields).toBe(1);
    expect(run('A'.repeat(21)).summary.shields).toBe(3);
    expect(run('A'.repeat(35)).summary.shields).toBe(3);
  });

  it('a missed day uses a shield: streak kept but not increased', () => {
    const r = run('AAAAAAAMA');
    const missed = r.days[7];
    expect(missed).toMatchObject({ shield_used: true, shields_after: 0, streak_after: 7 });
    expect(r.summary).toMatchObject({ streak: 8, daysActive: 8, shields: 0 });
  });

  it('a shielded day pauses the 7-day counter instead of resetting it', () => {
    // 7 active (shield) · miss (uses it) · 6 active → the counter is at 13 active days: shield at 14.
    expect(run('AAAAAAAM' + 'A'.repeat(6)).summary.shields).toBe(0);
    expect(run('AAAAAAAM' + 'A'.repeat(7)).summary.shields).toBe(1);
  });

  it('long absence: shields cover missed days in order, then the streak breaks', () => {
    const r = run('A'.repeat(21) + 'MMMM');
    expect(r.days.slice(21).map((d) => d.shield_used)).toEqual([true, true, true, false]);
    expect(r.days.slice(21).map((d) => d.streak_after)).toEqual([21, 21, 21, 0]);
    expect(r.summary.repairable).toEqual({ day: addDays(START, 24), streak: 21 });
  });
});

describe('computeStreaks — Recovery quest repair', () => {
  it('Recovery quest on the return day repairs the miss: streak kept, not increased', () => {
    const r = run('AAAMr');
    expect(r.days[3]).toMatchObject({ repaired: true, streak_after: 3 });
    expect(r.days[4]).toMatchObject({ streak_at_start: 3, streak_after: 4 });
    expect(r.summary).toMatchObject({ streak: 4, daysActive: 4, lastRepairDay: addDays(START, 4) });
  });

  it('without the Recovery quest the return day starts from 0 (XP bonus never taken back)', () => {
    const r = run('AAAMA');
    expect(r.days[4]).toMatchObject({ streak_at_start: 0, streak_after: 1 });
    expect(r.summary.repairable).toBeNull();
  });

  it('a repaired day pauses the shield counter', () => {
    // 5 active · repaired miss · 1 active → 6 active days counted, no shield yet; 2 more → shield.
    expect(run('AAAAAMr').summary.shields).toBe(0);
    expect(run('AAAAAMrA').summary.shields).toBe(1);
  });

  it('neutral days between the miss and the return day are allowed and get the streak back', () => {
    const r = run('AAMNr');
    expect(r.days.map((d) => d.streak_after)).toEqual([1, 2, 2, 2, 3]);
    expect(r.days[3]?.streak_at_start).toBe(2);
  });

  it('two unprotected misses: the Recovery quest gives a fresh start, no repair', () => {
    const r = run('AAMMr');
    expect(r.days.some((d) => d.repaired)).toBe(false);
    expect(r.summary.streak).toBe(1);
  });

  it('after shields run out, exactly one unprotected miss can still be repaired', () => {
    const r = run('A'.repeat(7) + 'MMr');
    expect(r.days[7]?.shield_used).toBe(true);
    expect(r.days[8]?.repaired).toBe(true);
    expect(r.summary.streak).toBe(8);
  });

  it('a recovered day that is itself missed repairs the earlier miss, then misses again', () => {
    const r = run('AAMm');
    expect(r.days[2]?.repaired).toBe(true);
    expect(r.days[3]).toMatchObject({ repaired: false, streak_after: 0 });
    expect(r.summary.repairable).toEqual({ day: addDays(START, 3), streak: 2 });
  });

  it('at most one repair per rolling 7 days', () => {
    // Repair with a Recovery quest on index 2; the next Recovery 6 days later is refused…
    // (neutral days keep the shield counter below 7, so the second miss isn't shielded)
    expect(run('AMrAANNMr').days[7]?.repaired).toBe(false);
    // …and 7 days later is allowed.
    expect(run('AMrAANNNMr').days[8]?.repaired).toBe(true);
  });

  it('today (open) never counts as a miss and keeps a repair available', () => {
    const r = run('AAMO');
    expect(r.days[3]).toMatchObject({ streak_at_start: 0, streak_after: 0, shield_used: false });
    expect(r.summary.repairable).toEqual({ day: addDays(START, 2), streak: 2 });
    expect(run('AAAAAAAO').days[7]?.shield_used).toBe(false);
  });

  it('completing the Recovery quest today repairs at once', () => {
    const r = run('AAMo');
    expect(r.days[2]?.repaired).toBe(true);
    expect(r.days[3]).toMatchObject({ streak_at_start: 2, streak_after: 2 });
    expect(r.summary).toMatchObject({ streak: 2, repairable: null });
  });

  it('a late-arriving action that makes an old day active gives the on-time result', () => {
    const late = days('AAMA');
    const fixed = late.map((d, i) => (i === 2 ? { ...d, active: true } : d));
    expect(computeStreaks(fixed)).toEqual(run('AAAA'));
  });
});

describe('repairAllowed', () => {
  it('uses a rolling 7-day window', () => {
    expect(repairAllowed(null, '2026-03-01')).toBe(true);
    expect(repairAllowed('2026-03-01', '2026-03-07')).toBe(false);
    expect(repairAllowed('2026-03-01', '2026-03-08')).toBe(true);
  });
});

describe('computeHabitStreaks', () => {
  const inst = (habitId: string, i: number, done: boolean, core = false) => ({
    habitId,
    day: addDays(START, i),
    done,
    core,
  });

  it('counts only scheduled days (no instance = not scheduled)', () => {
    // Mon/Wed/Fri habit done each time → streak 3 even though days in between have no instance.
    const s = computeHabitStreaks(
      [inst('h', 0, true), inst('h', 2, true), inst('h', 4, true)],
      [],
      null,
    );
    expect(s.get('h')).toEqual({ streak: 3, longest: 3 });
  });

  it('a missed scheduled day resets the habit streak; longest is kept', () => {
    const list = [inst('h', 0, true), inst('h', 1, true), inst('h', 2, false), inst('h', 3, true)];
    expect(computeHabitStreaks(list, [], null).get('h')).toEqual({ streak: 1, longest: 2 });
  });

  it('core habits are protected on shielded or repaired days; other habits are not', () => {
    const list = [
      inst('core', 0, true, true),
      inst('core', 1, false, true),
      inst('core', 2, true, true),
      inst('other', 0, true),
      inst('other', 1, false),
      inst('other', 2, true),
    ];
    for (const flag of ['shield_used', 'repaired'] as const) {
      const dayInfo = [
        { day: addDays(START, 1), shield_used: false, repaired: false, [flag]: true },
      ];
      const s = computeHabitStreaks(list, dayInfo, null);
      expect(s.get('core')).toEqual({ streak: 2, longest: 2 });
      expect(s.get('other')).toEqual({ streak: 1, longest: 1 });
    }
  });

  it('a habit not yet done today does not break its streak', () => {
    const list = [inst('h', 0, true), inst('h', 1, false)];
    expect(computeHabitStreaks(list, [], addDays(START, 1)).get('h')?.streak).toBe(1);
  });
});

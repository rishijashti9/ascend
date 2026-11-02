import { GAME } from '@/config/game';
import type { InstanceStatus, Stat, XpReason } from '@/core/db/types';
import { addDays } from '@/core/time';
import { totalXpForLevel } from './levels';
import { computeProgress, type ProgressInput } from './progressState';

const D0 = '2026-11-02';
const day = (i: number) => addDays(D0, i);

const dayRec = (i: number, over: Partial<ProgressInput['days'][number]> = {}) => ({
  day: day(i),
  active: true,
  neutral: false,
  daily_clear: false,
  streak_at_start: 0,
  closed_at: '2026-11-03T00:00:00.000Z',
  deleted_at: null,
  ...over,
});

let n = 0;
const ev = (
  i: number,
  stat: Stat | null,
  base: number,
  reason: XpReason = 'quest_full',
  ref = `q${n++}`,
  revision = 0,
) => ({
  day: day(i),
  occurred_at: `${day(i)}T05:00:00.000Z`,
  stat,
  base_amount: base,
  reason,
  ref_id: ref,
  idempotency_key: `${ref}:${reason}:${revision}`,
  deleted_at: null,
});

const inst = (habit: string, i: number, status: InstanceStatus, core = false) => ({
  id: `${habit}:${day(i)}`,
  source_type: 'habit' as const,
  source_id: habit,
  day: day(i),
  status,
  core_snapshot: core,
  deleted_at: null,
});

const progress = (over: Partial<ProgressInput>) =>
  computeProgress({ days: [], xpEvents: [], instances: [], today: D0, ...over });

describe('computeProgress', () => {
  it('starts at level 1, rank E, no streak', () => {
    const p = progress({});
    expect(p.level).toMatchObject({ level: 1, totalXp: 0 });
    expect(p.rank).toBe('E');
    expect(p.streak).toMatchObject({ streak: 0, daysActive: 0 });
    expect(p.today.xp.total).toBe(0);
  });

  it('sums each day through the XP engine: streak bonus from the day record, Daily Clear', () => {
    const p = progress({
      days: [dayRec(0), dayRec(1, { streak_at_start: 10, daily_clear: true })],
      xpEvents: [ev(0, 'STR', 25), ev(1, 'INT', 50)],
      today: day(1),
    });
    // Day 1: 50 × 1.2 = 60 INT + 20 Daily Clear.
    expect(p.stats.STR.totalXp).toBe(25);
    expect(p.stats.INT.totalXp).toBe(60);
    expect(p.level.totalXp).toBe(25 + 60 + GAME.dailyClearBonus);
    expect(p.today).toMatchObject({ day: day(1), streakAtStart: 10 });
    expect(p.today.xp.total).toBe(80);
  });

  it('a same-day un-tick cancels the award', () => {
    const p = progress({
      days: [dayRec(0)],
      xpEvents: [ev(0, 'WIL', 25, 'quest_full', 'x'), ev(0, 'WIL', -25, 'quest_correction', 'x')],
    });
    expect(p.level.totalXp).toBe(0);
  });

  it('rank needs level and active days, and never goes down', () => {
    const need = totalXpForLevel(5);
    const days = Array.from({ length: 14 }, (_, i) => dayRec(i));
    const xpEvents = [ev(13, null, need, 'bonus')];
    expect(progress({ days, xpEvents }).rank).toBe('D');
    expect(
      progress({ days: days.slice(0, 13), xpEvents: [ev(12, null, need, 'bonus')] }).rank,
    ).toBe('E');
    // A later drop below level 5 (only possible through a same-day correction) keeps rank D.
    const later = progress({
      days: [...days, dayRec(14)],
      xpEvents: [...xpEvents, ev(14, null, -need, 'bonus')],
    });
    expect(later.level.level).toBe(1);
    expect(later.rank).toBe('D');
  });

  it('streaks come from the days; habit streaks from habit instances', () => {
    const p = progress({
      days: [dayRec(0), dayRec(1), dayRec(2, { active: false, closed_at: null })],
      instances: [
        inst('w', 0, 'done_full', true),
        inst('w', 1, 'done_min', true),
        inst('w', 2, 'pending', true),
        inst('j', 0, 'missed'),
        inst('j', 1, 'done_full'),
      ],
      today: day(2),
    });
    expect(p.streak).toMatchObject({ streak: 2, daysActive: 2 });
    expect(p.habitStreaks).toEqual({ w: { streak: 2, longest: 2 }, j: { streak: 1, longest: 1 } });
  });

  it('ignores soft-deleted records', () => {
    const p = progress({
      days: [dayRec(0, { deleted_at: '2026-11-02T00:00:00.000Z' })],
      xpEvents: [{ ...ev(0, 'STR', 25), deleted_at: '2026-11-02T00:00:00.000Z' }],
    });
    expect(p.level.totalXp).toBe(0);
    expect(p.streak.daysActive).toBe(0);
  });
});

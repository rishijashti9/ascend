import type { Stat, XpReason } from '@/core/db/types';
import {
  awardKey,
  baseAward,
  computeDayXp,
  liveEvents,
  netBaseFor,
  planAward,
  streakMultiplier,
} from './xp';

let seq = 0;
/** A test XP event; occurred_at increases with each call unless given. */
function ev(
  base: number,
  stat: Stat | null = 'INT',
  opts: { reason?: XpReason; ref?: string; rev?: number; at?: string } = {},
) {
  seq++;
  const reason = opts.reason ?? 'quest_full';
  const ref = opts.ref ?? `inst${seq}`;
  return {
    occurred_at:
      opts.at ??
      `2026-11-02T0${Math.floor(seq / 60) % 10}:${String(seq % 60).padStart(2, '0')}:00.000Z`,
    stat,
    base_amount: base,
    reason,
    ref_id: stat === null && !opts.ref ? null : ref,
    idempotency_key:
      stat === null && !opts.ref ? `bonus:${seq}` : awardKey(ref, reason, opts.rev ?? 0),
  };
}

beforeEach(() => {
  seq = 0;
});

describe('base awards (step 1)', () => {
  it('by difficulty, minimum and late = 50%', () => {
    expect(baseAward('easy', 'full')).toBe(10);
    expect(baseAward('normal', 'full')).toBe(25);
    expect(baseAward('hard', 'full')).toBe(50);
    expect(baseAward('epic', 'full')).toBe(100);
    expect(baseAward('hard', 'min')).toBe(25);
    expect(baseAward('normal', 'min')).toBe(12.5);
    expect(baseAward('normal', 'late')).toBe(12.5);
  });
});

describe('streak bonus (step 2)', () => {
  it('+2% per streak day, capped at +30%', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(10)).toBeCloseTo(1.2);
    expect(streakMultiplier(15)).toBeCloseTo(1.3);
    expect(streakMultiplier(400)).toBeCloseTo(1.3);
  });

  it('applies the start-of-day streak to every event that day', () => {
    const day = computeDayXp([ev(50), ev(25, 'STR')], 10, false);
    expect(day.byStat).toEqual({ STR: 30, INT: 60, WIL: 0 });
    expect(day.total).toBe(90);
  });
});

describe('soft cap (step 3)', () => {
  it('halves XP beyond 300 in a day', () => {
    expect(computeDayXp([ev(400)], 0, false).total).toBe(350);
  });

  it('splits the event that crosses the threshold', () => {
    // 250 counts fully; of the next 100, 50 fits under the cap and 50 is halved → 75.
    expect(computeDayXp([ev(250), ev(100)], 0, false).total).toBe(325);
  });

  it('streak bonus is applied before the cap', () => {
    // 250 × 1.3 = 325 → 300 + 25 × 0.5 = 312.5 → 313
    expect(computeDayXp([ev(250)], 20, false).total).toBe(313);
  });

  it('the cap is shared across stats and follows occurred_at order', () => {
    const a = ev(200, 'INT', { at: '2026-11-02T01:00:00.000Z' });
    const b = ev(200, 'STR', { at: '2026-11-02T02:00:00.000Z' });
    const day = computeDayXp([b, a], 0, false); // input order doesn't matter
    expect(day.byStat.INT).toBe(200); // first: fully under the cap
    expect(day.byStat.STR).toBe(150); // 100 + 100 × 0.5
  });

  it("Rishi's full day (≈180 base) stays under the cap", () => {
    const full = [25, 50, 25, 25, 10, 25, 10, 10].map((b) => ev(b));
    expect(computeDayXp(full, 0, false).total).toBe(180);
    expect(computeDayXp(full, 15, false).total).toBe(234);
  });
});

describe('rounding (step 4) and bonuses', () => {
  it('rounds once per stat, so minimum + top-up equals full', () => {
    const min = ev(12.5, 'WIL', { reason: 'quest_min', ref: 'wake' });
    const topup = ev(12.5, 'WIL', { reason: 'quest_topup', ref: 'wake' });
    const viaTopup = computeDayXp([min, topup], 0, false);
    const direct = computeDayXp([ev(25, 'WIL')], 0, false);
    expect(viaTopup.total).toBe(direct.total);
    expect(viaTopup.total).toBe(25);
  });

  it('Daily Clear +20 goes to the player only, without streak bonus or cap', () => {
    const day = computeDayXp([ev(400)], 15, true);
    expect(day.bonus).toBe(20);
    expect(day.byStat.INT).toBe(Math.round(300 + (520 - 300) * 0.5));
    expect(day.total).toBe(day.byStat.INT + 20);
  });

  it('other no-stat bonuses are also player-only and uncapped', () => {
    const day = computeDayXp([ev(300), ev(50, null)], 0, false);
    expect(day.total).toBe(350);
    expect(day.bonus).toBe(50);
  });

  it('is identical for any input order (multi-device sync)', () => {
    const events = [ev(50), ev(25, 'STR'), ev(100, 'WIL'), ev(80), ev(60, 'STR')];
    const a = computeDayXp(events, 7, true);
    const b = computeDayXp([...events].reverse(), 7, true);
    expect(b).toEqual(a);
  });
});

describe('same-day un-tick (corrections)', () => {
  it('a correction cancels its whole revision', () => {
    const award = ev(25, 'STR', { ref: 'w', rev: 0 });
    const correction = ev(-25, 'STR', { reason: 'quest_correction', ref: 'w', rev: 0 });
    expect(liveEvents([award, correction])).toEqual([]);
    expect(computeDayXp([award, correction], 10, false).total).toBe(0);
  });

  it('ticking again after an un-tick awards once (new revision)', () => {
    const events = [
      ev(25, 'STR', { ref: 'w', rev: 0 }),
      ev(-25, 'STR', { reason: 'quest_correction', ref: 'w', rev: 0 }),
      ev(25, 'STR', { ref: 'w', rev: 1 }),
    ];
    expect(netBaseFor(events, 'w')).toBe(25);
    expect(computeDayXp(events, 0, false).total).toBe(25);
  });

  it('a correction does not leave soft-cap leftovers behind', () => {
    const big = ev(280, 'INT', { ref: 'a', at: '2026-11-02T01:00:00.000Z' });
    const mistake = ev(100, 'STR', { ref: 'b', at: '2026-11-02T02:00:00.000Z' });
    const undo = ev(-100, 'STR', {
      reason: 'quest_correction',
      ref: 'b',
      at: '2026-11-02T02:05:00.000Z',
    });
    const later = ev(50, 'WIL', { ref: 'c', at: '2026-11-02T03:00:00.000Z' });
    const withUndo = computeDayXp([big, mistake, undo, later], 0, false);
    const never = computeDayXp([big, later], 0, false);
    expect(withUndo).toEqual(never);
  });
});

describe('planAward (one net award per instance)', () => {
  const p = { instanceId: 'i', difficulty: 'normal' as const, revision: 0, currentNetBase: 0 };

  it('pending → full / min / late', () => {
    expect(planAward({ ...p, from: 'pending', to: 'done_full' }).awards).toEqual([
      { reason: 'quest_full', base_amount: 25, idempotency_key: 'i:quest_full:0' },
    ]);
    expect(planAward({ ...p, from: 'pending', to: 'done_min' }).awards[0]?.base_amount).toBe(12.5);
    expect(planAward({ ...p, from: 'pending', to: 'done_late' }).awards[0]?.reason).toBe(
      'quest_late',
    );
  });

  it('min → full is a top-up of the difference', () => {
    const r = planAward({ ...p, from: 'done_min', to: 'done_full', currentNetBase: 12.5 });
    expect(r.awards).toEqual([
      { reason: 'quest_topup', base_amount: 12.5, idempotency_key: 'i:quest_topup:0' },
    ]);
  });

  it('un-tick writes a correction and bumps the revision', () => {
    const r = planAward({ ...p, from: 'done_full', to: 'pending', currentNetBase: 25 });
    expect(r.awards).toEqual([
      { reason: 'quest_correction', base_amount: -25, idempotency_key: 'i:quest_correction:0' },
    ]);
    expect(r.revision).toBe(1);
  });

  it('no change → nothing; downgrades are refused', () => {
    expect(
      planAward({ ...p, from: 'done_full', to: 'done_full', currentNetBase: 25 }).awards,
    ).toEqual([]);
    expect(() =>
      planAward({ ...p, from: 'done_full', to: 'done_min', currentNetBase: 25 }),
    ).toThrow(/only goes up/);
    expect(() =>
      planAward({ ...p, from: 'done_late', to: 'done_full', currentNetBase: 12.5 }),
    ).not.toThrow();
  });
});

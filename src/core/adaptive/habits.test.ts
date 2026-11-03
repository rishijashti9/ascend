import { weekdayOf } from '@/core/time';
import { pastDays, rng, testEvent, testHabit, testInput, testInstance } from '@/test/adaptiveInput';
import { chanceOn, habitModel } from './habits';
import { brier } from './model';

const TODAY = '2026-11-02';

describe('habit models (SPEC 6.7 A)', () => {
  it('cold start: no data gives the prior with an "early guess" confidence', () => {
    const m = habitModel(testInput({ habits: [testHabit('h')] }), 'h');
    expect(m.done.p).toBeCloseTo(0.7, 1);
    expect(m.done.confidence).toBe('early');
    expect(m.observed).toBe(0);
  });

  it('confidence grows with evidence', () => {
    const days = pastDays(TODAY, 30);
    const m = habitModel(
      testInput({ instances: days.map((d) => testInstance('h', d, 'done_full')) }),
      'h',
    );
    expect(m.done.p).toBeGreaterThan(0.9);
    expect(m.done.confidence).toBe('confident');
  });

  it('recent days count more: after a change of habit it re-adapts within weeks', () => {
    const days = pastDays(TODAY, 120);
    const instances = days.map((d, i) => testInstance('h', d, i < 90 ? 'done_full' : 'missed'));
    const m = habitModel(testInput({ instances }), 'h');
    expect(m.done.p).toBeLessThan(0.4); // 90 good days, but the last 30 were missed
  });

  it('a reset ignores everything before it', () => {
    const days = pastDays(TODAY, 60);
    const instances = days.map((d) => testInstance('h', d, 'missed'));
    const events = [testEvent({ kind: 'reset', ref_id: 'h', day: days[50] })];
    const m = habitModel(testInput({ instances, events }), 'h');
    expect(m.observed).toBe(10); // from the reset day on
  });

  it('skipped days, today and Day 1 do not count', () => {
    const days = pastDays(TODAY, 5);
    const instances = [
      testInstance('h', days[0] ?? '', 'missed'),
      testInstance('h', days[1] ?? '', 'skipped'),
      testInstance('h', days[2] ?? '', 'done_full'),
      testInstance('h', TODAY, 'pending'),
    ];
    const m = habitModel(testInput({ instances, startDay: days[0] ?? null }), 'h');
    expect(m.observed).toBe(1);
  });

  it('is calibrated: predicted chances match what really happens (6 simulated users)', () => {
    // Users who rarely do it on weekends and mostly on weekdays.
    const truth = [0.3, 0.9, 0.85, 0.8, 0.75, 0.7, 0.35];
    const pairs: { p: number; outcome: boolean }[] = [];
    const baseline: { p: number; outcome: boolean }[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      const random = rng(seed * 101);
      const all = pastDays(TODAY, 240);
      const outcomes = all.map((d) => random() < (truth[weekdayOf(d)] ?? 0));
      for (let k = 60; k < all.length; k += 2) {
        const day = all[k] ?? TODAY;
        const instances = all
          .slice(0, k)
          .map((d, i) => testInstance('h', d, outcomes[i] ? 'done_full' : 'missed'));
        const m = habitModel(testInput({ today: day, instances }), 'h');
        pairs.push({ p: chanceOn(m, day).p, outcome: outcomes[k] ?? false });
        const rate = outcomes.slice(0, k).filter(Boolean).length / k;
        baseline.push({ p: rate, outcome: outcomes[k] ?? false });
      }
    }
    // Better than "always predict the overall rate".
    expect(brier(pairs)).toBeLessThan(brier(baseline) - 0.015);
    // Reliability: in each band, the average forecast is close to what happened.
    for (const [lo, hi] of [
      [0, 0.5],
      [0.5, 0.7],
      [0.7, 1.01],
    ] as const) {
      const band = pairs.filter((x) => x.p >= lo && x.p < hi);
      expect(band.length).toBeGreaterThan(40);
      const predicted = band.reduce((s, x) => s + x.p, 0) / band.length;
      const observed = band.filter((x) => x.outcome).length / band.length;
      expect(Math.abs(predicted - observed)).toBeLessThan(0.1);
    }
  });
});

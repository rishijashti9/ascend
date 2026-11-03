import { simulateAdaptive } from './simulateAdaptive';

describe('simulated users (SPEC 6.7 phase tests)', () => {
  it('adaptive difficulty improves adherence over fixed targets, without oscillating', () => {
    const s = simulateAdaptive(30, 1);
    expect(s.adaptive.adherence).toBeGreaterThan(s.fixed.adherence + 0.05);
    expect(s.adaptive.fullRate).toBeGreaterThan(s.fixed.fullRate + 0.15);
    // No back-and-forth within a month; at most a re-test about once a quarter.
    expect(s.quickReversals).toBe(0);
    expect(s.maxReversals).toBeLessThanOrEqual(6);
    expect(s.nearCapacity).toBeGreaterThanOrEqual(20);
  }, 120_000);
});

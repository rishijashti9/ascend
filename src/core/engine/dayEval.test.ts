import type { InstanceStatus } from '@/core/db/types';
import { evaluateDay, visibleOnLowEnergy } from './dayEval';

const q = (status: InstanceStatus, core = false, source: 'habit' | 'quest' = 'habit') => ({
  source_type: source,
  status,
  core_snapshot: core,
  deleted_at: null,
});

describe('evaluateDay', () => {
  it('active when every core quest is done at least at minimum', () => {
    const day = [q('done_min', true), q('done_full', true), q('pending')];
    expect(evaluateDay(day, false)).toEqual({ neutral: false, active: true, dailyClear: false });
  });

  it('not active when a core quest is missing', () => {
    expect(evaluateDay([q('done_full', true), q('pending', true)], false).active).toBe(false);
  });

  it('a late wake-up check-in counts as meeting the minimum', () => {
    expect(evaluateDay([q('done_late', true), q('done_min', true)], false).active).toBe(true);
  });

  it('a day with no core quest scheduled is neutral', () => {
    expect(evaluateDay([q('pending'), q('done_full')], false)).toMatchObject({
      neutral: true,
      active: false,
    });
    expect(evaluateDay([], false).neutral).toBe(true);
  });

  it('Daily Clear needs every daily quest on a normal day', () => {
    expect(evaluateDay([q('done_min', true), q('done_full')], false).dailyClear).toBe(true);
    expect(evaluateDay([q('done_min', true), q('pending')], false).dailyClear).toBe(false);
  });

  it('on a low-energy day only core quests are required for Daily Clear', () => {
    const day = [q('done_min', true), q('done_min', true), q('pending'), q('pending')];
    expect(evaluateDay(day, true)).toEqual({ neutral: false, active: true, dailyClear: true });
  });

  it('weekly, side and recovery quests never affect the day', () => {
    const day = [q('done_full', true), q('pending', false, 'quest')];
    expect(evaluateDay(day, false).dailyClear).toBe(true);
  });

  it('ignores deleted instances (paused habits)', () => {
    const day = [q('done_full', true), { ...q('pending'), deleted_at: 'x' }];
    expect(evaluateDay(day, false).dailyClear).toBe(true);
  });

  it('low energy hides non-core pending daily quests only', () => {
    expect(visibleOnLowEnergy(q('pending', true))).toBe(true);
    expect(visibleOnLowEnergy(q('pending'))).toBe(false);
    expect(visibleOnLowEnergy(q('done_full'))).toBe(true);
    expect(visibleOnLowEnergy(q('pending', false, 'quest'))).toBe(true);
  });
});

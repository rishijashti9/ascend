import type { Capacity } from '@/core/adaptive/patterns';
import { analyze, type PlannerState } from './analyze';
import { weeklyCount } from './plan';
import { MAX_WEEKLY, weeklyLimit } from './weekly';

const cap = (ratio: number, confidence: Capacity['confidence'] = 'confident'): Capacity => ({
  doneMinutes: Math.round(1400 * ratio),
  plannedMinutes: 1400,
  ratio,
  weeks: 6,
  confidence,
});
const state = (capacity: Capacity | null): PlannerState => ({
  today: '2026-11-02',
  weekStart: '2026-11-02',
  mainQuests: [],
  milestones: [],
  habits: [],
  quests: [],
  instances: [],
  capacity,
});

describe('plans sized to real capacity (SPEC 6.7 A)', () => {
  it('fewer weekly quests when much less gets done than the quests ask for', () => {
    expect(weeklyLimit(state(null))).toBe(MAX_WEEKLY);
    expect(weeklyLimit(state(cap(0.9)))).toBe(MAX_WEEKLY);
    expect(weeklyLimit(state(cap(0.7)))).toBe(4);
    expect(weeklyLimit(state(cap(0.5)))).toBe(3);
    expect(weeklyLimit(state(cap(0.5, 'early')))).toBe(MAX_WEEKLY); // not known yet
  });

  it('per goal: one fewer under 80%, at most 2 under 60%', () => {
    expect(weeklyCount({ weeklyPerWeek: 3 }, null, null)).toBe(3);
    expect(weeklyCount({ weeklyPerWeek: 3 }, null, 0.7)).toBe(2);
    expect(weeklyCount({ weeklyPerWeek: 3 }, null, 0.5)).toBe(2);
  });

  it('the planner says so before the interview', () => {
    const a = analyze(state(cap(0.5)));
    expect(a.capacityRatio).toBe(0.5);
    expect(a.conflicts.join(' ')).toMatch(/Lately you really do about 1\.7 h a day of the 3\.3 h/);
  });
});

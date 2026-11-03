import { pastDays, testHabit, testInput } from '@/test/adaptiveInput';
import { healthGap, type HealthCheckIn } from './health';
import { healthPlanItems } from './healthPlan';
import { balanceSignal } from '@/core/adaptive/balance';
import { testInstance } from '@/test/adaptiveInput';

const TODAY = '2026-11-30';
const base: HealthCheckIn = {
  activity: 'none',
  strengthDays: 0,
  sleep: 'under6',
  energy: 2,
  goals: [],
};
const plan = (
  goals: HealthCheckIn['goals'],
  extra: Partial<Parameters<typeof healthPlanItems>[0]> = {},
) => {
  const checkIn = { ...base, goals };
  return healthPlanItems({
    checkIn,
    gap: healthGap(testInput({ today: TODAY }), checkIn, 'IN'),
    habits: [],
    mainQuestId: 'mq',
    today: TODAY,
    weekStart: TODAY,
    weightKg: 80,
    ...extra,
  });
};

describe('health roadmap (SPEC 6.7 B)', () => {
  it('strength from zero: twice a week, short bodyweight sessions, cited', () => {
    const items = plan(['strength']);
    const m = items.find((i) => i.kind === 'milestone.create');
    expect(m?.reason).toMatch(
      /WHO: muscle-strengthening on 2\+ days a week.*World Health Organization/,
    );
    const titles = items.flatMap((i) => (i.kind === 'quest.create' ? [i.data.title] : []));
    expect(titles.filter((t) => t.startsWith('Strength'))).toEqual([
      'Strength session: 20 min, bodyweight (squats, push-ups, rows)',
      'Strength session: 20 min, bodyweight',
    ]);
    expect(titles).toContain('Three brisk walks of 20 minutes'); // inactive → stamina too
    expect(items.some((i) => i.kind === 'habit.create' && /Dal, chana/.test(i.data.title))).toBe(
      true,
    );
  });

  it('fat loss only at a safe rate (0.5 % a week), with a weight milestone', () => {
    const m = plan(['fat_loss']).find(
      (i) => i.kind === 'milestone.create' && i.data.target_type === 'metric',
    );
    expect(m?.kind === 'milestone.create' && m.data.target_value).toBe(77); // 80 × 0.96 → 76.8 → 77
    expect(m?.kind === 'milestone.create' && m.data.target_date).toBe('2027-01-25'); // 8 weeks
  });

  it('a sleep target only ever goes up', () => {
    const low = testHabit('sleep', { measure: 'sleep_hours', target_value: 6.5, min_value: 6 });
    const up = plan(['better_sleep'], { habits: [low] }).find((i) => i.kind === 'habit.update');
    expect(up?.kind === 'habit.update' && up.changes.target_value).toBe(7);
    const high = testHabit('sleep', { measure: 'sleep_hours', target_value: 8, min_value: 7 });
    expect(plan(['better_sleep'], { habits: [high] }).some((i) => i.kind === 'habit.update')).toBe(
      false,
    );
  });
});

describe('career–health balance', () => {
  it('a heavy study week with short sleep makes room for recovery, with the sleep pattern', () => {
    const days = pastDays(TODAY, 35);
    const instances = days.map((d, i) =>
      testInstance('study', d, 'done_full', { value: i >= 28 ? 240 : 120 }),
    );
    const sleep = days.map((d, i) => ({ day: d, value: i >= 28 ? 5.5 : i % 2 ? 8 : 6 }));
    const b = balanceSignal(testInput({ today: TODAY, instances, sleep }));
    expect(b.needed).toBe(true);
    expect(b.why).toMatch(
      /heavy study week \(28 h vs your usual 14 h\), short sleep \(5\.5 h a night\)/,
    );
  });

  it('a normal week needs nothing', () => {
    const days = pastDays(TODAY, 35);
    const instances = days.map((d) => testInstance('study', d, 'done_full', { value: 120 }));
    expect(balanceSignal(testInput({ today: TODAY, instances })).needed).toBe(false);
  });
});

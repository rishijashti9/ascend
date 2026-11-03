import { addDays } from '@/core/time';
import { pastDays, testInput, testInstance } from '@/test/adaptiveInput';
import { healthGap, type HealthCheckIn } from './health';

const TODAY = '2026-11-30';
const checkIn: HealthCheckIn = {
  activity: 'light',
  strengthDays: 1,
  sleep: '6to7',
  energy: 3,
  goals: ['strength'],
};
const status = (gap: ReturnType<typeof healthGap>, id: string) =>
  gap.items.find((i) => i.guideline.id === id);

describe('health gap analysis (SPEC 6.7 B)', () => {
  it('uses real data first: workouts, steps and logged sleep', () => {
    const days = pastDays(TODAY, 14);
    const input = testInput({
      today: TODAY,
      instances: days.map((d, i) =>
        testInstance('w', d, i % 2 ? 'done_full' : 'missed', { workout: true, measure: 'check' }),
      ),
      steps: days.map((d) => ({ day: d, value: 9000 })),
      sleep: days.map((d) => ({ day: d, value: 6.2 })),
    });
    const gap = healthGap(input, checkIn, 'IN');
    expect(status(gap, 'activity-aerobic')).toMatchObject({ status: 'meets', basis: 'data' });
    expect(status(gap, 'activity-aerobic')?.yours).toMatch(
      /3\.5 workout days a week and 9,000 steps/,
    );
    expect(status(gap, 'sleep-duration')).toMatchObject({ status: 'below', basis: 'data' });
    expect(status(gap, 'activity-strength')).toMatchObject({ status: 'close', basis: 'check-in' });
  });

  it('falls back to the check-in, and says when nothing is known', () => {
    const gap = healthGap(testInput({ today: TODAY }), checkIn, 'IN');
    expect(status(gap, 'sleep-duration')).toMatchObject({ status: 'close', basis: 'check-in' });
    expect(status(gap, 'activity-aerobic')).toMatchObject({ status: 'below', basis: 'check-in' });
    const none = healthGap(testInput({ today: TODAY }), null, 'IN');
    expect(status(none, 'sleep-duration')?.status).toBe('unknown');
  });

  it('safety notes come first: weight dropping too fast, sustained low mood', () => {
    const w = [
      ...pastDays(TODAY, 5).map((d) => ({ day: d, value: 70 })),
      ...pastDays(addDays(TODAY, -14), 5).map((d) => ({ day: d, value: 74 })),
    ];
    const mood = pastDays(TODAY, 8).map((d) => ({ day: d, value: 1 }));
    const gap = healthGap(testInput({ today: TODAY, weight: w, mood }), null, 'IN');
    expect(gap.safety.map((s) => s.kind)).toEqual(['weight', 'mood']);
  });
});

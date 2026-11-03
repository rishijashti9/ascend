import { computeAdaptive } from '@/core/state/adaptive';
import { addDays } from '@/core/time';
import { ist } from '@/test/testDb';
import { pastDays, testEvent, testHabit, testInput, testInstance } from '@/test/adaptiveInput';
import { dailyOutcomesCsv, knownItems, learningEventsCsv } from './knows';

const TODAY = '2026-11-30';
const at = (day: string, h: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(ist(y ?? 0, m ?? 0, d ?? 0, h)).toISOString();
};

function input(extra: Parameters<typeof testInput>[0] = {}) {
  const days = pastDays(TODAY, 28);
  return testInput({
    today: TODAY,
    habits: [testHabit('study', { title: 'Study' })],
    instances: days.map((d) =>
      testInstance('study', d, 'done_full', { completedAt: at(d, 6), value: 60 }),
    ),
    focus: days.map((d) => ({ day: d, startedAt: at(d, 6), minutes: 50, linked: true })),
    sleep: days.slice(-7).map((d) => ({ day: d, value: 6.8 })),
    ...extra,
  });
}

describe('what the System knows (SPEC 6.7 A)', () => {
  it('lists learned items in plain words with a confidence and a way to clear each', () => {
    const items = knownItems(computeAdaptive(input()), [testHabit('study', { title: 'Study' })]);
    const byKey = new Map(items.map((i) => [i.key, i]));
    expect(byKey.get('habit:study')?.text).toMatch(/^Done on about 9\d% of days/);
    expect(byKey.get('habit:study')?.clear).toEqual({ kind: 'reset', habitId: 'study' });
    expect(byKey.get('focus_window')?.text).toMatch(/06:00–08:00/);
    expect(byKey.get('sleep')?.text).toMatch(/About 6\.8 h a night lately/);
    for (const i of items) expect(['early', 'likely', 'confident']).toContain(i.confidence);
  });

  it('a cleared item learns afresh from that day', () => {
    const events = [testEvent({ kind: 'forget', type: 'focus_window', day: addDays(TODAY, -1) })];
    const items = knownItems(computeAdaptive(input({ events })), []);
    expect(items.some((i) => i.key === 'focus_window')).toBe(false);
  });

  it('a reset quest has nothing learned yet', () => {
    const events = [testEvent({ kind: 'reset', ref_id: 'study', day: TODAY })];
    const items = knownItems(computeAdaptive(input({ events })), [testHabit('study')]);
    expect(items.some((i) => i.key === 'habit:study')).toBe(false);
  });
});

describe('learning CSV export', () => {
  it('daily outcomes: one row per quest per day, numbers only', () => {
    const lines = dailyOutcomesCsv(input()).trim().split('\n');
    expect(lines[0]).toBe(
      'day,weekday,habit_id,stat,core,measure,target,value,status,low_energy,completed_hour',
    );
    expect(lines).toHaveLength(29);
    expect(lines[1]).toBe('2026-11-02,1,study,INT,0,minutes,60,60,done_full,0,6');
  });

  it('learning events: values as key=value; commas and quotes are escaped', () => {
    const csv = learningEventsCsv([
      testEvent({ id: 'a,b', type: 'week', values: { done_min: 40, planned_min: 90 } }),
    ]);
    expect(csv.split('\n')[1]).toBe(
      '"a,b",suggestion,week,,2026-01-01T00:00:00.000Z,2026-01-01,,done_min=40;planned_min=90',
    );
  });
});

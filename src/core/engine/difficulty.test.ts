import type { InstanceStatus } from '@/core/db/types';
import { addDays } from '@/core/time';
import { pastDays, testHabit, testInput, testInstance } from '@/test/adaptiveInput';
import {
  difficultySuggestion,
  largerTarget,
  smallerTarget,
  type DifficultyInput,
} from './difficulty';

const TODAY = '2026-11-02';
const study = testHabit('study', { title: 'Study', target_value: 150, min_value: 30, order: 0 });
const walk = testHabit('walk', {
  title: 'Walk',
  measure: 'steps',
  target_value: 8000,
  min_value: 3000,
  order: 1,
});
const sleep = testHabit('sleep', {
  title: 'Sleep',
  measure: 'sleep_hours',
  target_value: 7.5,
  min_value: 6.5,
  auto_source: 'sleep',
  order: 2,
});

/** `n` past days of one quest; `pick(i)` decides each day's status. */
const history = (
  habitId: string,
  target: number,
  n: number,
  pick: (i: number) => InstanceStatus,
  over: { lowEnergy?: (i: number) => boolean; measure?: 'minutes' | 'steps' | 'sleep_hours' } = {},
) =>
  pastDays(TODAY, n).map((d, i) =>
    testInstance(habitId, d, pick(i), {
      target,
      measure: over.measure ?? 'minutes',
      lowEnergy: over.lowEnergy?.(i) ?? false,
    }),
  );

const run = (over: Partial<DifficultyInput['input']>, snoozedUntil = {}) =>
  difficultySuggestion({
    input: testInput({ habits: [study, walk, sleep], ...over }),
    snoozedUntil,
  });

describe('target steps', () => {
  it('smaller: 15% less (25% when rarely reached), tidy, never below the minimum; larger ~10%', () => {
    expect(smallerTarget({ measure: 'minutes', target_value: 150, min_value: 30 }, 0.5)).toBe(130);
    expect(smallerTarget({ measure: 'minutes', target_value: 150, min_value: 30 }, 0.2)).toBe(115);
    expect(smallerTarget({ measure: 'steps', target_value: 8000, min_value: 3000 }, 0.2)).toBe(
      6000,
    );
    expect(smallerTarget({ measure: 'minutes', target_value: 20, min_value: 20 })).toBeNull();
    expect(largerTarget({ measure: 'minutes', target_value: 150 })).toBe(165);
    expect(largerTarget({ measure: 'steps', target_value: 8000 })).toBe(9000);
    expect(largerTarget({ measure: 'count', target_value: 3 })).toBe(4);
  });
});

describe('adaptive difficulty (aim: full on ~4 days in 5)', () => {
  it('a quest rarely done in full gets a smaller target, with the numbers behind it', () => {
    const instances = history('study', 150, 10, (i) => (i % 4 === 0 ? 'done_full' : 'done_min'));
    const s = run({ instances });
    expect(s?.kind).toBe('ease');
    expect(s?.changes).toEqual([
      expect.objectContaining({ habitId: 'study', from: 150, to: 130, fullDays: 3, days: 10 }),
    ]);
  });

  it('needs 7 days at the current target first (a fresh change is never judged early)', () => {
    const instances = history('study', 150, 6, () => 'missed');
    expect(run({ instances })).toBeNull();
    // 20 days at an older target don't count against the new one.
    const old = history('study', 200, 20, () => 'missed');
    expect(run({ instances: old })).toBeNull();
  });

  it('the dead band (65–92% full) changes nothing', () => {
    const instances = history('study', 150, 30, (i) => (i % 5 === 0 ? 'done_min' : 'done_full'));
    expect(run({ instances })).toBeNull();
  });

  it('nearly always done in full for 14+ days → raise one quest a little', () => {
    const instances = history('walk', 8000, 20, () => 'done_full', { measure: 'steps' });
    const s = run({ instances });
    expect(s).toMatchObject({ kind: 'raise', changes: [{ habitId: 'walk', to: 9000 }] });
  });

  it('never raises during a low-energy streak, and never touches sleep', () => {
    const instances = [
      ...history('walk', 8000, 20, () => 'done_full', { measure: 'steps' }),
      ...history('sleep', 7.5, 20, () => 'missed', { measure: 'sleep_hours' }),
    ];
    expect(run({ instances, lowEnergyDays: [TODAY, addDays(TODAY, -1)] })).toBeNull();
    expect(run({ instances })?.changes.map((c) => c.habitId)).toEqual(['walk']);
  });

  it('low-energy days are not held against a quest', () => {
    const instances = history('study', 150, 12, (i) => (i < 8 ? 'done_min' : 'done_full'), {
      lowEnergy: (i) => i < 8,
    });
    expect(run({ instances })).toBeNull();
  });

  it('low energy 4 days in a row (today included) comes first; snoozing hides a kind', () => {
    const lowEnergyDays = [0, 1, 2, 3].map((k) => addDays(TODAY, -k));
    const instances = history('study', 150, 10, () => 'missed');
    expect(run({ instances, lowEnergyDays })?.kind).toBe('low_energy');
    expect(run({ instances, lowEnergyDays }, { low_energy: TODAY })?.kind).toBe('ease');
    expect(run({ instances }, { ease: TODAY })).toBeNull();
  });

  it('eases at most two quests at once, hardest first', () => {
    const extra = testHabit('code', { title: 'Code', target_value: 60, min_value: 15, order: 3 });
    const instances = [
      ...history('study', 150, 10, (i) => (i < 4 ? 'done_full' : 'missed')),
      ...history('walk', 8000, 10, () => 'missed', { measure: 'steps' }),
      ...history('code', 60, 10, (i) => (i < 2 ? 'done_full' : 'missed')),
    ];
    const s = difficultySuggestion({
      input: testInput({ habits: [study, walk, sleep, extra], instances }),
      snoozedUntil: {},
    });
    expect(s?.changes.map((c) => c.habitId)).toEqual(['walk', 'code']);
  });
});

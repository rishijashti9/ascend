import type { Habit, InstanceStatus } from '@/core/db/types';
import { addDays } from '@/core/time';
import {
  difficultySuggestion,
  largerTarget,
  smallerTarget,
  type DifficultyInput,
} from './difficulty';

const TODAY = '2026-11-20';
type H = DifficultyInput['habits'][number];
const habit = (id: string, over: Partial<H> = {}): H => ({
  id,
  title: id,
  measure: 'minutes' as Habit['measure'],
  target_value: 60,
  min_value: 15,
  status: 'active',
  auto_source: 'none',
  order: 0,
  ...over,
});
const HABITS = [
  habit('study', { target_value: 150, min_value: 30, order: 0 }),
  habit('walk', { measure: 'steps', target_value: 8000, min_value: 3000, order: 1 }),
  habit('journal', { measure: 'check', target_value: null, min_value: null, order: 2 }),
];

/** Instances for `n` days before today: status per habit id for each day. */
function history(n: number, status: (id: string, back: number) => InstanceStatus) {
  return Array.from({ length: n }, (_, k) => addDays(TODAY, -1 - k)).flatMap((day, k) =>
    HABITS.map((h) => ({
      id: `${h.id}:${day}`,
      source_type: 'habit' as const,
      source_id: h.id,
      day,
      status: status(h.id, k + 1),
      deleted_at: null,
    })),
  );
}
const input = (over: Partial<DifficultyInput>): DifficultyInput => ({
  today: TODAY,
  days: [],
  instances: [],
  habits: HABITS,
  snoozedUntil: {},
  ...over,
});

describe('target nudges', () => {
  it('smaller is 25% less in tidy steps, never below the minimum; larger ~10% more', () => {
    expect(smallerTarget({ measure: 'minutes', target_value: 150, min_value: 30 })).toBe(115);
    expect(smallerTarget({ measure: 'steps', target_value: 8000, min_value: 3000 })).toBe(6000);
    expect(smallerTarget({ measure: 'minutes', target_value: 20, min_value: 20 })).toBeNull();
    expect(largerTarget({ measure: 'minutes', target_value: 150 })).toBe(165);
    expect(largerTarget({ measure: 'minutes', target_value: 20 })).toBe(25);
    expect(largerTarget({ measure: 'steps', target_value: 8000 })).toBe(9000);
    expect(largerTarget({ measure: 'count', target_value: 3 })).toBe(4);
  });
});

describe('difficultySuggestion', () => {
  it('3 days under 50% → ease, shrinking the numeric quests missed on 2+ of them', () => {
    const s = difficultySuggestion(
      input({
        instances: history(3, (id) => (id === 'journal' ? 'done_full' : 'missed')),
      }),
    );
    expect(s).toEqual({
      kind: 'ease',
      changes: [
        { habitId: 'study', title: 'study', measure: 'minutes', from: 150, to: 115 },
        { habitId: 'walk', title: 'walk', measure: 'steps', from: 8000, to: 6000 },
      ],
    });
  });

  it('needs all 3 days under half (one good day breaks it) and ignores today', () => {
    const one = history(3, (id, back) => (back === 2 || id === 'journal' ? 'done_full' : 'missed'));
    expect(difficultySuggestion(input({ instances: one }))).toBeNull();
    // Only 2 closed days of history (today is still going).
    expect(difficultySuggestion(input({ instances: history(2, () => 'missed') }))).toBeNull();
  });

  it('7 days fully done → raise the first adjustable quest (not sleep) a little', () => {
    const s = difficultySuggestion(input({ instances: history(7, () => 'done_full') }));
    expect(s).toEqual({
      kind: 'raise',
      changes: [{ habitId: 'study', title: 'study', measure: 'minutes', from: 150, to: 165 }],
    });
    // A minimum counts as done, but not as 100%.
    const mins = history(7, (id, back) => (id === 'walk' && back === 4 ? 'done_min' : 'done_full'));
    expect(difficultySuggestion(input({ instances: mins }))).toBeNull();
  });

  it('low energy 4 days in a row (today included) comes first; snoozing hides a kind', () => {
    const days = [0, 1, 2, 3].map((k) => ({
      day: addDays(TODAY, -k),
      low_energy: true,
      deleted_at: null,
    }));
    const instances = history(3, () => 'missed');
    expect(difficultySuggestion(input({ days, instances }))?.kind).toBe('low_energy');
    expect(
      difficultySuggestion(input({ days, instances, snoozedUntil: { low_energy: TODAY } }))?.kind,
    ).toBe('ease');
    expect(
      difficultySuggestion(
        input({ days, instances, snoozedUntil: { low_energy: TODAY, ease: '2026-11-25' } }),
      ),
    ).toBeNull();
    // Snooze over (yesterday) → back.
    expect(
      difficultySuggestion(
        input({ days: days.slice(1), instances, snoozedUntil: { ease: '2026-11-19' } }),
      )?.kind,
    ).toBe('ease');
  });

  it('Recovery quests and skipped instances don’t count', () => {
    const instances = [
      ...history(3, (id) => (id === 'journal' ? 'skipped' : 'done_full')),
      ...[1, 2, 3].map((k) => ({
        id: `recovery:${addDays(TODAY, -k)}`,
        source_type: 'habit' as const,
        source_id: 'recovery',
        day: addDays(TODAY, -k),
        status: 'missed' as const,
        deleted_at: null,
      })),
    ];
    expect(difficultySuggestion(input({ instances }))).toBeNull();
  });
});

import { DEFAULT_SETTINGS } from '@/config/defaults';
import type { AdaptiveInput, InstanceObs } from '@/core/adaptive/input';
import type { Habit, InstanceStatus, LearningEvent, Settings } from '@/core/db/types';
import { addDays, type DayString } from '@/core/time';

/** Small deterministic RNG (tests and simulations). */
export function rng(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const base = { created_at: '', updated_at: '', deleted_at: null, schema_version: 1, hlc: 'h' };

export function testHabit(id: string, over: Partial<Habit> = {}): Habit {
  return {
    ...base,
    id,
    title: id,
    stat: 'INT',
    difficulty: 'normal',
    schedule: [0, 1, 2, 3, 4, 5, 6],
    full_version: '',
    min_version: '',
    measure: 'minutes',
    target_value: 60,
    min_value: 15,
    core: false,
    auto_source: 'none',
    skill_ids: [],
    status: 'active',
    planned_by: 'me',
    order: 0,
    linked_goal_type: null,
    linked_goal_id: null,
    ...over,
  };
}

export function testInstance(
  habitId: string,
  day: DayString,
  status: InstanceStatus,
  over: Partial<InstanceObs> = {},
): InstanceObs {
  return {
    id: `${habitId}:${day}`,
    habitId,
    day,
    status,
    measure: 'minutes',
    target: 60,
    min: 15,
    value: status === 'done_full' ? 60 : status === 'done_min' ? 20 : 0,
    completedAt: null,
    core: false,
    lowEnergy: false,
    stat: 'INT',
    ...over,
  };
}

export function testEvent(over: Partial<LearningEvent>): LearningEvent {
  return {
    ...base,
    id: crypto.randomUUID(),
    kind: 'suggestion',
    type: 'x',
    outcome: null,
    at: '2026-01-01T00:00:00.000Z',
    day: '2026-01-01',
    ref_id: null,
    values: null,
    ...over,
  };
}

export function testInput(over: Partial<AdaptiveInput> = {}): AdaptiveInput {
  return {
    today: '2026-11-02',
    tz: 'Asia/Kolkata',
    settings: { ...base, id: 'settings', ...DEFAULT_SETTINGS } as Settings,
    startDay: null,
    habits: [],
    instances: [],
    focus: [],
    sleep: [],
    weight: [],
    energy: [],
    mood: [],
    lowEnergyDays: [],
    events: [],
    ...over,
  };
}

/** `n` consecutive days ending the day before `today`, oldest first. */
export function pastDays(today: DayString, n: number): DayString[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n));
}

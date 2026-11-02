import type { BaseRecord, Habit } from '@/core/db/types';
import { buildHabitInstance, habitInstanceId, isScheduled, refreshedSnapshot } from './instances';

const base: BaseRecord = {
  id: 'x',
  created_at: '2026-11-02T04:30:00.000Z',
  updated_at: '2026-11-02T04:30:00.000Z',
  deleted_at: null,
  schema_version: 1,
  hlc: '0',
};

const workout: Habit = {
  ...base,
  id: 'h-workout',
  title: 'Workout',
  stat: 'STR',
  difficulty: 'normal',
  schedule: [1, 3, 5], // Mon, Wed, Fri
  full_version: '30 min workout',
  min_version: '10 push-ups',
  measure: 'check',
  target_value: null,
  min_value: null,
  core: true,
  auto_source: 'none',
  linked_goal_type: null,
  linked_goal_id: null,
  skill_ids: [],
  status: 'active',
  planned_by: 'me',
  order: 0,
};

describe('quest instances', () => {
  it('uses the deterministic id habit_id:day', () => {
    expect(habitInstanceId('h-workout', '2026-11-02')).toBe('h-workout:2026-11-02');
    expect(buildHabitInstance(workout, '2026-11-02', base).id).toBe('h-workout:2026-11-02');
  });

  it('is scheduled only on its weekdays and only while active', () => {
    expect(isScheduled(workout, '2026-11-02')).toBe(true); // Monday
    expect(isScheduled(workout, '2026-11-03')).toBe(false); // Tuesday
    expect(isScheduled({ ...workout, status: 'paused' }, '2026-11-02')).toBe(false);
    expect(isScheduled({ ...workout, deleted_at: base.created_at }, '2026-11-02')).toBe(false);
  });

  it('freezes a snapshot of the habit', () => {
    const inst = buildHabitInstance(workout, '2026-11-02', base);
    expect(inst).toMatchObject({
      status: 'pending',
      title_snapshot: 'Workout',
      stat_snapshot: 'STR',
      difficulty_snapshot: 'normal',
      full_version_snapshot: '30 min workout',
      min_version_snapshot: '10 push-ups',
      core_snapshot: true,
      award_revision: 0,
    });
  });

  it('a pending instance takes edits, except the core flag', () => {
    const inst = buildHabitInstance(workout, '2026-11-02', base);
    const edited = {
      ...workout,
      title: 'Strength training',
      difficulty: 'hard' as const,
      core: false,
    };
    const snap = refreshedSnapshot(inst, edited);
    expect(snap?.title_snapshot).toBe('Strength training');
    expect(snap?.difficulty_snapshot).toBe('hard');
    expect(snap?.core_snapshot).toBe(true);
  });

  it('a completed instance keeps its snapshot', () => {
    const done = {
      ...buildHabitInstance(workout, '2026-11-02', base),
      status: 'done_full' as const,
    };
    expect(refreshedSnapshot(done, { ...workout, title: 'Changed' })).toBeNull();
  });

  it('reports no change when nothing relevant changed', () => {
    const inst = buildHabitInstance(workout, '2026-11-02', base);
    expect(refreshedSnapshot(inst, { ...workout, order: 5 })).toBeNull();
  });
});

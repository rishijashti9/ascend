import { renderHook } from '@testing-library/react';
import type { Habit, MainQuest, QuestInstance, Skill } from '@/core/db/types';
import { goalsStore } from '@/core/state/goals';
import { habitsStore } from '@/core/state/habits';
import { skillsStore } from '@/core/state/skills';
import type { TodayQuest } from '@/core/state/today';
import { useLinkNote } from './linkNote';

/** UX-3 (P4): every quest card can say why it matters — the goal it serves, the skills it builds. */
const base = { created_at: '', updated_at: '', deleted_at: null, schema_version: 1, hlc: 'x' };
const mq = { ...base, id: 'mq1', title: 'Core robotics skills' } as unknown as MainQuest;
const ros = { ...base, id: 'sk1', name: 'ROS 2' } as unknown as Skill;
const cpp = { ...base, id: 'sk2', name: 'C++' } as unknown as Skill;
const habit = (over: Partial<Habit>) =>
  ({
    ...base,
    id: 'h1',
    linked_goal_type: null,
    linked_goal_id: null,
    skill_ids: [],
    ...over,
  }) as Habit;
const daily = (over: Partial<QuestInstance> = {}): TodayQuest => ({
  instance: {
    id: 'i1',
    source_type: 'habit',
    source_id: 'h1',
    status: 'pending',
    ...over,
  } as QuestInstance,
  progress: 0,
  quest: null,
});

beforeEach(() => {
  goalsStore.setState({ mainQuests: [mq], milestones: [] } as never);
  skillsStore.setState({ skills: [ros, cpp] } as never);
});

const note = () => renderHook(() => useLinkNote()).result.current;

it('a daily quest linked to a main quest and skills says so', () => {
  habitsStore.setState({
    habits: [
      habit({ linked_goal_type: 'main_quest', linked_goal_id: 'mq1', skill_ids: ['sk1', 'sk2'] }),
    ],
  } as never);
  expect(note()(daily(), '2026-11-11')).toBe('For: Core robotics skills · Builds: ROS 2, C++');
});

it("the instance's own skill snapshot wins over today's habit (history stays as it was)", () => {
  habitsStore.setState({ habits: [habit({ skill_ids: ['sk1', 'sk2'] })] } as never);
  expect(note()(daily({ skill_ids_snapshot: ['sk2'] }), '2026-11-11')).toBe('Builds: C++');
});

it('nothing linked → no line (nothing invented); deleted goals and skills are left out', () => {
  habitsStore.setState({ habits: [habit({})] } as never);
  expect(note()(daily(), '2026-11-11')).toBeUndefined();
  goalsStore.setState({
    mainQuests: [{ ...mq, deleted_at: '2026-01-01' }],
    milestones: [],
  } as never);
  habitsStore.setState({
    habits: [habit({ linked_goal_type: 'main_quest', linked_goal_id: 'mq1' })],
  } as never);
  expect(note()(daily(), '2026-11-11')).toBeUndefined();
});

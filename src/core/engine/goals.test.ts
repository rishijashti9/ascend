import type { Milestone } from '@/core/db/types';
import { dreamProgress, mainQuestProgress, milestoneProgress, type GoalData } from './goals';

const empty: GoalData = {
  habits: [],
  quests: [],
  instances: [],
  bodyLogs: [],
  jobs: [],
  sessions: [],
};

type M = Parameters<typeof milestoneProgress>[0];
const ms = (over: Partial<M>): M => ({
  id: 'm1',
  status: 'active',
  target_type: 'manual',
  target_value: null,
  current_source: null,
  estimated_weekly_quests: null,
  ...over,
});

const done = (sourceId: string, n: number, status: 'done_full' | 'pending' = 'done_full') =>
  Array.from({ length: n }, (_, i) => ({
    id: `${sourceId}:${i}`,
    source_type: 'quest' as const,
    source_id: sourceId,
    status,
    deleted_at: null,
  }));

describe('milestoneProgress', () => {
  it('metric (weight down): progress from start toward target, from the latest body log', () => {
    const m = ms({
      target_type: 'metric',
      target_value: 70,
      current_source: { kind: 'body_metric', metric: 'weight', direction: 'down', start_value: 80 },
    });
    const logs = [
      { day: '2026-11-01', weight: 78, waist: null, deleted_at: null },
      { day: '2026-11-10', weight: 75, waist: null, deleted_at: null },
    ];
    expect(milestoneProgress(m, { ...empty, bodyLogs: logs })).toEqual({
      progress: 0.5,
      current: 75,
      reached: false,
    });
    const at = [{ day: '2026-12-01', weight: 69.5, waist: null, deleted_at: null }];
    expect(milestoneProgress(m, { ...empty, bodyLogs: at })).toMatchObject({
      progress: 1,
      reached: true,
    });
    expect(milestoneProgress(m, empty).progress).toBe(0); // no log yet = start value
  });

  it('count: completed linked quests ÷ target', () => {
    const m = ms({
      target_type: 'count',
      target_value: 6,
      current_source: { kind: 'linked_quests' },
    });
    const data: GoalData = {
      ...empty,
      quests: [{ id: 'mock', type: 'weekly', linked_goal_type: 'milestone', linked_goal_id: 'm1' }],
      instances: [...done('mock', 3), ...done('mock', 2, 'pending')],
    };
    expect(milestoneProgress(m, data)).toMatchObject({ progress: 0.5, current: 3 });
  });

  it('count: job applications that reached a stage', () => {
    const m = ms({
      target_type: 'count',
      target_value: 4,
      current_source: { kind: 'job_applications', stage: 'applied' },
    });
    const job = (stages: ('saved' | 'applied' | 'interview')[]) => ({
      stage: stages.at(-1) ?? 'saved',
      stage_history: stages.map((stage) => ({ stage, at: '2026-11-01T00:00:00.000Z' })),
      deleted_at: null,
    });
    const jobs = [job(['saved']), job(['saved', 'applied']), job(['applied', 'interview'])];
    expect(milestoneProgress(m, { ...empty, jobs }).current).toBe(2);
  });

  it('manual: completed linked weekly quests ÷ estimate, capped at 90% until done', () => {
    const m = ms({ estimated_weekly_quests: 4 });
    const data: GoalData = {
      ...empty,
      quests: [{ id: 'w', type: 'weekly', linked_goal_type: 'milestone', linked_goal_id: 'm1' }],
      instances: done('w', 2),
    };
    expect(milestoneProgress(m, data)).toMatchObject({ progress: 0.5, reached: false });
    const all = { ...data, instances: done('w', 6) };
    expect(milestoneProgress(m, all)).toMatchObject({ progress: 0.9, reached: false });
    expect(milestoneProgress({ ...m, status: 'done' }, all).progress).toBe(1);
  });
});

describe('mainQuestProgress and dreamProgress', () => {
  const milestone = (status: Milestone['status'], size_weight: number) => ({
    main_quest_id: 'q1',
    status,
    size_weight,
  });

  it('main quest = done milestones by weight ÷ total weight (archived ignored)', () => {
    const list = [
      milestone('done', 2),
      milestone('active', 1),
      milestone('upcoming', 1),
      milestone('archived', 5),
    ];
    expect(mainQuestProgress({ id: 'q1', status: 'active' }, list)).toBe(0.5);
    expect(mainQuestProgress({ id: 'q1', status: 'done' }, list)).toBe(1);
    expect(mainQuestProgress({ id: 'q1', status: 'active' }, [])).toBe(0);
  });

  it('dream = average of active and finished main quests', () => {
    const quests = [
      { id: 'a', dream_id: 'd', status: 'active' as const },
      { id: 'b', dream_id: 'd', status: 'done' as const },
      { id: 'c', dream_id: 'd', status: 'paused' as const },
    ];
    const p = (id: string) => ({ a: 0.5, b: 1, c: 0 })[id] ?? 0;
    expect(dreamProgress({ id: 'd', status: 'active' }, quests, p)).toBe(0.75);
  });
});

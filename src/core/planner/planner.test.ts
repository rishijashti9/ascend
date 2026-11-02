import type { Dream, Habit, MainQuest, Milestone, Quest } from '@/core/db/types';
import { addDays } from '@/core/time';
import { STARTER_HABITS, habitFieldsOf } from '@/data/starter';
import {
  analyze,
  defaultAnswers,
  interviewFor,
  matchTemplate,
  planMainQuest,
  planNextMilestone,
  planStatusChange,
  type PlannerState,
} from '.';

const STUDY = STARTER_HABITS.find((h) => h.key === 'ai-study') ?? STARTER_HABITS[0];
if (!STUDY) throw new Error('starter habits missing');

const base = (id: string) => ({
  id,
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
  deleted_at: null,
  schema_version: 1,
  hlc: '0',
});

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  ...base(id),
  ...habitFieldsOf(STUDY),
  schedule: [0, 1, 2, 3, 4, 5, 6],
  skill_ids: [],
  status: 'active',
  planned_by: 'me',
  order: 0,
  linked_goal_type: null,
  linked_goal_id: null,
  ...over,
});

const mainQuest = (over: Partial<MainQuest> = {}): MainQuest => ({
  ...base('mq'),
  dream_id: 'd',
  title: 'MS in AI/Robotics in Germany',
  why: '',
  stat: 'INT',
  target_date: null,
  status: 'active',
  order: 0,
  planner_context: {},
  last_checkin_day: null,
  ...over,
});

const milestone = (id: string, over: Partial<Milestone> = {}): Milestone => ({
  ...base(id),
  main_quest_id: 'mq',
  title: id,
  size_weight: 1,
  target_type: 'manual',
  target_value: null,
  current_source: null,
  estimated_weekly_quests: 4,
  target_date: null,
  status: 'upcoming',
  done_at: null,
  planner_context: {},
  order: 0,
  ...over,
});

const state = (over: Partial<PlannerState> = {}): PlannerState => ({
  today: '2026-11-04',
  weekStart: '2026-11-02',
  mainQuests: [mainQuest()],
  milestones: [],
  habits: [],
  quests: [],
  instances: [],
  ...over,
});

describe('matchTemplate', () => {
  it('picks a template from the goal title, Rishi’s goals included', () => {
    expect(matchTemplate('MS in AI/Robotics in Germany').id).toBe('university');
    expect(matchTemplate('Core robotics skills').id).toBe('skill');
    expect(matchTemplate('Robotics portfolio').id).toBe('portfolio');
    expect(matchTemplate('IELTS band 7.5').id).toBe('exam');
    expect(matchTemplate('Lose 6 kg').id).toBe('fitness');
    expect(matchTemplate('Something completely new').id).toBe('skill');
    expect(matchTemplate('Anything', { template: 'jobs' }).id).toBe('jobs');
  });
});

describe('interview', () => {
  it('asks at most 6 questions and never repeats answered ones', () => {
    const t = matchTemplate('MS in Germany');
    const first = interviewFor(t, mainQuest());
    expect(first.length).toBeLessThanOrEqual(6);
    expect(first.map((q) => q.id)).toContain('aps_status');
    const later = interviewFor(
      t,
      mainQuest({ planner_context: { aps_status: 'done', intake: 'winter' } }),
    );
    expect(later.map((q) => q.id)).not.toContain('aps_status');
    expect(later.map((q) => q.id)).not.toContain('intake');
  });

  it('default answers make “confirm everything” possible', () => {
    const qs = interviewFor(
      matchTemplate('Core robotics skills'),
      mainQuest({ title: 'Core robotics skills' }),
    );
    expect(defaultAnswers(qs)).toMatchObject({ level: 'beginner', minutes_per_day: 60 });
  });
});

describe('analyze', () => {
  it('reports daily load, completion rate and conflicts in plain words', () => {
    const days = Array.from({ length: 12 }, (_, i) => addDays('2026-10-23', i)); // inside the 14-day window
    const a = analyze(
      state({
        habits: [habit('h1', { target_value: 400 })],
        instances: days.map((day, i) => ({
          source_type: 'habit',
          status: i < 6 ? 'done_full' : 'missed',
          day,
          deleted_at: null,
        })),
      }),
    );
    expect(a.dailyLoadMin).toBe(400);
    expect(a.completionRate).toBe(0.5);
    expect(a.neglectedStat).toBe('STR');
    expect(a.conflicts.join(' ')).toMatch(/about 6.7 hours/);
    expect(a.conflicts.join(' ')).toMatch(/Recent completion is 50%/);
  });
});

describe('planMainQuest', () => {
  it('university plan: skips finished steps, dates milestones, plans this week, adds a daily quest', () => {
    const goal = mainQuest();
    const plan = planMainQuest(state(), goal, {
      aps_status: 'done',
      language_test: 'done',
      universities: 4,
      minutes_per_day: 45,
    });
    const ms = plan.items.filter((i) => i.kind === 'milestone.create');
    const titles = ms.map((i) => (i.kind === 'milestone.create' ? i.data.title : ''));
    expect(titles).not.toContain('APS certificate');
    expect(titles).toContain('Applications submitted (4)');
    expect(ms.map((i) => (i.kind === 'milestone.create' ? i.data.status : ''))).toEqual([
      'active',
      ...Array(ms.length - 1).fill('upcoming'),
    ]);
    const weekly = plan.items.filter((i) => i.kind === 'quest.create');
    expect(weekly).toHaveLength(2); // the first milestone has two weekly ideas
    expect(
      weekly.every(
        (i) => i.kind === 'quest.create' && i.data.linked_goal_id === `ref:${ms[0]?.id}`,
      ),
    ).toBe(true);
    const daily = plan.items.find((i) => i.kind === 'habit.create');
    expect(daily?.kind === 'habit.create' && daily.data).toMatchObject({
      title: 'Application work',
      target_value: 45,
      min_value: 10,
    });
    expect(plan.summary).toMatch(/milestones, 2 weekly quests for this week, 1 new daily quest/);
  });

  it('squeezes milestones into the deadline and says so', () => {
    const plan = planMainQuest(state(), mainQuest({ target_date: '2026-12-15' }), {});
    const last = plan.items.filter((i) => i.kind === 'milestone.create').at(-1);
    expect(last?.kind === 'milestone.create' && (last.data.target_date ?? '') <= '2026-12-15').toBe(
      true,
    );
    expect(plan.analysis.conflicts.join(' ')).toMatch(/squeezed/);
  });

  it('links an existing similar daily quest instead of adding another', () => {
    const plan = planMainQuest(
      state({ habits: [habit('study', { title: 'AI & Robotics study (phone-free)' })] }),
      mainQuest({ title: 'Core robotics skills' }),
      {},
    );
    expect(plan.items.some((i) => i.kind === 'habit.create')).toBe(false);
    const link = plan.items.find((i) => i.kind === 'habit.update');
    expect(link?.kind === 'habit.update' && link.changes).toEqual({
      linked_goal_type: 'main_quest',
      linked_goal_id: 'mq',
    });
  });

  it('re-planning does not duplicate milestones or this week’s quests', () => {
    const goal = mainQuest({ title: 'Core robotics skills' });
    const first = planMainQuest(state(), goal, { level: 'some' });
    const titles = first.items.flatMap((i) =>
      i.kind === 'milestone.create' ? [i.data.title] : [],
    );
    const existing = titles.map((t, n) =>
      milestone(`m${n}`, { title: t, status: n === 0 ? 'active' : 'upcoming' }),
    );
    const weekly: Quest = {
      ...base('wq'),
      type: 'weekly',
      title: 'x',
      stat: 'INT',
      difficulty: 'normal',
      measure: 'check',
      target_value: null,
      min_value: null,
      skill_ids: [],
      week_start: '2026-11-02',
      due_day: null,
      status: 'active',
      planned_by: 'rules',
      carried_over_from: null,
      repairs_day: null,
      order: 0,
      linked_goal_type: 'milestone',
      linked_goal_id: 'm0',
    };
    const again = planMainQuest(state({ milestones: existing, quests: [weekly] }), goal, {
      level: 'some',
    });
    expect(
      again.items.filter((i) => i.kind === 'milestone.create' || i.kind === 'quest.create'),
    ).toEqual([]);
  });

  it('suggests trimming the biggest non-core quest when the day gets too full (unticked by default)', () => {
    const plan = planMainQuest(
      state({ habits: [habit('gd', { title: 'Game dev study', target_value: 340, core: false })] }),
      mainQuest({ title: 'IELTS 7.5' }),
      { minutes_per_day: 90 },
    );
    const trim = plan.items.find((i) => i.kind === 'habit.update' && i.changes.target_value);
    expect(trim).toMatchObject({ selected: false, changes: { target_value: 255 } });
  });
});

describe('follow-ups', () => {
  it('pausing a main quest proposes pausing its linked daily quests and archiving this week’s quests', () => {
    const s = state({
      habits: [
        habit('h', { linked_goal_type: 'main_quest', linked_goal_id: 'mq' }),
        habit('other'),
      ],
      quests: [],
    });
    const items = planStatusChange(s, { type: 'main_quest', record: mainQuest() }, 'paused');
    expect(items.map((i) => i.kind)).toEqual(['habit.pause']);
    const resume = planStatusChange(
      {
        ...s,
        habits: [
          habit('h', { status: 'paused', linked_goal_type: 'main_quest', linked_goal_id: 'mq' }),
        ],
      },
      { type: 'main_quest', record: mainQuest() },
      'active',
    );
    expect(resume.map((i) => i.kind)).toEqual(['habit.restore']);
  });

  it('archiving a dream proposes archiving its active main quests too', () => {
    const dream = {
      ...base('d'),
      title: 'D',
      why: '',
      status: 'active',
      order: 0,
      planner_context: {},
    } as Dream;
    const items = planStatusChange(state(), { type: 'dream', record: dream }, 'archived', [
      mainQuest(),
    ]);
    expect(items[0]).toMatchObject({ kind: 'mainQuest.setStatus', status: 'archived' });
  });

  it('finishing a milestone starts the next one and plans its week', () => {
    const done = milestone('a', { status: 'done', order: 0 });
    const next = milestone('b', { status: 'upcoming', order: 1 });
    const items = planNextMilestone(
      state({ milestones: [done, next] }),
      done,
      mainQuest({ title: 'Core robotics skills' }),
    );
    expect(items[0]).toMatchObject({
      kind: 'milestone.setStatus',
      milestoneId: 'b',
      status: 'active',
    });
    expect(
      items.slice(1).every((i) => i.kind === 'quest.create' && i.data.linked_goal_id === 'b'),
    ).toBe(true);
    expect(items.length).toBeGreaterThan(1);
  });
});

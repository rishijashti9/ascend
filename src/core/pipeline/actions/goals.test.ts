import type { Dream, MainQuest, Milestone } from '@/core/db/types';
import { createTestDb } from '@/test/testDb';
import { RuleError, subscribe, clearSubscribers, type DomainEvents } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
let changes: DomainEvents['GoalChanged'][];

beforeEach(async () => {
  t = await createTestDb();
  changes = [];
  subscribe('GoalChanged', (p) => {
    changes.push(p);
  });
});
afterEach(async () => {
  clearSubscribers();
  await t.cleanup();
});

async function tree() {
  const dream = (
    await t.run<Dream>({ type: 'dream.create', payload: { title: 'Robotics engineer' } })
  ).value as Dream;
  const quest = (
    await t.run<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: dream.id, title: 'MS in Germany', stat: 'INT' },
    })
  ).value as MainQuest;
  const milestone = (
    await t.run<Milestone>({
      type: 'milestone.create',
      payload: {
        main_quest_id: quest.id,
        title: 'IELTS 7.5',
        target_type: 'manual',
        estimated_weekly_quests: 8,
        target_date: '2027-02-01',
      },
    })
  ).value as Milestone;
  return { dream, quest, milestone };
}

describe('goal actions', () => {
  it('creates dream → main quest → milestone; creating is a meaningful change', async () => {
    const { dream, quest, milestone } = await tree();
    expect(quest.dream_id).toBe(dream.id);
    expect(milestone).toMatchObject({ main_quest_id: quest.id, status: 'active', size_weight: 1 });
    expect(changes.map((c) => [c.goalType, c.change, c.meaningful])).toEqual([
      ['dream', 'created', true],
      ['main_quest', 'created', true],
      ['milestone', 'created', true],
    ]);
  });

  it('title / why edits are not meaningful; deadline and target changes are', async () => {
    const { quest, milestone } = await tree();
    changes = [];
    await t.run({
      type: 'mainQuest.update',
      payload: { id: quest.id, changes: { title: 'MS (TUM)' } },
    });
    await t.run({
      type: 'mainQuest.update',
      payload: { id: quest.id, changes: { why: 'Robots' } },
    });
    await t.run({
      type: 'mainQuest.update',
      payload: { id: quest.id, changes: { target_date: '2027-10-01' } },
    });
    await t.run({
      type: 'milestone.update',
      payload: { id: milestone.id, changes: { estimated_weekly_quests: 10 } },
    });
    await t.run({
      type: 'milestone.update',
      payload: { id: milestone.id, changes: { target_date: '2027-03-01' } },
    });
    expect(changes.map((c) => c.meaningful)).toEqual([false, false, true, false, true]);
  });

  it('pause, finish, archive and restore — never deleted', async () => {
    const { dream, quest } = await tree();
    await t.run({ type: 'mainQuest.setStatus', payload: { id: quest.id, status: 'paused' } });
    await t.run({ type: 'mainQuest.setStatus', payload: { id: quest.id, status: 'archived' } });
    await t.run({ type: 'mainQuest.setStatus', payload: { id: quest.id, status: 'active' } });
    await t.run({ type: 'dream.setStatus', payload: { id: dream.id, status: 'done' } });
    expect((await t.db.main_quests.get(quest.id))?.status).toBe('active');
    expect((await t.db.dreams.get(dream.id))?.status).toBe('done');
  });

  it('marking a milestone done records when and emits MilestoneDone', async () => {
    const { milestone } = await tree();
    const done: string[] = [];
    subscribe('MilestoneDone', (p) => {
      done.push(p.milestoneId);
    });
    await t.run({ type: 'milestone.setStatus', payload: { id: milestone.id, status: 'done' } });
    expect((await t.db.milestones.get(milestone.id))?.done_at).not.toBeNull();
    expect(done).toEqual([milestone.id]);
  });

  it('checks metric milestones make sense', async () => {
    const { quest } = await tree();
    const metric = (target: number) =>
      t.run({
        type: 'milestone.create',
        payload: {
          main_quest_id: quest.id,
          title: 'Weight',
          target_type: 'metric',
          target_value: target,
          current_source: {
            kind: 'body_metric',
            metric: 'weight',
            direction: 'down',
            start_value: 80,
          },
        },
      });
    await expect(metric(85)).rejects.toThrow(RuleError);
    await expect(metric(72)).resolves.toBeDefined();
    await expect(
      t.run({
        type: 'milestone.create',
        payload: { main_quest_id: quest.id, title: 'Count', target_type: 'count' },
      }),
    ).rejects.toThrow(/needs a target value/);
  });

  it('saves planner answers on the goal, merged with earlier ones', async () => {
    const { quest } = await tree();
    const save = (answers: object) =>
      t.run({
        type: 'goal.saveContext',
        payload: { goalType: 'main_quest', id: quest.id, answers },
      });
    await save({ level: 'beginner' });
    await save({ hours: 2 });
    expect((await t.db.main_quests.get(quest.id))?.planner_context).toEqual({
      level: 'beginner',
      hours: 2,
    });
  });

  it('a main quest needs an existing dream', async () => {
    await expect(
      t.run({
        type: 'mainQuest.create',
        payload: { dream_id: 'nope', title: 'X', stat: 'INT' },
      }),
    ).rejects.toThrow(/Dream not found/);
  });
});

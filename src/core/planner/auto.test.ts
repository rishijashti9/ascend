import type { Dream, MainQuest, Milestone } from '@/core/db/types';
import { createTestDb } from '@/test/testDb';
import { reactToGoalChange } from '.';

let t: Awaited<ReturnType<typeof createTestDb>>;
let goal: MainQuest;
let first: Milestone;
let second: Milestone;

beforeEach(async () => {
  t = await createTestDb();
  const d = (await t.run<Dream>({ type: 'dream.create', payload: { title: 'D' } })).value as Dream;
  goal = (
    await t.run<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: d.id, title: 'Core robotics skills', stat: 'INT' },
    })
  ).value as MainQuest;
  const ms = async (title: string, status: 'active' | 'upcoming') =>
    (
      await t.run<Milestone>({
        type: 'milestone.create',
        payload: { main_quest_id: goal.id, title, status, estimated_weekly_quests: 4 },
      })
    ).value as Milestone;
  first = await ms('Core robotics skills: guided practice', 'active');
  second = await ms('Core robotics skills: first small project', 'upcoming');
  await t.run({ type: 'milestone.setStatus', payload: { id: first.id, status: 'done' } });
});
afterEach(() => t.cleanup());

const done = () =>
  reactToGoalChange(t.db, {
    goalType: 'milestone',
    goalId: first.id,
    change: 'done',
    meaningful: true,
    source: 'ui',
  });

describe('after a milestone is done', () => {
  it('proposes starting the next milestone and its week (Auto-plan off)', async () => {
    await done();
    const p = (await t.db.plan_proposals.where('status').equals('pending').toArray())[0];
    expect(p?.trigger).toBe('milestone_done');
    expect((await t.db.milestones.get(second.id))?.status).toBe('upcoming');
  });

  it('applies it straight away with Undo when Auto-plan is on', async () => {
    await t.run({ type: 'settings.update', payload: { auto_plan: true } });
    await done();
    expect((await t.db.milestones.get(second.id))?.status).toBe('active');
    const weekly = (await t.db.quests.toArray()).filter(
      (q) => q.type === 'weekly' && q.linked_goal_id === second.id,
    );
    expect(weekly.length).toBeGreaterThan(0);
    const history = (await t.db.plan_history.toArray())[0];
    expect(history?.trigger).toBe('milestone_done');
    await t.run({ type: 'plan.undo', payload: { id: history?.id } });
    expect((await t.db.milestones.get(second.id))?.status).toBe('upcoming');
  });
});

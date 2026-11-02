import type { Dream, MainQuest, PlanProposal } from '@/core/db/types';
import { createTestDb } from '@/test/testDb';

let t: Awaited<ReturnType<typeof createTestDb>>;
let goalId: string;

beforeEach(async () => {
  t = await createTestDb();
  const d = (await t.run<Dream>({ type: 'dream.create', payload: { title: 'D' } })).value as Dream;
  goalId = (
    (
      await t.run<MainQuest>({
        type: 'mainQuest.create',
        payload: { dream_id: d.id, title: 'Core robotics skills', stat: 'INT' },
      })
    ).value as MainQuest
  ).id;
});
afterEach(() => t.cleanup());

const propose = async (answers: object = {}) =>
  (
    await t.run<PlanProposal>({
      type: 'plan.propose',
      payload: {
        goal_type: 'main_quest',
        goal_id: goalId,
        trigger: 'replan',
        summary: 'A plan',
        items: [{ id: 'i1', kind: 'quest.create', reason: 'r', selected: true, data: {} }],
        answers,
      },
    })
  ).value as PlanProposal;

describe('plan.propose / plan.reject', () => {
  it('saves a pending proposal and remembers the interview answers on the goal', async () => {
    const p = await propose({ level: 'some', minutes_per_day: 90 });
    expect(p).toMatchObject({ status: 'pending', source: 'rules', goal_id: goalId });
    expect((await t.db.main_quests.get(goalId))?.planner_context).toEqual({
      level: 'some',
      minutes_per_day: 90,
    });
  });

  it('a newer plan replaces the older pending one', async () => {
    const first = await propose();
    const second = await propose();
    expect((await t.db.plan_proposals.get(first.id))?.status).toBe('rejected');
    expect((await t.db.plan_proposals.get(second.id))?.status).toBe('pending');
  });

  it('"Not now" sets it aside', async () => {
    const p = await propose();
    await t.run({ type: 'plan.reject', payload: { id: p.id } });
    expect((await t.db.plan_proposals.get(p.id))?.status).toBe('rejected');
    await expect(t.run({ type: 'plan.reject', payload: { id: p.id } })).rejects.toThrow(
      /no longer waiting/,
    );
  });
});

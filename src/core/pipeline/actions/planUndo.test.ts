import type { Dream, Habit, MainQuest, PlanHistory, PlanProposal } from '@/core/db/types';
import { ensureInstancesForDay } from '@/core/pipeline';
import {
  loadPlannerState,
  planMainQuest,
  reactToGoalChange,
  type ProposalItem,
} from '@/core/planner';
import { createTestDb } from '@/test/testDb';

let t: Awaited<ReturnType<typeof createTestDb>>;
let goal: MainQuest;

beforeEach(async () => {
  t = await createTestDb();
  const d = (await t.run<Dream>({ type: 'dream.create', payload: { title: 'Robotics' } }))
    .value as Dream;
  goal = (
    await t.run<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: d.id, title: 'Core robotics skills', stat: 'INT' },
    })
  ).value as MainQuest;
});
afterEach(() => t.cleanup());

async function applyPlan(): Promise<PlanHistory> {
  const plan = planMainQuest(await loadPlannerState(t.db), goal, { level: 'some' });
  const p = (
    await t.run<PlanProposal>({
      type: 'plan.propose',
      payload: {
        goal_type: 'main_quest',
        goal_id: goal.id,
        trigger: 'replan',
        summary: plan.summary,
        items: plan.items,
      },
    })
  ).value as PlanProposal;
  return (
    await t.run<PlanHistory>({
      type: 'plan.apply',
      payload: { id: p.id, selected: (p.items as ProposalItem[]).map((i) => i.id) },
    })
  ).value as PlanHistory;
}

const live = async () => ({
  milestones: (await t.db.milestones.toArray()).filter((m) => !m.deleted_at).length,
  quests: (await t.db.quests.toArray()).filter((q) => !q.deleted_at).length,
  habits: (await t.db.habits.toArray()).filter((h) => !h.deleted_at).length,
  instances: (await t.db.quest_instances.toArray()).filter((i) => !i.deleted_at).length,
});

describe('plan.undo', () => {
  it('removes everything the plan added (history kept, nothing left open)', async () => {
    const before = await live();
    const history = await applyPlan();
    expect((await live()).milestones).toBeGreaterThan(0);
    await t.run({ type: 'plan.undo', payload: { id: history.id } });
    expect(await live()).toEqual(before);
    expect((await t.db.plan_history.get(history.id))?.undone_at).not.toBeNull();
    expect(await t.db.milestones.count()).toBeGreaterThan(0); // soft-deleted, still in history
  });

  it('puts changed records back exactly, and today’s quest returns after an undone pause', async () => {
    await applyPlan();
    await ensureInstancesForDay(t.db, '2026-11-02');
    const habit = (await t.db.habits.toArray()).find((h) => !h.deleted_at) as Habit;
    await t.run({ type: 'mainQuest.setStatus', payload: { id: goal.id, status: 'paused' } });
    await reactToGoalChange(t.db, {
      goalType: 'main_quest',
      goalId: goal.id,
      change: 'paused',
      meaningful: true,
      source: 'ui',
    });
    const p = (
      await t.db.plan_proposals.where('status').equals('pending').toArray()
    )[0] as PlanProposal;
    const pauseOnly = (p.items as ProposalItem[])
      .filter((i) => i.kind === 'habit.pause')
      .map((i) => i.id);
    const history = (
      await t.run<PlanHistory>({ type: 'plan.apply', payload: { id: p.id, selected: pauseOnly } })
    ).value as PlanHistory;
    expect((await t.db.habits.get(habit.id))?.status).toBe('paused');
    expect((await t.db.quest_instances.get(`${habit.id}:2026-11-02`))?.deleted_at).not.toBeNull();

    await t.run({ type: 'plan.undo', payload: { id: history.id } });
    expect((await t.db.habits.get(habit.id))?.status).toBe('active');
    expect((await t.db.quest_instances.get(`${habit.id}:2026-11-02`))?.deleted_at).toBeNull();
  });

  it('refuses when something from the plan was changed afterwards, and can only run once', async () => {
    const history = await applyPlan();
    const weekly = (await t.db.quests.toArray()).find((q) => q.type === 'weekly');
    await t.run({
      type: 'quest.complete',
      payload: { instanceId: `${weekly?.id}:2026-11-02`, version: 'full' },
    });
    await expect(t.run({ type: 'plan.undo', payload: { id: history.id } })).rejects.toThrow(
      /changed after this plan/,
    );

    const second = await applyPlan(); // nothing new to add except the daily quest is already there
    await t.run({ type: 'plan.undo', payload: { id: second.id } });
    await expect(t.run({ type: 'plan.undo', payload: { id: second.id } })).rejects.toThrow(
      /already undone/,
    );
  });
});

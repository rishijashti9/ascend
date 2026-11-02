import type { Dream, Habit, MainQuest, PlanHistory, PlanProposal } from '@/core/db/types';
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
  t = await createTestDb(); // Monday 2026-11-02
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

async function proposePlan(
  answers: Record<string, unknown> = { level: 'some', minutes_per_day: 45 },
) {
  const plan = planMainQuest(await loadPlannerState(t.db), goal, answers);
  return (
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
}

const apply = async (p: PlanProposal, selected?: string[], edits = {}) =>
  (
    await t.run<PlanHistory>({
      type: 'plan.apply',
      payload: {
        id: p.id,
        selected: selected ?? (p.items as ProposalItem[]).map((i) => i.id),
        edits,
      },
    })
  ).value as PlanHistory;

describe('plan.apply', () => {
  it('creates milestones, links this week’s quests to the new milestone, adds the daily quest, records history', async () => {
    const p = await proposePlan();
    const history = await apply(p);

    const milestones = (await t.db.milestones.toArray()).sort((a, b) => a.order - b.order);
    expect(milestones.map((m) => m.status)).toEqual(['active', 'upcoming', 'upcoming']);
    const weekly = (await t.db.quests.toArray()).filter((q) => q.type === 'weekly');
    expect(weekly.length).toBeGreaterThan(0);
    expect(
      weekly.every((q) => q.linked_goal_id === milestones[0]?.id && q.planned_by === 'rules'),
    ).toBe(true);
    const habits = await t.db.habits.toArray();
    expect(habits).toEqual([
      expect.objectContaining({
        title: 'Core robotics skills practice',
        planned_by: 'rules',
        linked_goal_id: goal.id,
        target_value: 45,
      }),
    ]);

    expect((await t.db.plan_proposals.get(p.id))?.status).toBe('applied');
    expect(history.changes.every((c) => c.before === null && c.after !== null)).toBe(true);
    expect(history.changes.map((c) => c.entity)).toEqual(
      expect.arrayContaining(['milestones', 'quests', 'quest_instances', 'habits']),
    );
  });

  it('applies only ticked items, with edits; quests of an unticked milestone are skipped', async () => {
    const p = await proposePlan();
    const items = p.items as ProposalItem[];
    const firstMilestone = items.find((i) => i.kind === 'milestone.create');
    const habit = items.find((i) => i.kind === 'habit.create');
    const selected = items.filter((i) => i !== firstMilestone).map((i) => i.id);
    await apply(p, selected, { [habit?.id ?? '']: { title: 'ROS 2 practice', target_value: 30 } });

    expect(await t.db.milestones.count()).toBe(2);
    expect((await t.db.quests.toArray()).filter((q) => q.type === 'weekly')).toHaveLength(0);
    expect(await t.db.habits.toArray()).toEqual([
      expect.objectContaining({ title: 'ROS 2 practice', target_value: 30, min_value: 10 }),
    ]);
  });

  it('a plan can only be applied once', async () => {
    const p = await proposePlan();
    await apply(p);
    await expect(apply(p)).rejects.toThrow(/no longer waiting/);
  });
});

describe('status changes propose what to do with linked quests', () => {
  it('pausing a main quest proposes pausing its daily quest; applying records before/after', async () => {
    await apply(await proposePlan());
    await t.run({ type: 'mainQuest.setStatus', payload: { id: goal.id, status: 'paused' } });
    await reactToGoalChange(t.db, {
      goalType: 'main_quest',
      goalId: goal.id,
      change: 'paused',
      meaningful: true,
      source: 'ui',
    });

    const proposal = (await t.db.plan_proposals.where('status').equals('pending').toArray())[0];
    expect(proposal?.trigger).toBe('status:paused');
    const kinds = (proposal?.items as ProposalItem[]).map((i) => i.kind);
    expect(kinds).toContain('habit.pause');
    expect(kinds).toContain('quest.archive');

    const history = await apply(proposal as PlanProposal);
    const habit = (await t.db.habits.toArray())[0] as Habit;
    expect(habit.status).toBe('paused');
    const change = history.changes.find((c) => c.entity === 'habits');
    expect((change?.before as Habit).status).toBe('active');
    expect((change?.after as Habit).status).toBe('paused');
  });

  it('changes made by an applied plan do not trigger the planner again', async () => {
    await reactToGoalChange(t.db, {
      goalType: 'main_quest',
      goalId: goal.id,
      change: 'paused',
      meaningful: true,
      source: 'planner',
    });
    expect(await t.db.plan_proposals.count()).toBe(0);
  });
});

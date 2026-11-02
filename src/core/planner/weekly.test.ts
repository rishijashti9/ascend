import type { Dream, MainQuest, PlanHistory, PlanProposal, Quest } from '@/core/db/types';
import { newBase } from '@/core/pipeline';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { loadPlannerState, planMainQuest, planWeek, runWeeklyPlan, type ProposalItem } from '.';

let t: Awaited<ReturnType<typeof createTestDb>>;
let goal: MainQuest;

beforeEach(async () => {
  t = await createTestDb(); // Monday 2026-11-02
  await t.db.profile.put({
    ...newBase('profile'),
    name: 'Rishi',
    start_day: '2026-11-02',
    onboarded_at: '2026-11-02T00:00:00.000Z',
    display_title: null,
  });
  const d = (await t.run<Dream>({ type: 'dream.create', payload: { title: 'Robotics' } }))
    .value as Dream;
  goal = (
    await t.run<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: d.id, title: 'Core robotics skills', stat: 'INT' },
    })
  ).value as MainQuest;
  // Plan the goal: milestones + this week's quests.
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
  await t.run({
    type: 'plan.apply',
    payload: { id: p.id, selected: (p.items as ProposalItem[]).map((i) => i.id) },
  });
});
afterEach(() => t.cleanup());

const weekly = async (week: string) =>
  (await t.db.quests.toArray()).filter(
    (q) => q.type === 'weekly' && q.week_start === week && !q.deleted_at,
  );

async function nextWeek() {
  setNow(ist(2026, 11, 9, 10));
  await t.run({ type: 'day.rollover', payload: {} });
  await runWeeklyPlan(t.db);
}

describe('weekly generation', () => {
  it('closes last week’s unfinished quests (no penalty) and carries them over with new steps', async () => {
    const last = await weekly('2026-11-02');
    expect(last.length).toBeGreaterThan(1);
    const done = last[0] as Quest;
    await t.run({
      type: 'quest.complete',
      payload: { instanceId: `${done.id}:2026-11-02`, version: 'full' },
    });

    await nextWeek();
    const closed = await t.db.quests.get((last[1] as Quest).id);
    expect(closed?.status).toBe('not_done');
    const xp = await t.db.xp_events.toArray();
    expect(xp.every((e) => e.base_amount > 0)).toBe(true); // nothing taken away

    const now = await weekly('2026-11-09');
    const carried = now.filter((q) => q.carried_over_from);
    expect(carried.map((q) => q.carried_over_from).sort()).toEqual(
      last
        .slice(1)
        .map((q) => q.id)
        .sort(),
    );
    expect(now.length).toBeLessThanOrEqual(5);
    expect(now.every((q) => q.planned_by === 'rules')).toBe(true);
  });

  it('runs once per week, and the week can be undone from Plan history', async () => {
    await nextWeek();
    const count = (await weekly('2026-11-09')).length;
    await runWeeklyPlan(t.db); // app opened again the same week
    expect((await weekly('2026-11-09')).length).toBe(count);

    const history = (await t.db.plan_history.toArray()).find(
      (h) => h.trigger === 'weekly:2026-11-09',
    ) as PlanHistory;
    expect(history.summary).toMatch(/^This week’s quests: \d+ \(\d+ carried over\)/);
    await t.run({ type: 'plan.undo', payload: { id: history.id } });
    expect(await weekly('2026-11-09')).toEqual([]);
  });

  it('a paused goal gets nothing new and its old quests are not carried over', async () => {
    await t.run({ type: 'mainQuest.setStatus', payload: { id: goal.id, status: 'paused' } });
    setNow(ist(2026, 11, 9, 10));
    await t.run({ type: 'day.rollover', payload: {} });
    expect(planWeek(await loadPlannerState(t.db))).toEqual([]);
  });

  it('does nothing before onboarding', async () => {
    await t.db.profile.clear();
    setNow(ist(2026, 11, 9, 10));
    await runWeeklyPlan(t.db);
    expect(await weekly('2026-11-09')).toEqual([]);
  });
});

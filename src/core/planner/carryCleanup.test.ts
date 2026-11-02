import type { Dream, MainQuest, PlanHistory, PlanProposal, Quest } from '@/core/db/types';
import { newBase } from '@/core/pipeline';
import { cleanupTrigger } from '@/core/pipeline/actions/carryCleanup';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { loadPlannerState, planMainQuest, planWeek, runWeeklyPlan, type ProposalItem } from '.';

/**
 * Rishi's change (task 5.4b): a weekly quest finished after the weekly review loses its
 * carried-over copy in next week's plan — only while that copy is untouched — with Undo.
 */
let t: Awaited<ReturnType<typeof createTestDb>>;
let original: Quest;
let copy: Quest;

const NEXT = '2026-11-09';
const live = async (id: string) => {
  const q = await t.db.quests.get(id);
  return q && !q.deleted_at ? q : undefined;
};
const cleanups = async () =>
  (await t.db.plan_history.toArray()).filter((h) => h.trigger === cleanupTrigger(original.id));
const inst = (q: Quest) => `${q.id}:${q.week_start ?? ''}`;

async function finish(q: Quest) {
  if (q.measure === 'check')
    return t.run({ type: 'quest.complete', payload: { instanceId: inst(q), version: 'full' } });
  return t.run({
    type: 'quest.logProgress',
    payload: { instanceId: inst(q), amount: q.target_value ?? 1 },
  });
}
const untick = (q: Quest) => t.run({ type: 'quest.untick', payload: { instanceId: inst(q) } });

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
  const goal = (
    await t.run<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: d.id, title: 'Core robotics skills', stat: 'INT' },
    })
  ).value as MainQuest;
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

  // Saturday: the weekly review plans next week ahead, carrying this week's open quests.
  setNow(ist(2026, 11, 7, 18));
  const items = planWeek({ ...(await loadPlannerState(t.db)), weekStart: NEXT }).filter(
    (i) => i.kind === 'quest.create',
  );
  await t.run({ type: 'plan.weekly', payload: { week_start: NEXT, items } });
  const all = await t.db.quests.toArray();
  const carried = all.find((q) => q.week_start === NEXT && q.carried_over_from);
  if (!carried?.carried_over_from) throw new Error('no carried copy');
  copy = carried;
  const from = all.find((q) => q.id === carried.carried_over_from);
  if (!from) throw new Error('no original');
  original = from;
});
afterEach(() => t.cleanup());

describe('finishing a quest after the weekly review', () => {
  it('removes its untouched carried copy, logged in Plan history; un-tick brings it back', async () => {
    await finish(original);
    expect(await live(copy.id)).toBeUndefined();
    expect((await t.db.quest_instances.get(inst(copy)))?.deleted_at).not.toBeNull();
    const [entry] = await cleanups();
    expect(entry?.summary).toBe(
      `“${original.title}” was finished, so its carried-over copy was removed from next week.`,
    );
    // Other quests of next week are untouched.
    const others = (await t.db.quests.toArray()).filter(
      (q) => q.week_start === NEXT && q.id !== copy.id,
    );
    expect(others.every((q) => !q.deleted_at)).toBe(true);

    // Same-day correction: un-ticking the original restores the copy exactly.
    await untick(original);
    expect((await live(copy.id))?.status).toBe('active');
    expect((await t.db.quest_instances.get(inst(copy)))?.deleted_at).toBeNull();
    expect((await cleanups())[0]?.undone_at).not.toBeNull();

    // Ticking it again removes the copy again (it is still as planned).
    await finish(original);
    expect(await live(copy.id)).toBeUndefined();
    expect((await cleanups()).filter((h) => !h.undone_at)).toHaveLength(1);
  });

  it('the removal can be undone from Plan history, and the weekly plan’s Undo still works', async () => {
    await finish(original);
    const entry = (await cleanups())[0] as PlanHistory;
    await t.run({ type: 'plan.undo', payload: { id: entry.id } });
    expect((await live(copy.id))?.status).toBe('active');

    const weeklyPlan = (await t.db.plan_history.toArray()).find(
      (h) => h.trigger === `weekly:${NEXT}`,
    ) as PlanHistory;
    const res = await t.run({ type: 'plan.undo', payload: { id: weeklyPlan.id } });
    expect(res.value).toBe(true);
    expect(
      (await t.db.quests.toArray()).filter((q) => q.week_start === NEXT && !q.deleted_at),
    ).toHaveLength(0);
  });

  it('the weekly plan’s Undo works while the copy is still removed', async () => {
    await finish(original);
    const weeklyPlan = (await t.db.plan_history.toArray()).find(
      (h) => h.trigger === `weekly:${NEXT}`,
    ) as PlanHistory;
    const res = await t.run({ type: 'plan.undo', payload: { id: weeklyPlan.id } });
    expect(res.value).toBe(true);
    expect(await live(copy.id)).toBeUndefined();
  });

  it('keeps a copy that was edited after planning', async () => {
    await t.run({ type: 'quest.update', payload: { id: copy.id, changes: { title: 'Mine now' } } });
    await finish(original);
    expect((await live(copy.id))?.title).toBe('Mine now');
    expect(await cleanups()).toHaveLength(0);
  });

  it('does nothing on the week’s first day plan (no copy is made for a finished quest)', async () => {
    // A quest finished before the review is simply not carried.
    await finish(original);
    setNow(ist(2026, 11, 9, 10));
    await t.run({ type: 'day.rollover', payload: {} });
    await runWeeklyPlan(t.db);
    expect(
      (await t.db.quests.toArray()).filter(
        (q) => q.carried_over_from === original.id && !q.deleted_at,
      ),
    ).toHaveLength(0);
  });
});

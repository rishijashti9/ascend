import type { Dream, Habit, MainQuest, PlanHistory } from '@/core/db/types';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { createTestDb } from '@/test/testDb';
import { LINKS_NEVER, LINKS_SNOOZE_KEY } from './links';

/** Linking plan L2: apply through the plan path (history + Undo), snooze, refuse stale links. */
let t: Awaited<ReturnType<typeof createTestDb>>;
let mq: MainQuest;
let study: Habit;

beforeEach(async () => {
  t = await createTestDb();
  const dream = (await t.run<Dream>({ type: 'dream.create', payload: { title: 'D' } }))
    .value as Dream;
  mq = (
    await t.run<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: dream.id, title: 'Core robotics skills', stat: 'INT' },
    })
  ).value as MainQuest;
  const fields = STARTER_HABITS.find((h) => h.title.startsWith('AI & Robotics study'));
  study = (
    await t.run<Habit>({
      type: 'habit.create',
      payload: habitFieldsOf(fields as (typeof STARTER_HABITS)[number]),
    })
  ).value as Habit;
});
afterEach(() => t.cleanup());

const link = () => ({ habitId: study.id, title: study.title, mainQuestId: mq.id });

it('links the daily quest, as one Plan history entry', async () => {
  const history = (await t.run<PlanHistory>({ type: 'links.apply', payload: { links: [link()] } }))
    .value as PlanHistory;
  const h = await t.db.habits.get(study.id);
  expect([h?.linked_goal_type, h?.linked_goal_id]).toEqual(['main_quest', mq.id]);
  expect(history.summary).toBe('Linked 1 daily quest to the main quest they serve.');
  expect(history.trigger).toMatch(/^links:\d{4}-\d{2}-\d{2}$/);
  // The decision is recorded for the Adaptive System (numbers only).
  const learned = await t.db.learning_events.toArray();
  expect(learned.some((e) => e.type === 'link_quests' && e.outcome === 'accepted')).toBe(true);
});

it('Undo puts the daily quest back exactly as it was', async () => {
  const history = (await t.run<PlanHistory>({ type: 'links.apply', payload: { links: [link()] } }))
    .value as PlanHistory;
  await t.run({ type: 'plan.undo', payload: { id: history.id } });
  const h = await t.db.habits.get(study.id);
  expect([h?.linked_goal_type, h?.linked_goal_id]).toEqual([null, null]);
});

it('"Not now" hides it for a week; "Don\'t ask again" for good', async () => {
  await t.run({ type: 'links.snooze', payload: { forever: false } });
  expect((await t.db.meta.get(LINKS_SNOOZE_KEY))?.value).toBe('2026-11-09');
  await t.run({ type: 'links.snooze', payload: { forever: true } });
  expect((await t.db.meta.get(LINKS_SNOOZE_KEY))?.value).toBe(LINKS_NEVER);
  const learned = await t.db.learning_events.toArray();
  expect(learned.filter((e) => e.type === 'link_quests' && e.outcome === 'rejected')).toHaveLength(
    2,
  );
});

it('refuses a main quest that is no longer active, or a daily quest that is gone', async () => {
  await t.run({ type: 'mainQuest.setStatus', payload: { id: mq.id, status: 'paused' } });
  await expect(t.run({ type: 'links.apply', payload: { links: [link()] } })).rejects.toThrow(
    /isn’t active/,
  );
  await expect(
    t.run({ type: 'links.apply', payload: { links: [{ ...link(), habitId: 'nope' }] } }),
  ).rejects.toThrow(/can’t be linked/);
});

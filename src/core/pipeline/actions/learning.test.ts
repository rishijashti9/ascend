import type { PlanProposal } from '@/core/db/types';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const events = () => t.db.learning_events.toArray();

describe('learning events (SPEC 6.7 A)', () => {
  it('a shown suggestion is recorded once per type, ref and day', async () => {
    const shown = { type: 'learning.shown', payload: { type: 'goal_risk', ref_id: 'm1' } };
    expect((await t.run(shown)).value).toBe(true);
    expect((await t.run(shown)).value).toBe(false);
    setNow(ist(2026, 11, 3, 10));
    expect((await t.run(shown)).value).toBe(true);
    const all = await events();
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ kind: 'suggestion', outcome: 'shown', ref_id: 'm1' });
  });

  it('only numbers go into values, and types are short slugs', async () => {
    await expect(
      t.run({ type: 'learning.shown', payload: { type: 'Free text here!', ref_id: null } }),
    ).rejects.toThrow();
  });

  it('an unanswered suggestion becomes ignored after its day; an answered one does not', async () => {
    await t.run({ type: 'learning.shown', payload: { type: 'goal_risk', ref_id: 'a' } });
    await t.run({ type: 'learning.shown', payload: { type: 'goal_risk', ref_id: 'b' } });
    await t.run({
      type: 'learning.answer',
      payload: { type: 'goal_risk', ref_id: 'b', outcome: 'accepted' },
    });
    expect((await t.run({ type: 'learning.closeDays', payload: {} })).value).toBe(0); // same day
    setNow(ist(2026, 11, 3, 10));
    expect((await t.run({ type: 'learning.closeDays', payload: {} })).value).toBe(1);
    expect((await t.run({ type: 'learning.closeDays', payload: {} })).value).toBe(0); // once
    const ignored = (await events()).filter((e) => e.outcome === 'ignored');
    expect(ignored).toMatchObject([{ ref_id: 'a', day: '2026-11-02' }]);
  });

  it('app opens closer than 10 minutes apart count once', async () => {
    expect((await t.run({ type: 'learning.appOpen', payload: {} })).value).toBe(true);
    setNow(ist(2026, 11, 2, 10, 5));
    expect((await t.run({ type: 'learning.appOpen', payload: {} })).value).toBe(false);
    setNow(ist(2026, 11, 2, 10, 20));
    expect((await t.run({ type: 'learning.appOpen', payload: {} })).value).toBe(true);
    expect((await events()).filter((e) => e.kind === 'app_open')).toHaveLength(2);
  });

  it('rejecting and applying plans, and "Not now" on difficulty, record answers', async () => {
    const dream = (await t.run<{ id: string }>({ type: 'dream.create', payload: { title: 'D' } }))
      .value as { id: string };
    const mq = (
      await t.run<{ id: string }>({
        type: 'mainQuest.create',
        payload: { dream_id: dream.id, title: 'Robotics', stat: 'INT' },
      })
    ).value as { id: string };
    const propose = async () =>
      (
        await t.run({
          type: 'plan.propose',
          payload: {
            goal_type: 'main_quest',
            goal_id: mq.id,
            trigger: 'replan',
            summary: 'A plan',
            items: [],
            answers: {},
          },
        })
      ).value as PlanProposal;
    const p1 = await propose();
    await t.run({ type: 'plan.reject', payload: { id: p1.id } });
    const p2 = await propose();
    await t.run({ type: 'plan.apply', payload: { id: p2.id, selected: [] } });
    await t.run({ type: 'difficulty.snooze', payload: { kind: 'ease' } });
    await t.run({ type: 'difficulty.snooze', payload: { kind: 'low_energy' } });
    const answers = (await events()).map((e) => [e.type, e.outcome, e.ref_id]);
    expect(answers).toEqual(
      expect.arrayContaining([
        ['plan_replan', 'rejected', p1.id],
        ['plan_replan', 'accepted', p2.id],
        ['difficulty_ease', 'rejected', null],
        ['difficulty_low_energy', 'accepted', null],
      ]),
    );
  });
});

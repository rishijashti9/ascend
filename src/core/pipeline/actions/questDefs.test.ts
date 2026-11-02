import type { Quest } from '@/core/db/types';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { RuleError } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  t = await createTestDb(); // Monday 2026-11-02, 10:00 IST
});
afterEach(() => t.cleanup());

const create = async (payload: object) =>
  (await t.run<Quest>({ type: 'quest.create', payload })).value as Quest;
const complete = (instanceId: string) =>
  t.run({ type: 'quest.complete', payload: { instanceId, version: 'full' } });
const xpDays = async () => (await t.db.xp_events.toArray()).map((e) => [e.day, e.base_amount]);

describe('weekly quests', () => {
  it('belong to the current week and can be done any day of it; XP counts that day', async () => {
    const q = await create({ type: 'weekly', title: '2 mock tests', stat: 'INT' });
    expect(q.week_start).toBe('2026-11-02');
    const id = `${q.id}:2026-11-02`;
    expect((await t.db.quest_instances.get(id))?.day).toBe('2026-11-02');

    setNow(ist(2026, 11, 4, 19)); // Wednesday
    await complete(id);
    expect(await xpDays()).toEqual([['2026-11-04', 25]]);
    expect((await t.db.quests.get(q.id))?.status).toBe('done');
  });

  it('a counted weekly quest is done when its target is reached', async () => {
    const q = await create({
      type: 'weekly',
      title: 'Mock tests',
      stat: 'INT',
      measure: 'count',
      target_value: 2,
    });
    const id = `${q.id}:2026-11-02`;
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 1 } });
    expect((await t.db.quest_instances.get(id))?.status).toBe('pending');
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 1 } });
    expect((await t.db.quest_instances.get(id))?.status).toBe('done_full');
  });

  it('is closed once its week is over', async () => {
    const q = await create({ type: 'weekly', title: 'Read a paper', stat: 'INT' });
    setNow(ist(2026, 11, 9, 10)); // next Monday
    await expect(complete(`${q.id}:2026-11-02`)).rejects.toThrow(/week is over/);
  });

  it('undo works the same day only', async () => {
    const q = await create({ type: 'weekly', title: 'Read a paper', stat: 'INT' });
    const id = `${q.id}:2026-11-02`;
    await complete(id);
    setNow(ist(2026, 11, 3, 10));
    await expect(t.run({ type: 'quest.untick', payload: { instanceId: id } })).rejects.toThrow(
      /same-day/,
    );
    setNow(ist(2026, 11, 2, 22));
    await t.run({ type: 'quest.untick', payload: { instanceId: id } });
    expect((await t.db.quest_instances.get(id))?.status).toBe('pending');
  });

  it('the rollover does not mark weekly quests missed when their first day closes', async () => {
    const q = await create({ type: 'weekly', title: 'Read a paper', stat: 'INT' });
    setNow(ist(2026, 11, 3, 10));
    await t.run({ type: 'day.rollover', payload: {} });
    expect((await t.db.quest_instances.get(`${q.id}:2026-11-02`))?.status).toBe('pending');
  });
});

describe('side quests', () => {
  it('stay open after their due day and can be done any day', async () => {
    const q = await create({
      type: 'side',
      title: 'Renew passport',
      stat: 'WIL',
      due_day: '2026-11-03',
    });
    await t.db.profile.put({
      id: 'profile',
      created_at: '',
      updated_at: '',
      deleted_at: null,
      schema_version: 1,
      hlc: '0',
      name: 'R',
      start_day: '2026-11-02',
      onboarded_at: '2026-11-02T00:00:00.000Z',
      display_title: null,
    });
    setNow(ist(2026, 11, 6, 10));
    await t.run({ type: 'day.rollover', payload: {} });
    expect((await t.db.quests.get(q.id))?.status).toBe('active');
    await complete(q.id);
    expect(await xpDays()).toEqual([['2026-11-06', 25]]);
  });

  it('never affect Daily Clear', async () => {
    const q = await create({ type: 'side', title: 'Call the bank', stat: 'WIL' });
    await complete(q.id);
    expect(await t.db.days.get('2026-11-02')).toBeUndefined();
  });

  it('edit updates the open quest; archive hides it; restore brings it back', async () => {
    const q = await create({ type: 'side', title: 'Call the bank', stat: 'WIL' });
    await t.run({
      type: 'quest.update',
      payload: { id: q.id, changes: { title: 'Call the bank (loan)' } },
    });
    expect((await t.db.quest_instances.get(q.id))?.title_snapshot).toBe('Call the bank (loan)');
    await t.run({ type: 'quest.archive', payload: { id: q.id, archived: true } });
    expect((await t.db.quest_instances.get(q.id))?.deleted_at).not.toBeNull();
    await t.run({ type: 'quest.archive', payload: { id: q.id, archived: false } });
    expect((await t.db.quest_instances.get(q.id))?.deleted_at).toBeNull();
    expect((await t.db.quests.get(q.id))?.status).toBe('active');
  });

  it('checks targets and goal links', async () => {
    await expect(
      create({ type: 'side', title: 'x', stat: 'INT', measure: 'count' }),
    ).rejects.toThrow(RuleError);
    await expect(
      create({
        type: 'weekly',
        title: 'x',
        stat: 'INT',
        linked_goal_type: 'milestone',
        linked_goal_id: 'missing',
      }),
    ).rejects.toThrow(/linked goal/);
  });
});

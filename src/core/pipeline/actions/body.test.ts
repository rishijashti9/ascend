import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { createTestDb } from '@/test/testDb';
import { ensureInstancesForDay, RuleError } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const log = (payload: object) => t.run({ type: 'body.log', payload });

describe('body.log', () => {
  it('one record per day; later entries update only the given fields', async () => {
    await log({ weight: 78.4, steps: 4000 });
    await log({ waist: 84, workout_notes: 'Push day' });
    expect(await t.db.body_logs.toArray()).toEqual([
      expect.objectContaining({
        id: `body:${DAY}`,
        day: DAY,
        weight: 78.4,
        waist: 84,
        steps: 4000,
        workout_notes: 'Push day',
        source: 'manual',
        manual_override: true,
      }),
    ]);
  });

  it('null or an empty note clears a value', async () => {
    await log({ weight: 78, workout_notes: 'Legs' });
    await log({ weight: null, workout_notes: '' });
    expect(await t.db.body_logs.get(`body:${DAY}`)).toMatchObject({
      weight: null,
      workout_notes: null,
    });
  });

  it('past days can be filled in; future days cannot', async () => {
    await log({ day: '2026-10-30', weight: 79 });
    expect((await t.db.body_logs.get('body:2026-10-30'))?.weight).toBe(79);
    await expect(log({ day: '2026-11-05', weight: 79 })).rejects.toThrow(RuleError);
    await expect(log({ weight: 5 })).rejects.toThrow();
  });

  it('today’s steps and sleep fill in the Walk and Sleep quests', async () => {
    for (const key of ['walk', 'sleep']) {
      const h = STARTER_HABITS.find((x) => x.key === key);
      if (!h) throw new Error('starter missing');
      await t.run({ type: 'habit.create', payload: habitFieldsOf(h) });
    }
    await ensureInstancesForDay(t.db, DAY);
    await log({ steps: 8200, sleep_hours: 6.5 });
    const statuses = (await t.db.quest_instances.toArray())
      .map((i) => [i.title_snapshot, i.status])
      .sort();
    expect(statuses).toEqual([
      ['Sleep', 'done_min'],
      ['Walk', 'done_full'],
    ]);
    // Past days never touch quests.
    await log({ day: '2026-10-30', steps: 9000 });
    expect(await t.db.progress_entries.count()).toBe(2);
  });
});

describe('steps & sleep: one number in both places (task 4.7)', () => {
  async function setup() {
    const ids: Record<string, string> = {};
    for (const key of ['walk', 'sleep']) {
      const h = STARTER_HABITS.find((x) => x.key === key);
      if (!h) throw new Error('starter missing');
      const habit = (
        await t.run<{ id: string }>({ type: 'habit.create', payload: habitFieldsOf(h) })
      ).value as { id: string };
      ids[key] = `${habit.id}:${DAY}`;
    }
    await ensureInstancesForDay(t.db, DAY);
    return ids as { walk: string; sleep: string };
  }
  const body = async () => t.db.body_logs.get(`body:${DAY}`);
  const quest = async (id: string) => {
    const entries = await t.db.progress_entries.where('quest_instance_id').equals(id).toArray();
    const latest = entries.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).at(-1);
    return { status: (await t.db.quest_instances.get(id))?.status, value: latest?.amount ?? null };
  };
  const onQuest = (instanceId: string, amount: number) =>
    t.run({ type: 'quest.logProgress', payload: { instanceId, amount } });

  it('entering steps / sleep on the quest updates today’s Body log, corrections too', async () => {
    const { walk, sleep } = await setup();
    await onQuest(walk, 9000);
    await onQuest(sleep, 7);
    expect(await body()).toMatchObject({ steps: 9000, sleep_hours: 7, manual_override: true });
    await onQuest(walk, 8500); // a lower correction: the day total is 8,500 in both places
    expect((await body())?.steps).toBe(8500);
    expect(await quest(walk)).toMatchObject({ value: 8500, status: 'done_full' });
  });

  it('Undo on the quest clears the Body value', async () => {
    const { walk } = await setup();
    await onQuest(walk, 9000);
    await t.run({ type: 'quest.untick', payload: { instanceId: walk } });
    expect((await body())?.steps).toBeNull();
    expect((await quest(walk)).status).toBe('pending');
  });

  it('entering in Body updates the quests; clearing in Body undoes them', async () => {
    const { walk, sleep } = await setup();
    await log({ steps: 4000, sleep_hours: 7.5 });
    expect(await quest(walk)).toMatchObject({ value: 4000, status: 'done_min' });
    expect(await quest(sleep)).toMatchObject({ value: 7.5, status: 'done_full' });
    await log({ steps: null });
    expect((await quest(walk)).status).toBe('pending');
    expect((await body())?.steps).toBeNull();
    expect((await body())?.sleep_hours).toBe(7.5);
  });

  it('a past day’s Body correction never changes that closed day’s quest', async () => {
    const { walk } = await setup();
    await onQuest(walk, 9000);
    const { setNow } = await import('@/core/time');
    const { ist } = await import('@/test/testDb');
    setNow(ist(2026, 11, 3, 10));
    await log({ day: DAY, steps: 3000 });
    expect((await body())?.steps).toBe(3000);
    expect(await quest(walk)).toMatchObject({ value: 9000, status: 'done_full' });
  });
});

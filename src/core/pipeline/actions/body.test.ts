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

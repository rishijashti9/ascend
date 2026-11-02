import type { Habit } from '@/core/db/types';
import { createTestDb } from '@/test/testDb';
import { DERIVED_VERSION, ensureInstancesForDay, type RebuildResult } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const rebuild = async () =>
  (await t.run<RebuildResult>({ type: 'progress.rebuild', payload: {} })).value as RebuildResult;

async function coreDoneToday(): Promise<string> {
  const payload = {
    title: 'Workout',
    stat: 'STR',
    difficulty: 'normal',
    measure: 'check',
    full_version: '30 min',
    min_version: '10 push-ups',
    core: true,
  };
  const h = (await t.run<Habit>({ type: 'habit.create', payload })).value as Habit;
  await ensureInstancesForDay(t.db, DAY);
  const id = `${h.id}:${DAY}`;
  await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
  return id;
}

describe('progress.rebuild', () => {
  it('finds nothing to fix when the data is consistent, and records the version', async () => {
    await coreDoneToday();
    expect(await rebuild()).toEqual({ daysChecked: 1, daysFixed: 0 });
    expect((await t.db.meta.get('derived_version'))?.value).toBe(DERIVED_VERSION);
  });

  it('corrects a day record that disagrees with its quests, including its streak', async () => {
    await coreDoneToday();
    const day = await t.db.days.get(DAY);
    if (!day) throw new Error('missing day');
    await t.db.days.put({ ...day, active: false, streak_after: 0, daily_clear: false });

    expect(await rebuild()).toEqual({ daysChecked: 1, daysFixed: 1 });
    expect(await t.db.days.get(DAY)).toMatchObject({
      active: true,
      daily_clear: true,
      streak_after: 1,
    });
    expect((await rebuild()).daysFixed).toBe(0);
  });

  it('creates a missing day record for quests that have one (e.g. after an import)', async () => {
    await coreDoneToday();
    await t.db.days.clear();
    expect((await rebuild()).daysFixed).toBe(1);
    expect(await t.db.days.get(DAY)).toMatchObject({ active: true, streak_after: 1 });
  });
});

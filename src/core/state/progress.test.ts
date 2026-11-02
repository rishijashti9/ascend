import type { Habit } from '@/core/db/types';
import { clearSubscribers, ensureInstancesForDay } from '@/core/pipeline';
import { createTestDb } from '@/test/testDb';
import { progressStore, rebuildProgress, startProgressStore } from './progress';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  clearSubscribers();
  await t.cleanup();
});

async function habit(core: boolean): Promise<string> {
  const payload = {
    title: core ? 'Workout' : 'Journal',
    stat: core ? 'STR' : 'WIL',
    difficulty: 'normal',
    measure: 'check',
    full_version: 'full',
    min_version: 'min',
    core,
  };
  const h = (await t.run<Habit>({ type: 'habit.create', payload })).value as Habit;
  return `${h.id}:${DAY}`;
}

describe('progress store', () => {
  it('loads on start and updates after every action', async () => {
    const workout = await habit(true);
    const journal = await habit(false);
    await ensureInstancesForDay(t.db, DAY);
    const stop = await startProgressStore(t.db);
    expect(progressStore.getState()).toMatchObject({ status: 'ready' });
    expect(progressStore.getState().progress?.level.totalXp).toBe(0);

    await t.run({ type: 'quest.complete', payload: { instanceId: workout, version: 'full' } });
    let p = progressStore.getState().progress;
    expect(p?.stats.STR.totalXp).toBe(25);
    expect(p?.streak).toMatchObject({ streak: 1, daysActive: 1 });

    await t.run({ type: 'quest.complete', payload: { instanceId: journal, version: 'min' } });
    p = progressStore.getState().progress;
    // 25 + 12.5 → WIL rounds to 13; Daily Clear +20.
    expect(p?.level.totalXp).toBe(25 + 13 + 20);
    expect(p?.today.xp.total).toBe(58);

    await t.run({ type: 'quest.untick', payload: { instanceId: journal } });
    expect(progressStore.getState().progress?.level.totalXp).toBe(25);
    stop();
  });

  it('rebuildProgress repairs stored days and reloads', async () => {
    const workout = await habit(true);
    await ensureInstancesForDay(t.db, DAY);
    await t.run({ type: 'quest.complete', payload: { instanceId: workout, version: 'full' } });
    const day = await t.db.days.get(DAY);
    if (day) await t.db.days.put({ ...day, active: false });

    const result = await rebuildProgress(t.db);
    expect(result.daysFixed).toBe(1);
    expect(progressStore.getState().progress?.streak.daysActive).toBe(1);
  });
});

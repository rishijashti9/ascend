import type { Habit } from '@/core/db/types';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { ensureInstancesForDay } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

async function habit(payload: object): Promise<string> {
  const h = (await t.run<Habit>({ type: 'habit.create', payload })).value as Habit;
  return h.id;
}

async function setupDay() {
  const workout = await habit({
    title: 'Workout',
    stat: 'STR',
    difficulty: 'normal',
    measure: 'check',
    full_version: '30 min',
    min_version: '10 push-ups',
    core: true,
  });
  const journal = await habit({
    title: 'Journal',
    stat: 'WIL',
    difficulty: 'easy',
    measure: 'check',
    full_version: '10 min',
    min_version: '3 lines',
  });
  await ensureInstancesForDay(t.db, DAY);
  return { workout: `${workout}:${DAY}`, journal: `${journal}:${DAY}` };
}

describe('day record stays current', () => {
  it('becomes active when the core quest is done, Daily Clear when all are done', async () => {
    const { workout, journal } = await setupDay();
    await t.run({ type: 'quest.complete', payload: { instanceId: workout, version: 'min' } });
    let day = await t.db.days.get(DAY);
    expect(day).toMatchObject({
      active: true,
      neutral: false,
      daily_clear: false,
      timezone: 'Asia/Kolkata',
    });
    await t.run({ type: 'quest.complete', payload: { instanceId: journal, version: 'full' } });
    day = await t.db.days.get(DAY);
    expect(day?.daily_clear).toBe(true);
  });

  it('un-ticking a core quest makes the day inactive again', async () => {
    const { workout } = await setupDay();
    await t.run({ type: 'quest.complete', payload: { instanceId: workout, version: 'full' } });
    await t.run({ type: 'quest.untick', payload: { instanceId: workout } });
    expect((await t.db.days.get(DAY))?.active).toBe(false);
  });

  it('pausing the only unfinished habit gives Daily Clear', async () => {
    const { workout, journal } = await setupDay();
    await t.run({ type: 'quest.complete', payload: { instanceId: workout, version: 'full' } });
    await t.run({ type: 'habit.pause', payload: { id: journal.split(':')[0] } });
    expect((await t.db.days.get(DAY))?.daily_clear).toBe(true);
  });
});

describe('day.setLowEnergy', () => {
  it('on a low-energy day, core minimums give Daily Clear', async () => {
    const { workout } = await setupDay();
    await t.run({ type: 'day.setLowEnergy', payload: { on: true } });
    await t.run({ type: 'quest.complete', payload: { instanceId: workout, version: 'min' } });
    expect(await t.db.days.get(DAY)).toMatchObject({
      low_energy: true,
      active: true,
      daily_clear: true,
    });
  });

  it('can be turned off the same day: full rules return, done stays done', async () => {
    const { workout } = await setupDay();
    await t.run({ type: 'day.setLowEnergy', payload: { on: true } });
    await t.run({ type: 'quest.complete', payload: { instanceId: workout, version: 'min' } });
    await t.run({ type: 'day.setLowEnergy', payload: { on: false } });
    const day = await t.db.days.get(DAY);
    expect(day).toMatchObject({
      low_energy: false,
      active: true,
      daily_clear: false,
      low_energy_set_at: null,
    });
    expect((await t.db.quest_instances.get(workout))?.status).toBe('done_min');
  });

  it('applies to today only', async () => {
    await setupDay();
    setNow(ist(2026, 11, 3, 9, 0));
    await t.run({ type: 'day.setLowEnergy', payload: { on: true } });
    expect((await t.db.days.get('2026-11-03'))?.low_energy).toBe(true);
    expect((await t.db.days.get(DAY))?.low_energy ?? false).toBe(false);
  });
});

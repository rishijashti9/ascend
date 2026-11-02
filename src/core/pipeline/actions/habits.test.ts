import type { Habit } from '@/core/db/types';
import { createTestDb, ist } from '@/test/testDb';
import { setNow } from '@/core/time';
import { ActionValidationError, ensureInstancesForDay } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
const TODAY = '2026-11-02'; // Monday

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const study = {
  title: 'AI & Robotics study',
  stat: 'INT',
  difficulty: 'hard',
  measure: 'minutes',
  target_value: 150,
  min_value: 30,
  core: true,
} as const;

const workout = {
  title: 'Workout',
  stat: 'STR',
  difficulty: 'normal',
  measure: 'check',
  full_version: '30 min workout',
  min_version: '10 push-ups',
  core: true,
} as const;

async function create(fields: object): Promise<Habit> {
  return (await t.run<Habit>({ type: 'habit.create', payload: fields })).value as Habit;
}

describe('habit.create', () => {
  it('creates an active habit with defaults (every day)', async () => {
    const h = await create(study);
    expect(h).toMatchObject({
      status: 'active',
      schedule: [0, 1, 2, 3, 4, 5, 6],
      planned_by: 'me',
      order: 0,
    });
    expect(await t.db.habits.count()).toBe(1);
  });

  it('validates measures', async () => {
    await expect(create({ ...study, min_value: 200 })).rejects.toThrow(/minimum must not exceed/);
    await expect(create({ ...study, target_value: null })).rejects.toThrow(/need a target/);
    await expect(create({ ...workout, min_version: '' })).rejects.toThrow(/minimum version/);
    await expect(create({ ...study, target_value: 150.5 })).rejects.toThrow(/whole numbers/);
    await expect(create({ ...study, title: '   ' })).rejects.toBeInstanceOf(ActionValidationError);
    // Sleep hours may be decimals.
    await expect(
      create({
        title: 'Sleep',
        stat: 'STR',
        difficulty: 'normal',
        measure: 'sleep_hours',
        target_value: 7.5,
        min_value: 6.5,
      }),
    ).resolves.toBeDefined();
  });

  it('allows at most 3 core quests', async () => {
    await create(study);
    await create(workout);
    await create({ ...workout, title: 'Wake up' });
    await expect(create({ ...workout, title: 'Fourth' })).rejects.toThrow(/At most 3 core/);
    await expect(create({ ...workout, title: 'Not core', core: false })).resolves.toBeDefined();
  });

  it('does not create today instances before the day has started', async () => {
    await create(study);
    expect(await t.db.quest_instances.count()).toBe(0);
  });

  it('a habit added after the day started appears today, but not as core for today', async () => {
    await create(workout);
    await ensureInstancesForDay(t.db, TODAY);
    const h = await create({ ...study });
    const inst = await t.db.quest_instances.get(`${h.id}:${TODAY}`);
    expect(inst?.status).toBe('pending');
    expect(inst?.core_snapshot).toBe(false);
  });
});

describe('ensureInstancesForDay', () => {
  it('creates one instance per scheduled habit and is idempotent', async () => {
    await create(study);
    await create({ ...workout, schedule: [2] }); // Tuesdays only
    expect(await ensureInstancesForDay(t.db, TODAY)).toBe(1);
    expect(await ensureInstancesForDay(t.db, TODAY)).toBe(0);
    expect(await ensureInstancesForDay(t.db, '2026-11-03')).toBe(2);
  });
});

describe('habit.update', () => {
  it('updates today’s pending instance (snapshot) but keeps the core flag', async () => {
    const h = await create(study);
    await ensureInstancesForDay(t.db, TODAY);
    await t.run({
      type: 'habit.update',
      payload: { id: h.id, changes: { target_value: 120, core: false } },
    });
    const inst = await t.db.quest_instances.get(`${h.id}:${TODAY}`);
    expect(inst?.target_snapshot).toBe(120);
    expect(inst?.core_snapshot).toBe(true);
    expect((await t.db.habits.get(h.id))?.core).toBe(false);
  });

  it('never changes a completed instance', async () => {
    const h = await create(study);
    await ensureInstancesForDay(t.db, TODAY);
    await t.db.quest_instances.update(`${h.id}:${TODAY}`, { status: 'done_full' });
    await t.run({ type: 'habit.update', payload: { id: h.id, changes: { title: 'Renamed' } } });
    expect((await t.db.quest_instances.get(`${h.id}:${TODAY}`))?.title_snapshot).toBe(
      'AI & Robotics study',
    );
  });

  it('never changes past days', async () => {
    const h = await create(study);
    await ensureInstancesForDay(t.db, TODAY);
    setNow(ist(2026, 11, 3, 10));
    await t.run({ type: 'habit.update', payload: { id: h.id, changes: { title: 'Renamed' } } });
    expect((await t.db.quest_instances.get(`${h.id}:${TODAY}`))?.title_snapshot).toBe(
      'AI & Robotics study',
    );
  });

  it('removing today from the schedule removes today’s pending instance', async () => {
    const h = await create(study);
    await ensureInstancesForDay(t.db, TODAY);
    await t.run({ type: 'habit.update', payload: { id: h.id, changes: { schedule: [2, 3] } } });
    expect((await t.db.quest_instances.get(`${h.id}:${TODAY}`))?.deleted_at).not.toBeNull();
  });

  it('turning core on respects the limit', async () => {
    await create(study);
    await create(workout);
    await create({ ...workout, title: 'Wake up' });
    const extra = await create({ ...workout, title: 'Journal', core: false });
    await expect(
      t.run({ type: 'habit.update', payload: { id: extra.id, changes: { core: true } } }),
    ).rejects.toThrow(/At most 3 core/);
  });
});

describe('pause, archive, restore, reorder, delete', () => {
  it('pausing removes today’s pending instance but keeps a completed one', async () => {
    const a = await create(study);
    const b = await create(workout);
    await ensureInstancesForDay(t.db, TODAY);
    await t.db.quest_instances.update(`${b.id}:${TODAY}`, { status: 'done_min' });
    await t.run({ type: 'habit.pause', payload: { id: a.id } });
    await t.run({ type: 'habit.pause', payload: { id: b.id } });
    expect((await t.db.quest_instances.get(`${a.id}:${TODAY}`))?.deleted_at).not.toBeNull();
    expect((await t.db.quest_instances.get(`${b.id}:${TODAY}`))?.status).toBe('done_min');
    expect(await ensureInstancesForDay(t.db, '2026-11-03')).toBe(0);
  });

  it('restoring brings today’s instance back fresh', async () => {
    const a = await create(study);
    await ensureInstancesForDay(t.db, TODAY);
    await t.run({ type: 'habit.archive', payload: { id: a.id } });
    await t.run({ type: 'habit.restore', payload: { id: a.id } });
    const inst = await t.db.quest_instances.get(`${a.id}:${TODAY}`);
    expect(inst?.deleted_at).toBeNull();
    expect(inst?.status).toBe('pending');
    expect((await t.db.habits.get(a.id))?.status).toBe('active');
  });

  it('a restored core habit loses core if 3 are already core', async () => {
    const old = await create(study);
    await t.run({ type: 'habit.archive', payload: { id: old.id } });
    await create(workout);
    await create({ ...workout, title: 'Wake up' });
    await create({ ...workout, title: 'Third' });
    const restored = (await t.run<Habit>({ type: 'habit.restore', payload: { id: old.id } })).value;
    expect(restored?.core).toBe(false);
  });

  it('reorders', async () => {
    const a = await create(study);
    const b = await create(workout);
    await t.run({ type: 'habit.reorder', payload: { ids: [b.id, a.id] } });
    expect((await t.db.habits.get(b.id))?.order).toBe(0);
    expect((await t.db.habits.get(a.id))?.order).toBe(1);
  });

  it('delete needs confirm: true and keeps history', async () => {
    const a = await create(study);
    await ensureInstancesForDay(t.db, TODAY);
    await t.db.quest_instances.update(`${a.id}:${TODAY}`, { status: 'done_full' });
    await expect(t.run({ type: 'habit.delete', payload: { id: a.id } })).rejects.toBeInstanceOf(
      ActionValidationError,
    );
    await t.run({ type: 'habit.delete', payload: { id: a.id, confirm: true } });
    expect((await t.db.habits.get(a.id))?.deleted_at).not.toBeNull();
    expect((await t.db.quest_instances.get(`${a.id}:${TODAY}`))?.status).toBe('done_full');
    await expect(t.run({ type: 'habit.restore', payload: { id: a.id } })).rejects.toThrow(
      /not found/,
    );
  });
});

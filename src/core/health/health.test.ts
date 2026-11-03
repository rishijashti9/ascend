import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { ensureInstancesForDay, newBase, recordAction, RuleError } from '@/core/pipeline';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { sleepHoursFor, workoutMinutesFor, workoutVersion } from './readings';
import { healthStore, readHealthNow } from './runner';
import type { HealthSource } from './source';

const D = '2026-11-02';
const start = ist(2026, 11, 2, 3); // day-start 3:00
const next = ist(2026, 11, 3, 3);
const at = (h: number, m = 0) => new Date(ist(2026, 11, 2, h, m)).toISOString();

describe('readings (pure)', () => {
  it('sleep counts for the day you wake into; awake stages are left out', () => {
    const night = {
      startDate: new Date(ist(2026, 11, 1, 22, 30)).toISOString(),
      endDate: at(5, 30),
      hasStageData: true,
      stages: [
        { stage: 'light', durationMinutes: 240 },
        { stage: 'deep', durationMinutes: 150 },
        { stage: 'awake', durationMinutes: 30 },
      ],
    };
    const nap = { startDate: at(14), endDate: at(14, 30) };
    const lastNight = {
      startDate: new Date(ist(2026, 10, 31, 23)).toISOString(),
      endDate: new Date(ist(2026, 11, 1, 6)).toISOString(),
    };
    expect(sleepHoursFor([night, nap, lastNight], start, next)).toBe(7);
    expect(sleepHoursFor([lastNight], start, next)).toBeNull();
  });

  it('workouts add up within the day; 10 min = minimum, 30 min = full', () => {
    const w = (h: number, min: number) => ({
      startDate: at(h),
      endDate: at(h),
      duration: min * 60,
    });
    expect(workoutMinutesFor([w(6, 20), w(18, 15)], start, next)).toBe(35);
    expect(workoutMinutesFor([], start, next)).toBeNull();
    expect(workoutVersion(35)).toBe('full');
    expect(workoutVersion(12)).toBe('min');
    expect(workoutVersion(5)).toBeNull();
  });
});

describe('health.apply', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  const ids: Record<string, string> = {};
  beforeEach(async () => {
    t = await createTestDb(ist(2026, 11, 2, 20));
    for (const key of ['walk', 'sleep', 'workout']) {
      const h = STARTER_HABITS.find((x) => x.key === key);
      if (!h) throw new Error('missing');
      const r = await t.run<{ id: string }>({ type: 'habit.create', payload: habitFieldsOf(h) });
      ids[key] = `${r.value?.id}:${D}`;
    }
    await ensureInstancesForDay(t.db, D);
  });
  afterEach(() => t.cleanup());

  const apply = (r: object) =>
    t.run({
      type: 'health.apply',
      source: 'health',
      payload: {
        readings: [
          { day: D, at: at(20), steps: null, sleepHours: null, workoutMinutes: null, ...r },
        ],
      },
    });
  const inst = (key: string) => t.db.quest_instances.get(ids[key] ?? '');

  it('fills steps, sleep and the workout quest; the body log shows the same numbers', async () => {
    await apply({ steps: 8400, sleepHours: 6.8, workoutMinutes: 40 });
    expect((await inst('walk'))?.status).toBe('done_full');
    expect((await inst('sleep'))?.status).toBe('done_min');
    expect(await inst('workout')).toMatchObject({ status: 'done_full', completed_via: 'health' });
    const log = await t.db.body_logs.get(`body:${D}`);
    expect(log).toMatchObject({ steps: 8400, sleep_hours: 6.8 });
    expect(log?.workout_notes).toBe('Workout 40 min (Health Connect)');
  });

  it('the same reading twice writes nothing new; a new total replaces the old', async () => {
    await apply({ steps: 2000 });
    await apply({ steps: 2000 });
    expect(await t.db.progress_entries.count()).toBe(1);
    await apply({ steps: 3500 });
    expect((await inst('walk'))?.status).toBe('done_min');
  });

  it('a number typed by hand wins over Health Connect', async () => {
    await t.run({ type: 'quest.logProgress', payload: { instanceId: ids.walk, amount: 9000 } });
    await apply({ steps: 4000 });
    expect((await t.db.body_logs.get(`body:${D}`))?.steps).toBe(9000);
    expect((await inst('walk'))?.status).toBe('done_full');
  });

  it('a workout never downgrades a quest done in full', async () => {
    await t.run({ type: 'quest.complete', payload: { instanceId: ids.workout, version: 'full' } });
    await apply({ workoutMinutes: 12 });
    expect((await inst('workout'))?.status).toBe('done_full');
  });

  it('yesterday’s late steps still count for yesterday (a missed day can become active)', async () => {
    await t.db.profile.put({
      ...newBase('profile'),
      name: 'R',
      start_day: '2026-11-01',
      onboarded_at: 'x',
      display_title: null,
    });
    setNow(ist(2026, 11, 3, 8));
    await t.run({ type: 'day.rollover', payload: {} });
    expect((await inst('walk'))?.status).toBe('missed');
    await t.run({
      type: 'health.apply',
      source: 'health',
      payload: {
        readings: [
          {
            day: D,
            at: new Date(next - 60_000).toISOString(),
            steps: 8100,
            sleepHours: null,
            workoutMinutes: null,
          },
        ],
      },
    });
    expect((await inst('walk'))?.status).toBe('done_full');
  });

  it('refuses a reading time outside its day', async () => {
    await expect(apply({ at: new Date(next + 3_600_000).toISOString() })).rejects.toThrow(
      RuleError,
    );
  });

  it('without a steps quest, the body log is filled unless typed by hand', async () => {
    const d2 = '2026-11-01';
    const y = (steps: number) =>
      t.run({
        type: 'health.apply',
        source: 'health',
        payload: {
          readings: [
            {
              day: d2,
              at: new Date(start - 60_000).toISOString(),
              steps,
              sleepHours: null,
              workoutMinutes: null,
            },
          ],
        },
      });
    await y(5000);
    expect(await t.db.body_logs.get(`body:${d2}`)).toMatchObject({
      steps: 5000,
      source: 'health_connect',
    });
    await t.run({ type: 'body.log', payload: { day: d2, steps: 7000 } });
    await y(6000);
    expect((await t.db.body_logs.get(`body:${d2}`))?.steps).toBe(7000);
  });
});

describe('readHealthNow', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  beforeEach(async () => {
    t = await createTestDb(ist(2026, 11, 2, 20));
  });
  afterEach(() => t.cleanup());

  const fake = (granted: boolean): HealthSource & { calls: number } => ({
    calls: 0,
    availability: async () => 'available',
    granted: async () => granted,
    requestAccess: async () => granted,
    openSettings: async () => undefined,
    async steps() {
      this.calls += 1;
      return 1234;
    },
    sleep: async () => [],
    workouts: async () => [],
  });

  it('reads nothing until switched on, allowed and onboarded', async () => {
    const source = fake(true);
    await readHealthNow(source, t.db);
    expect(source.calls).toBe(0);
    expect(healthStore.getState()).toMatchObject({ availability: 'available', granted: true });

    await recordAction(
      { type: 'settings.update', payload: { health_connect_enabled: true } },
      { db: t.db },
    );
    await t.db.profile.put({
      id: 'profile',
      name: 'R',
      start_day: '2026-11-01',
      onboarded_at: 'x',
      display_title: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
      schema_version: 1,
      hlc: 'x',
    });
    await readHealthNow(fake(false), t.db);
    expect(await t.db.body_logs.count()).toBe(0);
    await readHealthNow(source, t.db);
    expect(source.calls).toBe(2); // yesterday + today
    expect((await t.db.body_logs.get(`body:${D}`))?.steps).toBe(1234);
    expect(healthStore.getState().lastReadAt).not.toBeNull();
  });
});

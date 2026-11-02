import type { Habit, QuestInstance } from '@/core/db/types';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { ensureInstancesForDay } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const HABITS = {
  wake: {
    title: 'Wake up on time',
    stat: 'WIL',
    difficulty: 'normal',
    measure: 'check',
    full_version: "I'm up by 5:20",
    min_version: 'late check-in',
    auto_source: 'wake_checkin',
    core: true,
  },
  study: {
    title: 'AI & Robotics study',
    stat: 'INT',
    difficulty: 'hard',
    measure: 'minutes',
    target_value: 150,
    min_value: 30,
    core: true,
  },
  workout: {
    title: 'Workout',
    stat: 'STR',
    difficulty: 'normal',
    measure: 'check',
    full_version: '30 min workout',
    min_version: '10 push-ups',
    core: true,
  },
  sleep: {
    title: 'Sleep',
    stat: 'STR',
    difficulty: 'normal',
    measure: 'sleep_hours',
    target_value: 7.5,
    min_value: 6.5,
  },
} as const;

async function setup(key: keyof typeof HABITS, day = DAY): Promise<string> {
  const h = (await t.run<Habit>({ type: 'habit.create', payload: HABITS[key] })).value as Habit;
  await ensureInstancesForDay(t.db, day);
  return `${h.id}:${day}`;
}

const xpBases = async () =>
  (await t.db.xp_events.toArray())
    .sort((a, b) => a.hlc.localeCompare(b.hlc))
    .map((e) => [e.reason, e.base_amount]);
const statusOf = async (id: string) => (await t.db.quest_instances.get(id))?.status;

describe('quest.complete (Full / Minimum tap)', () => {
  it('Full gives the full base award', async () => {
    const id = await setup('workout');
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
    expect(await statusOf(id)).toBe('done_full');
    expect(await xpBases()).toEqual([['quest_full', 25]]);
    const inst = (await t.db.quest_instances.get(id)) as QuestInstance;
    expect(inst.completed_via).toBe('tap');
    expect(inst.completed_at).not.toBeNull();
  });

  it('Minimum then Full = minimum + top-up (never twice)', async () => {
    const id = await setup('workout');
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'min' } });
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
    expect(await xpBases()).toEqual([
      ['quest_min', 12.5],
      ['quest_topup', 12.5],
    ]);
  });

  it('tapping the same thing twice gives one award', async () => {
    const id = await setup('workout');
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'min' } });
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'min' } });
    expect(await t.db.xp_events.count()).toBe(1);
  });

  it('refuses Full→Minimum, numeric quests and the wake-up quest', async () => {
    const id = await setup('workout');
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
    await expect(
      t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'min' } }),
    ).rejects.toThrow(/Un-tick first/);
    const study = await setup('study');
    await expect(
      t.run({ type: 'quest.complete', payload: { instanceId: study, version: 'full' } }),
    ).rejects.toThrow(/logging progress/);
    const wake = await setup('wake');
    await expect(
      t.run({ type: 'quest.complete', payload: { instanceId: wake, version: 'full' } }),
    ).rejects.toThrow(/I'm up/);
  });
});

describe('quest.logProgress', () => {
  it('minutes add up and upgrade min → full with a top-up', async () => {
    const id = await setup('study');
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 20 } });
    expect(await statusOf(id)).toBe('pending');
    await t.run({
      type: 'quest.logProgress',
      payload: { instanceId: id, amount: 15, source: 'focus' },
    });
    expect(await statusOf(id)).toBe('done_min');
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 120 } });
    expect(await statusOf(id)).toBe('done_full');
    expect(await xpBases()).toEqual([
      ['quest_min', 25],
      ['quest_topup', 25],
    ]);
    expect(await t.db.progress_entries.count()).toBe(3);
  });

  it('sleep is a total: correcting the entry does not double it', async () => {
    const id = await setup('sleep');
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 6 } });
    expect(await statusOf(id)).toBe('pending');
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 7 } });
    expect(await statusOf(id)).toBe('done_min');
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 7.5 } });
    expect(await statusOf(id)).toBe('done_full');
  });

  it('refuses check quests', async () => {
    const id = await setup('workout');
    await expect(
      t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 5 } }),
    ).rejects.toThrow(/Full or Minimum/);
  });
});

describe('quest.wakeCheckin (tap time counts)', () => {
  it('on time up to 5:20, early taps too → full', async () => {
    const id = await setup('wake');
    setNow(ist(2026, 11, 2, 4, 40));
    await t.run({ type: 'quest.wakeCheckin', payload: { instanceId: id } });
    expect(await statusOf(id)).toBe('done_full');
  });

  it('5:20 exactly is still on time; 5:21 is late', async () => {
    const id = await setup('wake');
    setNow(ist(2026, 11, 2, 5, 20));
    // Pin the tap time: the test clock keeps running, so "now" can drift past 5:20:00.000.
    await t.run({
      type: 'quest.wakeCheckin',
      payload: { instanceId: id },
      occurred_at: new Date(ist(2026, 11, 2, 5, 20)).toISOString(),
    });
    expect(await statusOf(id)).toBe('done_full');

    await t.cleanup();
    t = await createTestDb(ist(2026, 11, 2, 5, 21));
    const id2 = await setup('wake');
    await t.run({ type: 'quest.wakeCheckin', payload: { instanceId: id2 } });
    expect(await statusOf(id2)).toBe('done_late');
    expect(await xpBases()).toEqual([['quest_late', 12.5]]);
  });

  it('after the 7:00 cutoff the wake-up quest cannot be checked in', async () => {
    const id = await setup('wake');
    setNow(ist(2026, 11, 2, 7, 1));
    await expect(t.run({ type: 'quest.wakeCheckin', payload: { instanceId: id } })).rejects.toThrow(
      /window has closed/,
    );
    expect(await statusOf(id)).toBe('pending');
  });

  it('a widget tap processed later still uses the tap time', async () => {
    const id = await setup('wake');
    setNow(ist(2026, 11, 2, 9, 0)); // processed at 9:00
    await t.run({
      type: 'quest.wakeCheckin',
      payload: { instanceId: id },
      source: 'widget',
      occurred_at: new Date(ist(2026, 11, 2, 5, 5)).toISOString(), // tapped at 5:05
    });
    expect(await statusOf(id)).toBe('done_full');
  });
});

describe('same-day un-tick', () => {
  it('writes a correction so the net returns to zero; ticking again awards once', async () => {
    const id = await setup('workout');
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
    await t.run({ type: 'quest.untick', payload: { instanceId: id } });
    expect(await statusOf(id)).toBe('pending');
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
    expect(await xpBases()).toEqual([
      ['quest_full', 25],
      ['quest_correction', -25],
      ['quest_full', 25],
    ]);
    expect((await t.db.quest_instances.get(id))?.award_revision).toBe(1);
  });

  it('numeric un-tick resets progress to zero', async () => {
    const id = await setup('study');
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 40 } });
    await t.run({ type: 'quest.untick', payload: { instanceId: id } });
    expect(await statusOf(id)).toBe('pending');
    await t.run({ type: 'quest.logProgress', payload: { instanceId: id, amount: 10 } });
    expect(await statusOf(id)).toBe('pending'); // 10 min, not 50
  });
});

describe('closed days and late-arriving actions', () => {
  it('after the day closes, Rishi can no longer tick or un-tick in the app', async () => {
    const id = await setup('workout');
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
    setNow(ist(2026, 11, 3, 3, 0)); // 3:00 next day: new app-day
    await expect(t.run({ type: 'quest.untick', payload: { instanceId: id } })).rejects.toThrow(
      /closed/,
    );
  });

  it('2 AM is still the same app-day (day starts at 3:00)', async () => {
    const id = await setup('workout');
    setNow(ist(2026, 11, 3, 2, 30));
    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'min' } });
    expect(await statusOf(id)).toBe('done_min');
  });

  it('a real action that arrives late (offline sync) is accepted for its original day', async () => {
    const id = await setup('workout');
    setNow(ist(2026, 11, 3, 8, 0)); // the next morning
    await t.run({
      type: 'quest.complete',
      payload: { instanceId: id, version: 'full' },
      source: 'sync',
      occurred_at: new Date(ist(2026, 11, 2, 20, 0)).toISOString(),
    });
    expect(await statusOf(id)).toBe('done_full');
    expect((await t.db.xp_events.toArray())[0]?.day).toBe(DAY);
  });

  it('an action must belong to the quest’s own day', async () => {
    const id = await setup('workout');
    await expect(
      t.run({
        type: 'quest.complete',
        payload: { instanceId: id, version: 'full' },
        source: 'sync',
        occurred_at: new Date(ist(2026, 11, 3, 20, 0)).toISOString(),
      }),
    ).rejects.toThrow(/belongs to 2026-11-02/);
  });
});

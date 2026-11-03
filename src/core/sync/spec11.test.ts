import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import type { FocusSession, Habit } from '@/core/db/types';
import { computeProgress } from '@/core/engine/progressState';
import { ensureInstancesForDay, recordAction, type Action } from '@/core/pipeline';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { MemoryCloud } from '@/test/memoryBackend';
import { ist } from '@/test/testDb';
import { syncOnce } from './engine';

/**
 * The four sync tests SPEC 11 asks for, each with two devices (two local databases) and one
 * cloud (the same rules as the Supabase function, checked against the SQL in sql.test.ts).
 */
const DAY = '2026-11-02';
let devices: AscendDB[] = [];
let cloud: MemoryCloud;
const run = (db: AscendDB) => (action: Action) => recordAction(action, { db });
const sync = (db: AscendDB) => syncOnce(db, cloud.backend());
async function device(name: string) {
  const db = new AscendDB(`${name}-${crypto.randomUUID()}`);
  await db.open();
  devices.push(db);
  return db;
}
const quest = (title: string, extra: Record<string, unknown> = {}) => ({
  type: 'habit.create',
  payload: {
    title,
    stat: 'INT',
    difficulty: 'normal',
    measure: 'check',
    full_version: 'all',
    min_version: 'some',
    ...extra,
  },
});
async function dayXp(db: AscendDB) {
  const [days, xpEvents, instances] = await Promise.all([
    db.days.toArray(),
    db.xp_events.toArray(),
    db.quest_instances.toArray(),
  ]);
  return computeProgress({ days, xpEvents, instances, today: DAY }).today.xp;
}
/** Habits made on the first device and synced to the others, so ids match everywhere. */
async function shared(first: AscendDB, others: AscendDB[], payloads: ReturnType<typeof quest>[]) {
  const made: Habit[] = [];
  for (const p of payloads) made.push((await run(first)(p)).value as Habit);
  await sync(first);
  for (const db of others) await sync(db);
  for (const db of [first, ...others]) await ensureInstancesForDay(db, DAY);
  return made;
}

beforeEach(() => {
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  cloud = new MemoryCloud();
  devices = [];
});
afterEach(async () => {
  resetClock();
  for (const db of devices) {
    db.close();
    await Dexie.delete(db.name);
  }
});

describe('SPEC 11 sync tests', () => {
  it('1. two devices completing the same quest offline produce one XP event', async () => {
    const phone = await device('phone');
    const laptop = await device('laptop');
    const [workout] = await shared(phone, [laptop], [quest('Workout')]);
    const id = `${workout?.id}:${DAY}`;
    await run(phone)({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
    setNow(ist(2026, 11, 2, 11));
    await run(laptop)({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });

    for (const db of [phone, laptop, phone]) await sync(db);
    for (const db of [phone, laptop]) {
      const events = await db.xp_events.where('ref_id').equals(id).toArray();
      expect(events).toHaveLength(1);
      expect((await db.quest_instances.get(id))?.status).toBe('done_full');
    }
    expect((await dayXp(phone)).total).toBe((await dayXp(laptop)).total);
  });

  it('2. XP earned offline on both devices the same day gives the same total (with soft cap) as one device', async () => {
    const phone = await device('phone');
    const laptop = await device('laptop');
    const single = await device('single');
    // Four Epic quests (100 XP each): well past the 300 XP soft cap.
    const habits = await shared(
      phone,
      [laptop, single],
      ['A', 'B', 'C', 'D'].map((t) => quest(`Epic ${t}`, { difficulty: 'epic' })),
    );
    const done = async (db: AscendDB, h: Habit | undefined) =>
      run(db)({
        type: 'quest.complete',
        payload: { instanceId: `${h?.id}:${DAY}`, version: 'full' },
      });
    await done(phone, habits[0]);
    await done(phone, habits[1]);
    await done(laptop, habits[2]);
    await done(laptop, habits[3]);
    for (const h of habits) await done(single, h);

    for (const db of [phone, laptop, phone]) await sync(db);
    const expected = await dayXp(single);
    expect(expected.total).toBeLessThan(400); // the soft cap applied
    expect(await dayXp(phone)).toEqual(expected);
    expect(await dayXp(laptop)).toEqual(expected);
  });

  it('3. a completion arriving after the day closed turns a missed day into an active one', async () => {
    const phone = await device('phone');
    const laptop = await device('laptop');
    setNow(ist(2026, 11, 1, 10)); // the core quest exists from the day before
    const h = (await run(phone)(quest('Workout', { core: true }))).value as Habit;
    await sync(phone);
    await sync(laptop);

    setNow(ist(2026, 11, 2, 21));
    await ensureInstancesForDay(phone, DAY);
    await run(phone)({
      type: 'quest.complete',
      payload: { instanceId: `${h.id}:${DAY}`, version: 'min' },
    });

    setNow(ist(2026, 11, 3, 9)); // the laptop closes day 2 first: missed there
    await run(laptop)({ type: 'day.rollover', payload: {} });
    expect((await laptop.days.get(DAY))?.active ?? false).toBe(false);

    await sync(phone);
    await sync(laptop);
    expect((await laptop.days.get(DAY))?.active).toBe(true);
    expect((await laptop.quest_instances.get(`${h.id}:${DAY}`))?.status).toBe('done_min');
  });

  it('4. focus minutes on one device and manual minutes on another add up', async () => {
    const phone = await device('phone');
    const laptop = await device('laptop');
    const [study] = await shared(
      phone,
      [laptop],
      [
        quest('Study', {
          measure: 'minutes',
          target_value: 60,
          min_value: 15,
          full_version: undefined,
          min_version: undefined,
        }),
      ],
    );
    const id = `${study?.id}:${DAY}`;
    // Phone: a 25-minute focus session linked to the quest.
    const session = (
      await run(phone)({ type: 'focus.start', payload: { quest_instance_id: id, planned_min: 25 } })
    ).value as FocusSession;
    setNow(ist(2026, 11, 2, 10, 26));
    await run(phone)({
      type: 'focus.finish',
      payload: { id: session.id, completed: true, face_down: true },
    });
    // Laptop: 35 minutes typed in.
    await run(laptop)({ type: 'quest.logProgress', payload: { instanceId: id, amount: 35 } });

    for (const db of [phone, laptop, phone]) await sync(db);
    for (const db of [phone, laptop]) {
      const entries = await db.progress_entries.where('quest_instance_id').equals(id).toArray();
      expect(entries.map((e) => e.source).sort()).toEqual(['focus', 'manual']);
      expect(entries.reduce((t, e) => t + e.amount, 0)).toBe(60);
      expect((await db.quest_instances.get(id))?.status).toBe('done_full');
    }
    expect((await dayXp(phone)).total).toBe((await dayXp(laptop)).total);
  });
});

import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import type { Habit } from '@/core/db/types';
import { ensureInstancesForDay, newBase, recordAction, type Action } from '@/core/pipeline';
import { SYNC_META } from '@/core/pipeline/actions/sync';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { MemoryCloud } from '@/test/memoryBackend';
import { ist } from '@/test/testDb';
import { localChanges, syncOnce } from './engine';

/** Two devices (two local databases) and one cloud. */
let phone: AscendDB;
let laptop: AscendDB;
let cloud: MemoryCloud;
const run = (db: AscendDB) => (action: Action) => recordAction(action, { db });
const sync = (db: AscendDB) => syncOnce(db, cloud.backend());
const habit = (title: string) => ({
  type: 'habit.create',
  payload: {
    title,
    stat: 'INT',
    difficulty: 'normal',
    measure: 'minutes',
    target_value: 60,
    min_value: 15,
  },
});

beforeEach(async () => {
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  phone = new AscendDB(`phone-${crypto.randomUUID()}`);
  laptop = new AscendDB(`laptop-${crypto.randomUUID()}`);
  await phone.open();
  await laptop.open();
  cloud = new MemoryCloud();
});
afterEach(async () => {
  resetClock();
  for (const db of [phone, laptop]) {
    db.close();
    await Dexie.delete(db.name);
  }
});

describe('Phase 8 tables wait for the server migration', () => {
  const event = async (db: AscendDB, id: string) =>
    db.learning_events.add({
      ...newBase(id),
      kind: 'app_open',
      type: 'open',
      outcome: null,
      at: new Date().toISOString(),
      day: '2026-11-02',
      ref_id: null,
      values: null,
    });

  it('keeps them on the device on an old server, then uploads all of them once it is ready', async () => {
    cloud.version = 1;
    await run(phone)(habit('Study'));
    await event(phone, 'e1');
    await sync(phone); // no error: the old server never sees them
    expect(cloud.get('learning_events', 'e1')).toBeUndefined();
    expect(cloud.size).toBeGreaterThan(0);
    await event(phone, 'e2');
    await sync(phone);
    expect(cloud.get('learning_events', 'e2')).toBeUndefined();

    cloud.version = 2; // Rishi applied the migration
    await sync(phone);
    expect(cloud.get('learning_events', 'e1')).toBeDefined();
    expect(cloud.get('learning_events', 'e2')).toBeDefined();
    expect((await phone.meta.get(SYNC_META.serverV2))?.value).toBe(true);
    await sync(laptop);
    expect(await laptop.learning_events.count()).toBe(2);
    expect((await localChanges(phone)).filter((r) => r.tbl === 'learning_events')).toEqual([]);
  });

  it('Phase 11 tables wait for server version 3 the same way', async () => {
    cloud.version = 2;
    const lock = async (id: string, end: string) =>
      phone.screen_locks.put({
        ...newBase(id),
        started_at: '2026-11-02T04:30:00.000Z',
        end_at: end,
      });
    await lock('screen_lock', '2026-11-09T04:30:00.000Z');
    await event(phone, 'e1');
    await sync(phone);
    expect(cloud.get('learning_events', 'e1')).toBeDefined();
    expect(cloud.get('screen_locks', 'screen_lock')).toBeUndefined();

    cloud.version = 3;
    await sync(phone);
    expect(cloud.get('screen_locks', 'screen_lock')?.data.end_at).toBe('2026-11-09T04:30:00.000Z');
    expect((await phone.meta.get(SYNC_META.serverVersion))?.value).toBe(3);
    await sync(laptop);
    expect((await laptop.screen_locks.get('screen_lock'))?.end_at).toBe('2026-11-09T04:30:00.000Z');
  });

  it('a lock only gets longer: an older copy with an earlier end never wins', async () => {
    await phone.screen_locks.put({
      ...newBase('screen_lock'),
      started_at: '2026-11-02T04:30:00.000Z',
      end_at: '2026-11-16T04:30:00.000Z',
    });
    await sync(phone);
    // Another device writes later, but with an earlier end (e.g. restored from an old backup).
    await laptop.screen_locks.put({
      ...newBase('screen_lock'),
      started_at: '2026-11-01T04:30:00.000Z',
      end_at: '2026-11-08T04:30:00.000Z',
    });
    await sync(laptop);
    expect(cloud.get('screen_locks', 'screen_lock')?.data.end_at).toBe('2026-11-16T04:30:00.000Z');
    expect((await laptop.screen_locks.get('screen_lock'))?.end_at).toBe('2026-11-16T04:30:00.000Z');
  });
});

describe('sync engine', () => {
  it('a record made on one device appears on the other; nothing is pushed twice', async () => {
    const h = (await run(phone)(habit('Study'))).value as Habit;
    const first = await sync(phone);
    expect(first.pushed).toBeGreaterThan(0);
    expect(cloud.get('habits', h.id)?.data.title).toBe('Study');
    expect(await localChanges(phone)).toEqual([]); // all pushed (what came back is the same)

    await sync(laptop);
    expect((await laptop.habits.get(h.id))?.title).toBe('Study');
    expect((await laptop.meta.get(SYNC_META.pullSeq))?.value).toBeGreaterThan(0);
  });

  it('the later edit wins, whichever device syncs first', async () => {
    const h = (await run(phone)(habit('Study'))).value as Habit;
    await sync(phone);
    await sync(laptop);
    setNow(ist(2026, 11, 2, 11));
    await run(laptop)({
      type: 'habit.update',
      payload: { id: h.id, changes: { title: 'Laptop title' } },
    });
    setNow(ist(2026, 11, 2, 12));
    await run(phone)({
      type: 'habit.update',
      payload: { id: h.id, changes: { title: 'Phone title (later)' } },
    });
    await sync(phone); // later edit reaches the cloud first
    await sync(laptop); // the earlier one loses, and the laptop takes the later
    await sync(phone);
    expect((await laptop.habits.get(h.id))?.title).toBe('Phone title (later)');
    expect((await phone.habits.get(h.id))?.title).toBe('Phone title (later)');
  });

  it('XP events travel once, by their idempotency key', async () => {
    const h = (await run(phone)(habit('Study'))).value as Habit;
    await ensureInstancesForDay(phone, '2026-11-02');
    await run(phone)({
      type: 'quest.logProgress',
      payload: { instanceId: `${h.id}:2026-11-02`, amount: 60 },
    });
    await sync(phone);
    await sync(laptop);
    await sync(laptop);
    expect(await laptop.xp_events.count()).toBe(await phone.xp_events.count());
    expect(await laptop.xp_events.count()).toBeGreaterThan(0);
    const ev = await phone.xp_events.toArray();
    expect(cloud.get('xp_events', ev[0]?.idempotency_key ?? '')).toBeDefined();
  });

  it('low energy travels as a choice; a later recompute elsewhere doesn’t undo it', async () => {
    await run(phone)(habit('Study'));
    await run(phone)({ type: 'day.setLowEnergy', payload: { on: true } });
    await sync(phone);
    await sync(laptop);
    expect((await laptop.days.get('2026-11-02'))?.low_energy).toBe(true);
    // The laptop rewrites the day record (derived fields) later without touching the choice.
    setNow(ist(2026, 11, 2, 15));
    await run(laptop)(habit('Read'));
    await sync(laptop);
    await sync(phone);
    expect((await phone.days.get('2026-11-02'))?.low_energy).toBe(true);
    // Switching it off is a newer choice, and travels too.
    setNow(ist(2026, 11, 2, 16));
    await run(laptop)({ type: 'day.setLowEnergy', payload: { on: false } });
    await sync(laptop);
    await sync(phone);
    expect((await phone.days.get('2026-11-02'))?.low_energy).toBe(false);
  });

  it('photos and device state never leave the device; newer-version records wait for an update', async () => {
    await phone.photos.put({
      ...newBase('ph1'),
      day: '2026-11-02',
      blob: new Blob(['x']),
    } as never);
    await phone.meta.put({ id: 'something', value: 1 });
    await sync(phone);
    expect(cloud.get('photos', 'ph1')).toBeUndefined();
    expect(cloud.get('meta', 'something')).toBeUndefined();

    await cloud.backend().push([
      {
        tbl: 'habits',
        id: 'future',
        hlc: '000001793613720000-0000-zzzz',
        deleted: false,
        data: { ...newBase('future'), schema_version: 99, title: 'From the future' },
      },
    ]);
    await sync(laptop);
    expect(await laptop.habits.get('future')).toBeUndefined();
  });

  describe('recompute after sync', () => {
    it('minutes logged on two devices add up: the quest completes once, with one award', async () => {
      const h = (await run(phone)(habit('Study'))).value as Habit; // target 60
      await sync(phone);
      await sync(laptop);
      for (const db of [phone, laptop]) await ensureInstancesForDay(db, '2026-11-02');
      const id = `${h.id}:2026-11-02`;
      await run(phone)({
        type: 'quest.logProgress',
        payload: { instanceId: id, amount: 40, source: 'focus' },
      });
      await run(laptop)({ type: 'quest.logProgress', payload: { instanceId: id, amount: 20 } });
      // Each device alone: past the minimum, not the full 60.
      expect((await phone.quest_instances.get(id))?.status).toBe('done_min');
      expect((await laptop.quest_instances.get(id))?.status).toBe('done_min');

      await sync(phone);
      await sync(laptop); // laptop sees both entries → 60 → done
      await sync(phone);
      await sync(laptop);
      for (const db of [phone, laptop]) {
        expect((await db.quest_instances.get(id))?.status).toBe('done_full');
        expect(await db.progress_entries.where('quest_instance_id').equals(id).count()).toBe(2);
      }
      const keys = async (db: AscendDB) =>
        (await db.xp_events.where('ref_id').equals(id).toArray())
          .map((e) => e.idempotency_key)
          .sort();
      expect(await keys(phone)).toEqual(await keys(laptop));
      expect((await keys(phone)).length).toBeGreaterThan(0);
    });

    it('a completion that arrives after the other device closed the day turns missed into active', async () => {
      setNow(ist(2026, 11, 1, 10));
      const h = (
        await run(phone)({
          ...habit('Workout'),
          payload: { ...habit('Workout').payload, core: true },
        })
      ).value as Habit;
      await sync(phone);
      await sync(laptop);

      // Day 2 on the phone (offline): the core quest is done.
      setNow(ist(2026, 11, 2, 10));
      await ensureInstancesForDay(phone, '2026-11-02');
      const id = `${h.id}:2026-11-02`;
      await run(phone)({ type: 'quest.logProgress', payload: { instanceId: id, amount: 60 } });
      expect((await phone.days.get('2026-11-02'))?.active).toBe(true);

      // The laptop is opened on day 3 first: day 2 closes as missed there.
      setNow(ist(2026, 11, 3, 10));
      await run(laptop)({ type: 'day.rollover', payload: {} });
      expect((await laptop.days.get('2026-11-02'))?.active ?? false).toBe(false);

      await sync(phone);
      await sync(laptop);
      expect((await laptop.quest_instances.get(id))?.status).toBe('done_full');
      const day = await laptop.days.get('2026-11-02');
      expect(day?.active).toBe(true);
      expect(day?.streak_after).toBe(1);
    });
  });
});

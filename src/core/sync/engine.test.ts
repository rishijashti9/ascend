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
});

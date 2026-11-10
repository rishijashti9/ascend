import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import type { Habit } from '@/core/db/types';
import { clearSubscribers, newBase, recordAction, type Action } from '@/core/pipeline';
import { SYNC_META } from '@/core/pipeline/actions/sync';
import { accountStore } from '@/core/state/account';
import { startSync, syncStore } from '@/core/state/sync';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { MemoryCloud } from '@/test/memoryBackend';
import { ist } from '@/test/testDb';
import { localChanges, syncOnce } from './engine';
import { connect, linkStatus } from './link';

let phone: AscendDB;
let laptop: AscendDB;
let cloud: MemoryCloud;
const run = (db: AscendDB) => (action: Action) => recordAction(action, { db });
const habit = (title: string) => ({
  type: 'habit.create',
  payload: {
    title,
    stat: 'INT',
    difficulty: 'normal',
    measure: 'check',
    full_version: 'x',
    min_version: 'y',
  },
});
async function onboarded(db: AscendDB, name: string) {
  await db.profile.put({
    ...newBase('profile'),
    name,
    start_day: '2026-11-02',
    onboarded_at: '2026-11-02T04:00:00.000Z',
    display_title: null,
  });
}
const titles = async (db: AscendDB) => (await db.habits.toArray()).map((h) => h.title).sort();

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
  clearSubscribers();
  resetClock();
  for (const db of [phone, laptop]) {
    db.close();
    await Dexie.delete(db.name);
  }
});

describe('first sign-in', () => {
  it('first device uploads; a fresh second device downloads everything', async () => {
    await onboarded(phone, 'Rishi');
    await run(phone)(habit('Study'));
    expect(await linkStatus(phone, cloud.backend(), 'u1')).toBe('upload');
    await connect(phone, cloud.backend(), 'u1', 'upload');
    expect((await phone.meta.get(SYNC_META.user))?.value).toBe('u1');
    expect(await linkStatus(phone, cloud.backend(), 'u1')).toBe('linked');

    expect(await linkStatus(laptop, cloud.backend(), 'u1')).toBe('download'); // not onboarded
    await connect(laptop, cloud.backend(), 'u1', 'download');
    expect((await laptop.profile.get('profile'))?.name).toBe('Rishi');
    expect(await titles(laptop)).toEqual(['Study']);
    expect(await localChanges(laptop)).toEqual([]); // nothing to push back
  });

  describe('both have data → ask', () => {
    beforeEach(async () => {
      await onboarded(phone, 'Phone');
      await run(phone)(habit('Phone habit'));
      await connect(phone, cloud.backend(), 'u1', 'upload');
      setNow(ist(2026, 11, 2, 11));
      await onboarded(laptop, 'Laptop');
      await run(laptop)(habit('Laptop habit'));
    });

    it('asks', async () => {
      expect(await linkStatus(laptop, cloud.backend(), 'u1')).toBe('choose');
    });

    it('merge keeps both, newest wins per record', async () => {
      await connect(laptop, cloud.backend(), 'u1', 'merge');
      await syncOnce(phone, cloud.backend());
      expect(await titles(laptop)).toEqual(['Laptop habit', 'Phone habit']);
      expect(await titles(phone)).toEqual(['Laptop habit', 'Phone habit']);
      expect((await phone.profile.get('profile'))?.name).toBe('Laptop'); // the later profile
    });

    it('keep this device replaces the account', async () => {
      await connect(laptop, cloud.backend(), 'u1', 'keep_device');
      expect(cloud.get('habits', (await phone.habits.toArray())[0]?.id ?? '')).toBeUndefined();
      expect([...(await titles(laptop))]).toEqual(['Laptop habit']);
    });

    it('use the account’s data replaces this device (photos stay)', async () => {
      await laptop.photos.put({
        ...newBase('ph'),
        day: '2026-11-02',
        blob: new Blob(['x']),
      } as never);
      await connect(laptop, cloud.backend(), 'u1', 'use_cloud');
      expect(await titles(laptop)).toEqual(['Phone habit']);
      expect((await laptop.profile.get('profile'))?.name).toBe('Phone');
      expect(await laptop.photos.count()).toBe(1);
    });
  });

  it('a device last synced with another account asks, even if the new account is empty', async () => {
    await onboarded(phone, 'Rishi');
    await connect(phone, cloud.backend(), 'u1', 'upload');
    expect(await linkStatus(phone, new MemoryCloud().backend(), 'u2')).toBe('choose');
  });
});

describe('sync runner', () => {
  afterEach(() => {
    accountStore.setState({ status: 'signed_out', userId: null, email: null });
    syncStore.setState({ status: 'off', lastSyncedAt: null, message: null });
  });

  it('syncs at sign-in, waits for the choice, and reports a paused cloud quietly', async () => {
    await onboarded(phone, 'Phone');
    await connect(phone, cloud.backend(), 'u1', 'upload');
    await onboarded(laptop, 'Laptop');
    const runner = startSync(() => cloud.backend(), { database: laptop });
    accountStore.setState({ status: 'signed_in', userId: 'u1', email: 'r@x.co' });
    await vi.waitFor(() => expect(syncStore.getState().status).toBe('needs_choice'));

    await runner.choose('merge');
    expect(syncStore.getState().status).toBe('synced');
    expect((await laptop.meta.get(SYNC_META.user))?.value).toBe('u1');

    cloud.down = 'paused';
    await runner.syncNow();
    expect(syncStore.getState().status).toBe('paused');
    cloud.down = false;
    await runner.syncNow();
    expect(syncStore.getState().status).toBe('synced');
    runner.stop();
  });

  it('a full cloud copy says so plainly, keeps the app working, and clears when there is room (V-02)', async () => {
    await onboarded(phone, 'Phone');
    await connect(phone, cloud.backend(), 'u1', 'upload');
    const runner = startSync(() => cloud.backend(), { database: phone, retryMs: [60_000] });
    accountStore.setState({ status: 'signed_in', userId: 'u1', email: null });
    await vi.waitFor(() => expect(syncStore.getState().status).toBe('synced'));

    cloud.down = 'quota';
    await run(phone)(habit('Written while the cloud is full'));
    await runner.syncNow();
    expect(syncStore.getState().status).toBe('error');
    expect(syncStore.getState().message).toMatch(/cloud copy is full/i);
    expect(syncStore.getState().message).toMatch(/Compact old history/);
    // Nothing is lost: the new habit is still on the device, waiting to sync.
    expect((await phone.habits.toArray()).map((h) => h.title)).toContain(
      'Written while the cloud is full',
    );

    cloud.down = false;
    await runner.syncNow();
    expect(syncStore.getState().status).toBe('synced');
    expect(syncStore.getState().message).toBeNull();
    runner.stop();
  });

  it('a fresh device downloads at sign-in and restarts on the new data', async () => {
    await onboarded(phone, 'Phone');
    const h = (await run(phone)(habit('Study'))).value as Habit;
    await connect(phone, cloud.backend(), 'u1', 'upload');
    const replaced = vi.fn();
    const runner = startSync(() => cloud.backend(), {
      database: laptop,
      onLocalDataReplaced: replaced,
    });
    accountStore.setState({ status: 'signed_in', userId: 'u1', email: null });
    await vi.waitFor(() => expect(replaced).toHaveBeenCalled());
    expect((await laptop.habits.get(h.id))?.title).toBe('Study');
    runner.stop();
  });
});

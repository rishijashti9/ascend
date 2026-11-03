import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import { recordAction, type Action } from '@/core/pipeline';
import { loadProgress } from '@/core/state/progress';
import { syncOnce } from '@/core/sync/engine';
import { buildBackup } from '@/core/backup/export';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { generateHistory } from '@/dev/generate';
import { MemoryCloud } from '@/test/memoryBackend';
import { ist } from '@/test/testDb';

/**
 * Compaction end to end (SPEC 6.7 D): the action's rules, sync to another device, the cloud
 * purge, a fresh device downloading, and export / import keeping the summaries.
 */
let phone: AscendDB;
let laptop: AscendDB;
let cloud: MemoryCloud;
const run = (db: AscendDB) => (action: Action) => recordAction(action, { db });
const progressOf = async (db: AscendDB) => {
  const p = await loadProgress(db);
  return { level: p.level, stats: p.stats, rank: p.rank, streak: p.streak, perDay: p.perDay };
};

beforeAll(async () => {
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2025, 3, 1, 10));
  phone = new AscendDB(`phone-${crypto.randomUUID()}`);
  laptop = new AscendDB(`laptop-${crypto.randomUUID()}`);
  await phone.open();
  await laptop.open();
  cloud = new MemoryCloud();
  await generateHistory({ days: 70, seed: 9, database: phone });
  await syncOnce(phone, cloud.backend());
  await syncOnce(laptop, cloud.backend());
  setNow(ist(2026, 6, 15, 10)); // over a year later
}, 180_000);
afterAll(async () => {
  resetClock();
  for (const db of [phone, laptop]) {
    db.close();
    await Dexie.delete(db.name);
  }
});

describe('data.compact', () => {
  it('only history at least a year old, and never the same period twice', async () => {
    await expect(
      run(phone)({
        type: 'data.compact',
        payload: { cutoff_day: '2026-01-01', remove_photos: false },
      }),
    ).rejects.toThrow(/at least a year old/);
  });

  it('compacts on one device; the other device and a fresh one end up identical; the cloud is purged', async () => {
    const before = await progressOf(phone);
    const laptopBefore = await progressOf(laptop);
    expect(laptopBefore).toEqual(before);

    await run(phone)({
      type: 'data.compact',
      payload: { cutoff_day: '2025-02-01', remove_photos: false },
    });
    await expect(
      run(phone)({
        type: 'data.compact',
        payload: { cutoff_day: '2025-02-01', remove_photos: false },
      }),
    ).rejects.toThrow(/already compacted/);
    expect(await progressOf(phone)).toEqual(before);
    const cloudBefore = cloud.size;

    await syncOnce(phone, cloud.backend()); // summaries up, then the cloud drops old detail
    expect(cloud.size).toBeLessThan(cloudBefore);
    expect((await phone.meta.get('sync:purged_cutoff'))?.value).toBe('2025-02-01');

    await syncOnce(laptop, cloud.backend()); // laptop drops its own copy of that detail
    expect(await laptop.xp_events.where('day').below('2025-02-01').count()).toBe(0);
    expect(await progressOf(laptop)).toEqual(before);

    const fresh = new AscendDB(`fresh-${crypto.randomUUID()}`);
    await fresh.open();
    await syncOnce(fresh, cloud.backend());
    expect(await progressOf(fresh)).toEqual(before);
    fresh.close();
    await Dexie.delete(fresh.name);
  }, 120_000);

  it('summaries survive export → import onto a fresh device', async () => {
    const before = await progressOf(phone);
    const backup = await buildBackup(phone);
    expect(backup.tables.summaries?.length).toBeGreaterThan(0);
    const other = new AscendDB(`import-${crypto.randomUUID()}`);
    await other.open();
    await run(other)({ type: 'data.import', payload: { backup, mode: 'replace' } });
    expect(await progressOf(other)).toEqual(before);
    other.close();
    await Dexie.delete(other.name);
  }, 60_000);
});

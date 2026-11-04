import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Dexie from 'dexie';
import { buildBackup } from '@/core/backup/export';
import { planCompaction } from '@/core/compaction/apply';
import { AscendDB } from '@/core/db/db';
import { deleteAllData, openDatabase } from '@/core/db/open';
import { newBase, recordAction, type Action } from '@/core/pipeline';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { getLock, getRules } from './store';

let db: AscendDB;
const run = async <T = unknown>(a: Action, d: AscendDB = db) =>
  (await recordAction<T>(a, { db: d })).value as T;

beforeEach(async () => {
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 4, 10));
  db = new AscendDB(`privacy-${crypto.randomUUID()}`);
  await db.open();
});
afterEach(async () => {
  resetClock();
  db.close();
  await Dexie.delete(db.name);
  localStorage.clear();
});

async function locked(d: AscendDB = db) {
  await run({ type: 'screen.setEnabled', payload: { on: true } }, d);
  await run({ type: 'screen.setLimit', payload: { limit_min: 45 } }, d);
}

describe('only daily totals, and they stay with Rishi', () => {
  it('a screen-time record holds seconds per app per day — nothing else', async () => {
    await run({
      type: 'screen.saveDay',
      payload: {
        device_id: 'phone1',
        day: '2026-11-04',
        apps: { 'com.instagram.android': 600 },
        focus: {},
        labels: { 'com.instagram.android': 'Instagram' },
        games: [],
      },
    });
    const rec = await db.screen_days.get('phone1:2026-11-04');
    const { id, created_at, updated_at, deleted_at, schema_version, hlc, ...rest } = rec ?? {};
    void [id, created_at, updated_at, deleted_at, schema_version, hlc];
    expect(Object.keys(rest).sort()).toEqual([
      'apps',
      'day',
      'device_id',
      'focus',
      'games',
      'labels',
    ]);
  });

  it('is never part of what Ask the System can send', () => {
    const dir = join(process.cwd(), 'src', 'core', 'ask');
    for (const file of readdirSync(dir).filter((f) => !f.includes('.test.'))) {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(src, file).not.toMatch(/screen_|screentime|screenTime/);
    }
  });

  it('is included in the export', async () => {
    await locked();
    const backup = await buildBackup(db);
    expect(backup.tables.screen_rules?.length).toBe(1);
    expect(backup.tables.screen_locks?.length).toBe(1);
  });
});

describe('compaction keeps monthly totals per app', () => {
  it('old days become the month’s totals; newer days are untouched', async () => {
    const day = (d: string, sec: number) =>
      db.screen_days.put({
        ...newBase(`p:${d}`),
        device_id: 'p',
        day: d,
        apps: { 'com.instagram.android': sec },
        focus: {},
        labels: { 'com.instagram.android': 'Instagram' },
        games: [],
      });
    await day('2025-03-01', 600);
    await day('2025-03-02', 900);
    await day('2026-11-03', 300);
    const plan = await planCompaction(db, '2025-11-01', false);
    expect(plan.remove.screen_days?.sort()).toEqual(['p:2025-03-01', 'p:2025-03-02']);
    expect(plan.months.get('2025-03')?.screen).toEqual({
      days: 2,
      apps: { 'com.instagram.android': 1500 },
      labels: { 'com.instagram.android': 'Instagram' },
      games: [],
    });
  });
});

describe('clearing data never removes an active lock', () => {
  it('"Delete everything" / "Reset all data": the lock and rules come back on the fresh database', async () => {
    const name = `wipe-${crypto.randomUUID()}`;
    const phone = new AscendDB(name);
    await phone.open();
    await locked(phone);
    const end = (await getLock(phone))?.end_at;
    await deleteAllData(phone);
    const fresh = new AscendDB(name);
    await openDatabase(fresh);
    expect((await getLock(fresh))?.end_at).toBe(end);
    expect(await getRules(fresh)).toMatchObject({ enabled: true, limit_min: 45 });
    expect(await fresh.screen_days.count()).toBe(0);
    fresh.close();
    await Dexie.delete(name);
  });

  it('without a lock nothing is kept', async () => {
    const name = `wipe-${crypto.randomUUID()}`;
    const phone = new AscendDB(name);
    await phone.open();
    await run({ type: 'screen.setEnabled', payload: { on: true } }, phone);
    await deleteAllData(phone);
    const fresh = new AscendDB(name);
    await openDatabase(fresh);
    expect(await getRules(fresh)).toBeUndefined();
    fresh.close();
    await Dexie.delete(name);
  });

  it('taking an account’s data on sign-in keeps this phone’s active lock', async () => {
    await locked();
    const end = (await getLock(db))?.end_at;
    await run({ type: 'sync.link', source: 'sync', payload: { userId: 'u1', clearLocal: true } });
    expect((await getLock(db))?.end_at).toBe(end);
    expect((await getRules(db))?.limit_min).toBe(45);
  });
});

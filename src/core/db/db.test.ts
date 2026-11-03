import Dexie from 'dexie';
import { DEFAULT_SETTINGS } from '@/config/defaults';
import { ALL_TABLES, AscendDB, DB_VERSION, SCHEMA_VERSION, STORES_V1 } from './db';
import { deleteAllData, openDatabase, requestPersistentStorage } from './open';
import type { XpEvent } from './types';

let database: AscendDB;

beforeEach(async () => {
  database = new AscendDB(`test-${crypto.randomUUID()}`);
  await database.open();
});

afterEach(async () => {
  database.close();
  await Dexie.delete(database.name);
});

function xpEvent(id: string, key: string): XpEvent {
  const at = new Date().toISOString();
  return {
    id,
    created_at: at,
    updated_at: at,
    deleted_at: null,
    schema_version: SCHEMA_VERSION,
    hlc: '0',
    day: '2026-11-02',
    occurred_at: at,
    stat: 'INT',
    base_amount: 50,
    reason: 'quest_full',
    idempotency_key: key,
    ref_type: 'quest_instance',
    ref_id: 'habit1:2026-11-02',
  };
}

describe('database schema', () => {
  it('creates every table from the plan', () => {
    const names = database.tables.map((t) => t.name).sort();
    expect(names).toEqual([...ALL_TABLES].sort());
    expect(names).toHaveLength(26);
  });

  it('creates default settings on first open, pre-filled from DECISIONS', async () => {
    const settings = await database.settings.get('settings');
    expect(settings).toMatchObject(DEFAULT_SETTINGS);
    expect(settings?.day_start_hour).toBe(3);
    expect(settings?.wake_time).toBe('05:00');
    expect(settings?.wake_late_cutoff).toBe('07:00');
    expect(settings?.schema_version).toBe(SCHEMA_VERSION);
  });

  it('does not overwrite settings when opened again', async () => {
    await database.settings.update('settings', { wake_time: '06:00' });
    database.close();
    const again = new AscendDB(database.name);
    await again.open();
    expect((await again.settings.get('settings'))?.wake_time).toBe('06:00');
    again.close();
  });

  it('rejects a second XP event with the same idempotency key', async () => {
    await database.xp_events.add(xpEvent('a', 'habit1:2026-11-02:full:0'));
    await expect(
      database.xp_events.add(xpEvent('b', 'habit1:2026-11-02:full:0')),
    ).rejects.toThrow();
    expect(await database.xp_events.count()).toBe(1);
  });

  it('finds quest instances by the [source_id+day] index', async () => {
    const at = new Date().toISOString();
    await database.quest_instances.add({
      id: 'habit1:2026-11-02',
      created_at: at,
      updated_at: at,
      deleted_at: null,
      schema_version: SCHEMA_VERSION,
      hlc: '0',
      source_type: 'habit',
      source_id: 'habit1',
      day: '2026-11-02',
      status: 'pending',
      title_snapshot: 'Workout',
      stat_snapshot: 'STR',
      difficulty_snapshot: 'normal',
      measure_snapshot: 'check',
      target_snapshot: null,
      min_snapshot: null,
      full_version_snapshot: '30 min workout',
      min_version_snapshot: '10 push-ups',
      core_snapshot: true,
      auto_source_snapshot: 'none',
      completed_at: null,
      completed_via: null,
      award_revision: 0,
    });
    const found = await database.quest_instances
      .where('[source_id+day]')
      .equals(['habit1', '2026-11-02'])
      .first();
    expect(found?.title_snapshot).toBe('Workout');
  });

  it('queries xp events by day range', async () => {
    await database.xp_events.bulkAdd([
      { ...xpEvent('1', 'k1'), day: '2026-11-01' },
      { ...xpEvent('2', 'k2'), day: '2026-11-02' },
      { ...xpEvent('3', 'k3'), day: '2026-11-05' },
    ]);
    const inRange = await database.xp_events
      .where('day')
      .between('2026-11-02', '2026-11-04', true, true)
      .toArray();
    expect(inRange.map((e) => e.id)).toEqual(['2']);
  });
});

describe('upgrade from v1 (Phase 8 adds tables, keeps every record)', () => {
  it('opens a v1 database with data as v2 without changing a record', async () => {
    const name = `test-v1-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores(STORES_V1);
    await old.open();
    const at = new Date().toISOString();
    const base = { created_at: at, updated_at: at, deleted_at: null, schema_version: 1, hlc: 'h' };
    await old.table('settings').add({ id: 'settings', ...base, ...DEFAULT_SETTINGS });
    await old.table('xp_events').add(xpEvent('x1', 'k1'));
    await old.table('days').add({ id: '2026-11-02', ...base, day: '2026-11-02', active: true });
    const before = {
      settings: await old.table('settings').toArray(),
      xp: await old.table('xp_events').toArray(),
      days: await old.table('days').toArray(),
    };
    old.close();

    const upgraded = new AscendDB(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(DB_VERSION);
    expect(await upgraded.settings.toArray()).toEqual(before.settings);
    expect(await upgraded.xp_events.toArray()).toEqual(before.xp);
    expect(await upgraded.days.toArray()).toEqual(before.days);
    expect(await upgraded.learning_events.count()).toBe(0);
    await upgraded.learning_events.add({
      id: 'e1',
      ...base,
      kind: 'app_open',
      type: 'open',
      outcome: null,
      at,
      day: '2026-11-02',
      ref_id: null,
      values: null,
    });
    expect(
      await upgraded.learning_events.where('[kind+type]').equals(['app_open', 'open']).count(),
    ).toBe(1);
    upgraded.close();
    await Dexie.delete(name);
  });
});

describe('opening and persistence', () => {
  it('openDatabase opens a closed database', async () => {
    database.close();
    await openDatabase(database);
    expect(database.isOpen()).toBe(true);
  });

  it('records the persistent-storage result', async () => {
    const result = await requestPersistentStorage(database);
    expect(['granted', 'denied', 'unsupported']).toContain(result);
    expect((await database.meta.get('storage_persist'))?.value).toBe(result);
  });

  it('asks the browser to persist when supported', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { persist, persisted: vi.fn().mockResolvedValue(false) },
    });
    expect(await requestPersistentStorage(database)).toBe('granted');
    expect(persist).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

describe('deleteAllData', () => {
  it('removes every record; reopening starts fresh with default settings', async () => {
    await database.meta.put({ id: 'x', value: 1 });
    await deleteAllData(database);
    const fresh = new AscendDB(database.name);
    await fresh.open();
    expect(await fresh.meta.get('x')).toBeUndefined();
    expect((await fresh.settings.get('settings'))?.wake_time).toBe(DEFAULT_SETTINGS.wake_time);
    fresh.close();
    await Dexie.delete(fresh.name);
  });
});

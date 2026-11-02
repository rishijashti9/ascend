import Dexie from 'dexie';
import { AscendDB, SCHEMA_VERSION } from '@/core/db/db';
import { recordAction, type ImportResult } from '@/core/pipeline';
import { loadProgress } from '@/core/state/progress';
import { setNow } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { createTestDb, ist } from '@/test/testDb';
import { buildBackup } from './export';
import { BACKUP_FORMAT, parseBackup } from './format';

let t: Awaited<ReturnType<typeof createTestDb>>;
const extra: AscendDB[] = [];

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  for (const d of extra.splice(0)) {
    d.close();
    await Dexie.delete(d.name);
  }
  await t.cleanup();
});

async function freshDb(): Promise<AscendDB> {
  const d = new AscendDB(`test-${crypto.randomUUID()}`);
  await d.open();
  extra.push(d);
  return d;
}

const importInto = async (d: AscendDB, backup: unknown, mode: 'replace' | 'merge') =>
  (await recordAction<ImportResult>({ type: 'data.import', payload: { mode, backup } }, { db: d }))
    .value as ImportResult;

/** Onboard, then three days with real completions and rollovers. */
async function liveSomeDays() {
  await t.run({
    type: 'onboarding.complete',
    payload: {
      name: 'Rishi',
      wake_time: '05:00',
      theme: 'dark',
      start: 'today',
      habits: STARTER_HABITS.filter((h) => h.selected).map(habitFieldsOf),
      dream: null,
      main_quests: [],
    },
  });
  for (let i = 1; i <= 3; i++) {
    setNow(ist(2026, 11, 2 + i, 10));
    await t.run({ type: 'day.rollover', payload: {} });
    const instances = await t.db.quest_instances
      .where('day')
      .equals(`2026-11-0${2 + i}`)
      .toArray();
    for (const inst of instances) {
      if (inst.measure_snapshot === 'check' && inst.auto_source_snapshot !== 'wake_checkin') {
        await t.run({ type: 'quest.complete', payload: { instanceId: inst.id, version: 'full' } });
      } else if (inst.measure_snapshot === 'minutes') {
        await t.run({ type: 'quest.logProgress', payload: { instanceId: inst.id, amount: 30 } });
      }
    }
  }
}

describe('export → wipe → import', () => {
  it('gives identical progress and records', async () => {
    await liveSomeDays();
    const before = await loadProgress(t.db);
    const backup = JSON.parse(JSON.stringify(await buildBackup(t.db))) as unknown;

    const restored = await freshDb();
    const result = await importInto(restored, backup, 'replace');
    expect(result.rebuild.daysFixed).toBe(0);
    expect(await loadProgress(restored)).toEqual(before);
    for (const table of ['habits', 'quest_instances', 'xp_events', 'days', 'profile'] as const) {
      expect(await restored.table(table).count()).toBe(await t.db.table(table).count());
    }
    expect((await restored.settings.get('settings'))?.theme).toBe('dark');
  });

  it('never exports photos or device-local meta', async () => {
    await t.db.meta.put({ id: 'secret', value: 1 });
    const backup = await buildBackup(t.db);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.schema_version).toBe(SCHEMA_VERSION);
    expect(Object.keys(backup.tables)).not.toContain('photos');
    expect(Object.keys(backup.tables)).not.toContain('meta');
  });

  it('replace: the device ends up with exactly the backup, keeping settings if the file has none', async () => {
    await liveSomeDays();
    const empty = await buildBackup(await freshDb());
    const noSettings = { ...empty, tables: { ...empty.tables, settings: [] } };
    await importInto(t.db, noSettings, 'replace');
    expect(await t.db.habits.count()).toBe(0);
    expect(await t.db.xp_events.count()).toBe(0);
    expect(await t.db.settings.get('settings')).toBeDefined();
  });
});

describe('merge', () => {
  it('never counts the same XP twice and keeps the newer version of each record', async () => {
    await liveSomeDays();
    const backup = await buildBackup(t.db);
    const xpBefore = await t.db.xp_events.count();

    // Same awards under different record ids (as if earned on another device) are skipped.
    const twins = (backup.tables.xp_events ?? []).map((e) => ({
      ...(e as object),
      id: crypto.randomUUID(),
    }));
    const r = await importInto(
      t.db,
      { ...backup, tables: { ...backup.tables, xp_events: twins } },
      'merge',
    );
    expect(await t.db.xp_events.count()).toBe(xpBefore);
    expect(r.written).toBe(0);

    // A newer edit in the file wins; an older one doesn't.
    const habit = (await t.db.habits.toArray())[0];
    if (!habit) throw new Error('no habit');
    const newer = { ...habit, title: 'Renamed elsewhere', hlc: `9${habit.hlc.slice(1)}` };
    const older = { ...habit, title: 'Old name', hlc: `0${habit.hlc.slice(1)}` };
    await importInto(t.db, { ...backup, tables: { habits: [older] } }, 'merge');
    expect((await t.db.habits.get(habit.id))?.title).toBe(habit.title);
    await importInto(t.db, { ...backup, tables: { habits: [newer] } }, 'merge');
    expect((await t.db.habits.get(habit.id))?.title).toBe('Renamed elsewhere');
  });
});

describe('parseBackup', () => {
  it('accepts a real backup', async () => {
    expect(parseBackup(JSON.parse(JSON.stringify(await buildBackup(t.db)))).ok).toBe(true);
  });

  it('explains what is wrong in plain words', async () => {
    const good = JSON.parse(JSON.stringify(await buildBackup(t.db))) as Record<string, unknown>;
    expect(parseBackup({ hello: 1 })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not an ASCEND backup/),
    });
    expect(parseBackup({ ...good, schema_version: SCHEMA_VERSION + 1 })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer version of ASCEND/),
    });
    const tables = good.tables as Record<string, unknown[]>;
    const damaged = { ...good, tables: { ...tables, days: [{ id: 'x', day: 'yesterday' }] } };
    expect(parseBackup(damaged).ok).toBe(false);
  });

  it('import refuses an invalid file and changes nothing', async () => {
    await liveSomeDays();
    const count = await t.db.habits.count();
    await expect(importInto(t.db, { format: 'nope' }, 'replace')).rejects.toThrow();
    expect(await t.db.habits.count()).toBe(count);
  });
});

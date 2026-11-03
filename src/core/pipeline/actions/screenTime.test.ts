import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import { recordAction, type Action } from '@/core/pipeline';
import { DAY_MS } from '@/core/screentime/lock';
import { getLock, getRules, lockStatus } from '@/core/screentime/store';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { buildBackup } from '@/core/backup/export';
import type { RuleResult } from './screenTime';

let db: AscendDB;
const run = async <T = unknown>(a: Action) => (await recordAction<T>(a, { db })).value as T;
const server = (ms: number) =>
  run({ type: 'screen.noteServerTime', source: 'system', payload: { ms } });

beforeEach(async () => {
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 4, 10));
  db = new AscendDB(`screen-${crypto.randomUUID()}`);
  await db.open();
});
afterEach(async () => {
  resetClock();
  db.close();
  await Dexie.delete(db.name);
});

const T0 = ist(2026, 11, 4, 10);
/** The test clock keeps running after setNow, so instants are compared within a second. */
const near = (ms: number) => expect.closeTo(ms, -3);

describe('screen-time rules', () => {
  it('nothing is stored until screen time is switched on; on starts the observe week', async () => {
    expect(await getRules(db)).toBeUndefined();
    await run({ type: 'screen.setEnabled', payload: { on: true } });
    expect(await getRules(db)).toMatchObject({
      enabled: true,
      reminders: true,
      limit_min: null,
      observe_start_day: '2026-11-04',
    });
    // Switching off and on again keeps the first observe day.
    await run({ type: 'screen.setEnabled', payload: { on: false } });
    setNow(ist(2026, 11, 6, 10));
    await run({ type: 'screen.setEnabled', payload: { on: true } });
    expect((await getRules(db))?.observe_start_day).toBe('2026-11-04');
  });

  it('accepting the limit locks it for a week (or a month)', async () => {
    await run({ type: 'screen.setEnabled', payload: { on: true } });
    const r = await run<RuleResult>({ type: 'screen.setLimit', payload: { limit_min: 90 } });
    expect(r).toEqual({ deferred: false, lockEndMs: near(T0 + 7 * DAY_MS) });
    expect((await getRules(db))?.limit_min).toBe(90);
    const month = await run<RuleResult>({
      type: 'screen.setLimit',
      payload: { limit_min: 60, lock: 'month' },
    });
    expect(month.lockEndMs).toEqual(near(T0 + 30 * DAY_MS));
  });

  it('during the lock: lower applies (and extends), higher waits with the end date', async () => {
    await run({ type: 'screen.setEnabled', payload: { on: true } });
    await run({ type: 'screen.setLimit', payload: { limit_min: 90 } });
    setNow(T0 + 3 * DAY_MS);
    const lower = await run<RuleResult>({ type: 'screen.setLimit', payload: { limit_min: 60 } });
    expect(lower).toEqual({ deferred: false, lockEndMs: near(T0 + 10 * DAY_MS) });
    const higher = await run<RuleResult>({ type: 'screen.setLimit', payload: { limit_min: 120 } });
    expect(higher).toEqual({ deferred: true, lockEndMs: near(T0 + 10 * DAY_MS) });
    expect(await getRules(db)).toMatchObject({ limit_min: 60, pending: { limit_min: 120 } });
    // Reminders off and removing an app wait too.
    expect(
      (await run<RuleResult>({ type: 'screen.setReminders', payload: { on: false } })).deferred,
    ).toBe(true);
    expect(
      (
        await run<RuleResult>({
          type: 'screen.removeApp',
          payload: { pkg: 'com.instagram.android' },
        })
      ).deferred,
    ).toBe(true);
    expect(await getRules(db)).toMatchObject({ reminders: true, removed_apps: [] });
  });

  it('changing the phone clock never applies waiting changes; the server time does', async () => {
    await run({ type: 'screen.setEnabled', payload: { on: true } });
    await run({ type: 'screen.setLimit', payload: { limit_min: 60 } });
    await run({ type: 'screen.setLimit', payload: { limit_min: 120 } });
    // Clock moved a month forward: still locked (no server time past the end).
    setNow(T0 + 30 * DAY_MS);
    expect(await run({ type: 'screen.applyPending', payload: {} })).toBe(false);
    expect((await getRules(db))?.limit_min).toBe(60);
    // The server says the week is over.
    await server(T0 + 7 * DAY_MS + 60_000);
    expect((await lockStatus(db)).active).toBe(false);
    expect(await run({ type: 'screen.applyPending', payload: {} })).toBe(true);
    expect(await getRules(db)).toMatchObject({ limit_min: 120, pending: null });
  });

  it('a clock moved back can’t shorten a new lock', async () => {
    await server(T0);
    setNow(T0 - 6 * DAY_MS);
    await run({ type: 'screen.setEnabled', payload: { on: true } });
    const r = await run<RuleResult>({ type: 'screen.setLimit', payload: { limit_min: 60 } });
    expect(r.lockEndMs).toEqual(near(T0 + 7 * DAY_MS));
  });

  it('adding apps applies at once', async () => {
    await run({ type: 'screen.setEnabled', payload: { on: true } });
    await run({ type: 'screen.setLimit', payload: { limit_min: 60 } });
    const r = await run<RuleResult>({
      type: 'screen.addApp',
      payload: { pkg: 'com.reddit.frontpage' },
    });
    expect(r.deferred).toBe(false);
    expect((await getRules(db))?.added_apps).toEqual(['com.reddit.frontpage']);
  });
});

describe('breaks', () => {
  it('at most 2 a day, 20 minutes each; a new day has 2 again', async () => {
    const b1 = await run<{ untilMs: number; left: number }>({
      type: 'screen.takeBreak',
      payload: {},
    });
    expect(b1).toEqual({ untilMs: near(T0 + 20 * 60_000), left: 1 });
    await run({ type: 'screen.takeBreak', payload: {} });
    await expect(run({ type: 'screen.takeBreak', payload: {} })).rejects.toThrow(
      'Both breaks for today are used.',
    );
    setNow(ist(2026, 11, 5, 10));
    expect((await run<{ left: number }>({ type: 'screen.takeBreak', payload: {} })).left).toBe(1);
  });
});

describe('importing a backup never unlocks', () => {
  it('replace or merge: keeps the later lock and the stricter rules', async () => {
    // An old backup: limit 120, a lock that ended long ago, reminders off.
    await run({ type: 'screen.setEnabled', payload: { on: true } });
    await run({ type: 'screen.setLimit', payload: { limit_min: 120 } });
    await server(T0 + 8 * DAY_MS);
    await run({ type: 'screen.setReminders', payload: { on: false } });
    const old = JSON.parse(JSON.stringify(await buildBackup(db))) as unknown;
    // Now: a new, stricter lock.
    setNow(T0 + 9 * DAY_MS);
    await run({ type: 'screen.setReminders', payload: { on: true } });
    await run({ type: 'screen.setLimit', payload: { limit_min: 45 } });
    const lockBefore = (await getLock(db))?.end_at;
    for (const mode of ['replace', 'merge'] as const) {
      await run({ type: 'data.import', payload: { mode, backup: old } });
      expect((await getLock(db))?.end_at).toBe(lockBefore);
      expect(await getRules(db)).toMatchObject({ limit_min: 45, reminders: true, enabled: true });
    }
  });
});

describe('daily totals', () => {
  it('one record per device per day; an unchanged reading writes nothing', async () => {
    const day = {
      device_id: 'phone1',
      day: '2026-11-04',
      apps: { 'com.instagram.android': 600 },
      focus: {},
      labels: { 'com.instagram.android': 'Instagram' },
      games: [],
    };
    expect(await run({ type: 'screen.saveDay', payload: day })).toBe(true);
    expect(await run({ type: 'screen.saveDay', payload: day })).toBe(false);
    expect(
      await run({
        type: 'screen.saveDay',
        payload: { ...day, apps: { 'com.instagram.android': 900 } },
      }),
    ).toBe(true);
    expect((await db.screen_days.get('phone1:2026-11-04'))?.apps).toEqual({
      'com.instagram.android': 900,
    });
    expect(await getLock(db)).toBeUndefined();
  });
});

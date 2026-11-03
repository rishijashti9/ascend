import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import { recordAction, type Action } from '@/core/pipeline';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import type { ScreenBridge, ScreenStatus } from './bridge';
import { brokenKinds, checkIntegrity } from './integrity';
import { DAY_MS } from './lock';
import { getLock } from './store';

let db: AscendDB;
const run = async <T = unknown>(a: Action) => (await recordAction<T>(a, { db })).value as T;
const T0 = ist(2026, 11, 4, 10);

beforeEach(async () => {
  setTimeZoneOverride('Asia/Kolkata');
  setNow(T0);
  db = new AscendDB(`integrity-${crypto.randomUUID()}`);
  await db.open();
});
afterEach(async () => {
  resetClock();
  db.close();
  await Dexie.delete(db.name);
});

const ok: ScreenStatus = { usageAccess: true, notifications: true, channel: true };
const phone = (s: ScreenStatus): ScreenBridge => ({
  available: () => true,
  status: () => Promise.resolve(s),
  openUsageAccess: () => Promise.resolve(),
  openNotificationSettings: () => Promise.resolve(),
  totals: () => Promise.resolve({ apps: {}, labels: {}, games: [] }),
  setRules: () => Promise.resolve(),
});
const lockEnd = async () => Date.parse((await getLock(db))?.end_at ?? '');
const open = async () =>
  (await db.screen_events.where('kind').equals('incident').toArray()).filter((e) => !e.resolved_at);

async function locked() {
  await run({ type: 'screen.setEnabled', payload: { on: true } });
  await run({ type: 'screen.setLimit', payload: { limit_min: 60 } });
}

describe('what counts as switched off', () => {
  it('notifications off, only the screen-time channel off, or Usage access removed', () => {
    expect(brokenKinds(ok)).toEqual([]);
    expect(brokenKinds({ ...ok, notifications: false, channel: false })).toEqual([
      'notifications_off',
    ]);
    expect(brokenKinds({ ...ok, channel: false })).toEqual(['channel_off']);
    expect(brokenKinds({ ...ok, usageAccess: false })).toEqual(['usage_access_off']);
  });
});

describe('incidents during a lock', () => {
  it('channel switched off: +7 days once, a banner until fixed; fixing closes it', async () => {
    await locked();
    const before = await lockEnd();
    await checkIntegrity(phone({ ...ok, channel: false }), db);
    expect(await lockEnd()).toBe(before + 7 * DAY_MS);
    expect((await open()).map((e) => e.incident)).toEqual(['channel_off']);
    // Still off on the next check: the same incident, no second extension.
    await checkIntegrity(phone({ ...ok, channel: false }), db);
    expect(await lockEnd()).toBe(before + 7 * DAY_MS);
    // Fixed: the banner goes; the extension stays.
    await checkIntegrity(phone(ok), db);
    expect(await open()).toEqual([]);
    expect(await lockEnd()).toBe(before + 7 * DAY_MS);
    // Switched off again later: a new incident, 7 more days.
    await checkIntegrity(phone({ ...ok, usageAccess: false, notifications: false }), db);
    expect(await lockEnd()).toBe(before + 21 * DAY_MS);
    expect((await open()).map((e) => e.incident).sort()).toEqual([
      'notifications_off',
      'usage_access_off',
    ]);
  });

  it('no lock, or screen time never on: nothing counts', async () => {
    await checkIntegrity(phone({ ...ok, channel: false }), db);
    expect(await open()).toEqual([]);
    await run({ type: 'screen.setEnabled', payload: { on: true } }); // observe week, no lock yet
    await checkIntegrity(phone({ ...ok, channel: false }), db);
    expect(await open()).toEqual([]);
    expect(await getLock(db)).toBeUndefined();
  });

  it('never touches XP', async () => {
    await locked();
    await checkIntegrity(phone({ ...ok, usageAccess: false }), db);
    expect(await db.xp_events.count()).toBe(0);
  });
});

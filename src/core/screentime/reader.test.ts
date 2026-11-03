import Dexie from 'dexie';
import { DEFAULT_SETTINGS } from '@/config/defaults';
import { AscendDB } from '@/core/db/db';
import { getDeviceId } from '@/core/db/hlc';
import { newBase, recordAction } from '@/core/pipeline';
import { instantAt, resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import type { ScreenBridge, UsageTotals } from './bridge';
import { readScreenTime } from './reader';
import { buildSnapshot, snapshotFromDb } from './snapshot';

let db: AscendDB;
const tz = 'Asia/Kolkata';
beforeEach(async () => {
  setTimeZoneOverride(tz);
  setNow(ist(2026, 11, 4, 20));
  db = new AscendDB(`reader-${crypto.randomUUID()}`);
  await db.open();
});
afterEach(async () => {
  resetClock();
  db.close();
  await Dexie.delete(db.name);
});

/** A fake phone: Instagram 10 min and YouTube 60 min a day, 30 of them in a focus session. */
function fakeBridge(access = true): ScreenBridge & { calls: [number, number][] } {
  const calls: [number, number][] = [];
  return {
    calls,
    available: () => true,
    status: () => Promise.resolve({ usageAccess: access, notifications: true, channel: true }),
    openUsageAccess: () => Promise.resolve(),
    openNotificationSettings: () => Promise.resolve(),
    setRules: () => Promise.resolve(),
    totals(start, end): Promise<UsageTotals> {
      calls.push([start, end]);
      const short = end - start < 3 * 3_600_000; // a focus-session query
      const apps: Record<string, number> = short
        ? { 'com.google.android.youtube': 1800 }
        : { 'com.instagram.android': 600, 'com.google.android.youtube': 3600 };
      return Promise.resolve({
        apps,
        labels: { 'com.instagram.android': 'Instagram', 'com.google.android.youtube': 'YouTube' },
        games: [],
      });
    },
  };
}

const enable = () => recordAction({ type: 'screen.setEnabled', payload: { on: true } }, { db });

describe('reading the phone’s totals', () => {
  it('does nothing until screen time is on and Usage access is granted', async () => {
    const bridge = fakeBridge(false);
    expect(await readScreenTime(bridge, db)).toBe(0);
    await enable();
    expect(await readScreenTime(bridge, db)).toBe(0);
    expect(bridge.calls).toEqual([]);
  });

  it('reads yesterday and today (by ASCEND days) into one record per device per day', async () => {
    await enable();
    const bridge = fakeBridge();
    expect(await readScreenTime(bridge, db)).toBe(2);
    const id = `${getDeviceId()}:2026-11-04`;
    const today = await db.screen_days.get(id);
    expect(today?.apps).toEqual({
      'com.instagram.android': 600,
      'com.google.android.youtube': 3600,
    });
    expect(today?.labels['com.instagram.android']).toBe('Instagram');
    // Today runs from 03:00 (day-start hour) until now; yesterday is a whole day.
    expect(bridge.calls).toContainEqual([
      instantAt('2026-11-04', '03:00', tz),
      expect.closeTo(ist(2026, 11, 4, 20), -3),
    ]);
    expect(bridge.calls).toContainEqual([
      instantAt('2026-11-03', '03:00', tz),
      instantAt('2026-11-04', '03:00', tz),
    ]);
    // Reading again with nothing new writes nothing.
    expect(await readScreenTime(bridge, db)).toBe(0);
  });

  it('keeps YouTube time inside focus sessions apart (it doesn’t count)', async () => {
    await enable();
    await db.focus_sessions.add({
      ...newBase('s1'),
      quest_instance_id: null,
      stat: 'INT',
      skill_ids: [],
      planned_min: 50,
      break_min: 10,
      actual_min: 50,
      completed: true,
      started_at: new Date(ist(2026, 11, 4, 15)).toISOString(),
      ended_at: new Date(ist(2026, 11, 4, 15, 50)).toISOString(),
      day: '2026-11-04',
      face_down: false,
    });
    await readScreenTime(fakeBridge(), db);
    const today = await db.screen_days.get(`${getDeviceId()}:2026-11-04`);
    expect(today?.focus).toEqual({ 'com.google.android.youtube': 1800 });
  });
});

describe('the rules snapshot for the phone', () => {
  it('has no usage data — only rules — and folds added/removed apps into one list', () => {
    const snap = buildSnapshot({
      rules: {
        ...newBase('screen_rules'),
        enabled: true,
        reminders: true,
        limit_min: 60,
        added_apps: ['com.reddit.frontpage'],
        removed_apps: ['com.cricbuzz.android'],
        pending: null,
        observe_start_day: '2026-11-01',
      },
      settings: {
        day_start_hour: 3,
        quiet_hours: { start: '22:00', end: '04:45' },
        notifications: DEFAULT_SETTINGS.notifications,
      },
      tz,
      focus: null,
      youtubeFocusSec: 0,
      breaks: { day: '2026-11-04', count: 1, lastAtMs: 1000 },
    });
    expect(snap).toMatchObject({
      enabled: true,
      remindersOn: true,
      limitMin: 60,
      windDown: '21:00',
    });
    expect(snap.packages).toContain('com.reddit.frontpage');
    expect(snap.packages).toContain('com.instagram.android');
    expect(snap.packages).not.toContain('com.cricbuzz.android');
    expect(snap.breakUntilMs).toBe(1000 + 20 * 60_000);
    expect(JSON.stringify(snap)).not.toMatch(/apps|seconds/);
  });

  it('reads breaks and a running focus session from the database', async () => {
    await enable();
    await recordAction({ type: 'screen.takeBreak', payload: {} }, { db });
    const snap = await snapshotFromDb(db);
    expect(snap).toMatchObject({ breaksDay: '2026-11-04', breaksCount: 1, enabled: true });
    expect(snap.limitMin).toBeNull();
  });
});

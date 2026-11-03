import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import { getDeviceId } from '@/core/db/hlc';
import type { ScreenDay } from '@/core/db/types';
import { habitInstanceId } from '@/core/engine/instances';
import { newBase, recordAction, type Action } from '@/core/pipeline';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { judgeRecentDays } from './judge';
import { compareWeeks, weekLine } from './review';

let db: AscendDB;
const run = async <T = unknown>(a: Action) => (await recordAction<T>(a, { db })).value as T;

beforeEach(async () => {
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 4, 10));
  db = new AscendDB(`judge-${crypto.randomUUID()}`);
  await db.open();
  await db.profile.put({
    ...newBase('profile'),
    name: 'Rishi',
    start_day: '2026-11-01',
    onboarded_at: new Date(ist(2026, 11, 1, 10)).toISOString(),
    display_title: null,
  });
});
afterEach(async () => {
  resetClock();
  db.close();
  await Dexie.delete(db.name);
});

const reading = (day: string, instagramSec: number) =>
  run({
    type: 'screen.saveDay',
    payload: {
      device_id: getDeviceId(),
      day,
      apps: { 'com.instagram.android': instagramSec, 'org.ros.docs': 7200 },
      focus: {},
      labels: {},
      games: [],
    },
  });

async function setUp() {
  await run({ type: 'screen.setEnabled', payload: { on: true } });
  await run({ type: 'screen.setLimit', payload: { limit_min: 60 } });
  const habit = (await db.habits.toArray()).find((h) => h.auto_source === 'screen_time');
  if (!habit) throw new Error('no Digital discipline quest');
  return habit;
}

describe('the Digital discipline quest', () => {
  it('is added once when the first limit is accepted (WIL, Easy, check, not core)', async () => {
    const habit = await setUp();
    expect(habit).toMatchObject({
      title: 'Digital discipline',
      stat: 'WIL',
      difficulty: 'easy',
      measure: 'check',
      core: false,
    });
    await run({ type: 'screen.setLimit', payload: { limit_min: 45 } });
    expect((await db.habits.toArray()).filter((h) => h.auto_source === 'screen_time')).toHaveLength(
      1,
    );
  });

  it('is never added again after Rishi archived it', async () => {
    const habit = await setUp();
    await run({ type: 'habit.archive', payload: { id: habit.id } });
    await run({ type: 'screen.setLimit', payload: { limit_min: 30 } });
    expect((await db.habits.toArray()).filter((h) => h.auto_source === 'screen_time')).toHaveLength(
      1,
    );
  });

  it('completes itself for a finished day within the limit — even after the day closed', async () => {
    const habit = await setUp();
    // Tomorrow: today's quest exists; the app reads today's final 50 minutes and judges it.
    await reading('2026-11-04', 50 * 60);
    setNow(ist(2026, 11, 5, 6));
    await run({ type: 'day.rollover', payload: {} }); // closes the 4th: the quest is missed for now
    expect((await db.quest_instances.get(habitInstanceId(habit.id, '2026-11-04')))?.status).toBe(
      'missed',
    );
    expect(await judgeRecentDays(db)).toBe(1);
    const inst = await db.quest_instances.get(habitInstanceId(habit.id, '2026-11-04'));
    expect(inst).toMatchObject({ status: 'done_full', completed_via: 'screen_time' });
    const xp = await db.xp_events
      .where('ref_id')
      .equals(inst?.id ?? '')
      .toArray();
    expect(xp.map((e) => [e.day, e.stat, e.base_amount])).toEqual([['2026-11-04', 'WIL', 10]]);
    // Judging again never awards twice.
    expect(await judgeRecentDays(db)).toBe(0);
  });

  it('stays missed over the limit, or without readings; today is never judged', async () => {
    const habit = await setUp();
    await reading('2026-11-04', 61 * 60);
    setNow(ist(2026, 11, 6, 6));
    await run({ type: 'day.rollover', payload: {} });
    await judgeRecentDays(db);
    expect((await db.quest_instances.get(habitInstanceId(habit.id, '2026-11-04')))?.status).toBe(
      'missed',
    );
    expect((await db.quest_instances.get(habitInstanceId(habit.id, '2026-11-05')))?.status).toBe(
      'missed',
    );
    expect((await db.quest_instances.get(habitInstanceId(habit.id, '2026-11-06')))?.status).toBe(
      'pending',
    );
  });

  it('work and study apps never count toward the limit', async () => {
    const habit = await setUp();
    await run({
      type: 'screen.saveDay',
      payload: {
        device_id: getDeviceId(),
        day: '2026-11-04',
        apps: { 'org.ros.docs': 6 * 3600, 'com.android.chrome': 3 * 3600 },
        focus: {},
        labels: {},
        games: [],
      },
    });
    setNow(ist(2026, 11, 5, 6));
    await run({ type: 'day.rollover', payload: {} });
    await judgeRecentDays(db);
    expect((await db.quest_instances.get(habitInstanceId(habit.id, '2026-11-04')))?.status).toBe(
      'done_full',
    );
  });

  it('can’t be ticked by hand', async () => {
    const habit = await setUp();
    await run({ type: 'day.rollover', payload: {} }); // creates today's quest
    await expect(
      run({
        type: 'quest.complete',
        payload: { instanceId: habitInstanceId(habit.id, '2026-11-04'), version: 'full' },
      }),
    ).rejects.toThrow('completes itself');
  });
});

describe('the weekly review line', () => {
  const day = (d: string, sec: number): ScreenDay => ({
    ...newBase(`p:${d}`),
    device_id: 'p',
    day: d,
    apps: { 'com.instagram.android': sec },
    focus: {},
    labels: {},
    games: [],
  });
  const none = { added_apps: [], removed_apps: [] };

  it('compares the same days of last week, calmly', () => {
    const records = [
      day('2026-10-26', 3600),
      day('2026-10-27', 3600),
      day('2026-10-28', 3600),
      day('2026-11-02', 1800),
      day('2026-11-03', 1800),
    ];
    const c = compareWeeks(records, none, '2026-11-02', '2026-11-04');
    expect(c).toEqual({ thisSec: 3600, lastSec: 3 * 3600, hasLast: true });
    expect(weekLine(c)).toBe(
      'Entertainment this week: 1h 00m — 2h 00m less than the same days last week.',
    );
    expect(weekLine({ thisSec: 600, lastSec: 0, hasLast: false })).toBe(
      'Entertainment this week: 10 min.',
    );
    expect(weekLine({ thisSec: 3600, lastSec: 3700, hasLast: true })).toContain('about the same');
  });
});

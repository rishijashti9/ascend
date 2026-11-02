import type { Habit } from '@/core/db/types';
import { addDays, setNow, setTimeZoneOverride } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { newBase, recoveryQuestId, type RolloverResult } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
const START = '2026-11-02';
const day = (i: number) => addDays(START, i);
/** 10:00 IST on day i. */
const at = (i: number, h = 10) => ist(2026, 11, 2 + i, h);

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

async function onboard(startDay = START) {
  await t.db.profile.put({
    ...newBase('profile'),
    name: 'Rishi',
    start_day: startDay,
    onboarded_at: null,
    display_title: null,
  });
}

async function habit(title: string, core: boolean): Promise<string> {
  const payload = {
    title,
    stat: 'STR',
    difficulty: 'normal',
    measure: 'check',
    full_version: 'full',
    min_version: 'min',
    core,
  };
  return ((await t.run<Habit>({ type: 'habit.create', payload })).value as Habit).id;
}

async function rollover(): Promise<RolloverResult> {
  const r = await t.run<RolloverResult>({ type: 'day.rollover', payload: {}, source: 'rollover' });
  return r.value as RolloverResult;
}

async function complete(habitId: string, i: number) {
  await t.run({
    type: 'quest.complete',
    payload: { instanceId: `${habitId}:${day(i)}`, version: 'full' },
  });
}

/** Starts at day 0; for each char: A = core quest done, M = missed. Ends on the next day. */
async function live(pattern: string, core: string) {
  for (const [i, c] of [...pattern].entries()) {
    setNow(at(i));
    await rollover();
    if (c === 'A') await complete(core, i);
  }
  setNow(at(pattern.length));
  return rollover();
}

describe('day.rollover', () => {
  it('closes yesterday, marks unfinished quests missed and starts today', async () => {
    await onboard();
    const core = await habit('Workout', true);
    const other = await habit('Journal', false);
    const r = await live('A', core);

    expect(r).toMatchObject({ today: day(1), closedDays: [day(0)], daysAway: 0 });
    const d0 = await t.db.days.get(day(0));
    expect(d0).toMatchObject({ active: true, streak_after: 1 });
    expect(d0?.closed_at).not.toBeNull();
    expect((await t.db.quest_instances.get(`${other}:${day(0)}`))?.status).toBe('missed');
    expect((await t.db.quest_instances.get(`${core}:${day(1)}`))?.status).toBe('pending');
    expect(await t.db.days.get(day(1))).toMatchObject({ streak_at_start: 1, closed_at: null });
  });

  it('running twice changes nothing', async () => {
    await onboard();
    const core = await habit('Workout', true);
    await live('AA', core);
    const before = await t.db.days.toArray();
    const again = await rollover();
    expect(again.closedDays).toEqual([]);
    expect(await t.db.days.toArray()).toEqual(before);
  });

  it('running late closes every missed day in order', async () => {
    await onboard();
    const core = await habit('Workout', true);
    setNow(at(0));
    await rollover();
    await complete(core, 0);
    setNow(at(3));
    const r = await rollover();
    expect(r.closedDays).toEqual([day(0), day(1), day(2)]);
    expect(r.daysAway).toBe(2);
    expect((await t.db.quest_instances.get(`${core}:${day(2)}`))?.status).toBe('missed');
  });

  it('30 days away: one shield used, then a Recovery quest with no repair (fresh start)', async () => {
    await onboard();
    const core = await habit('Workout', true);
    await live('AAAAAAA', core); // 7 active days → 1 shield
    setNow(at(37));
    const r = await rollover();
    expect(r.closedDays).toHaveLength(30);
    expect(r).toMatchObject({ daysAway: 29, shieldsUsed: 1 });
    expect(r.streak).toMatchObject({ streak: 0, longest: 7, daysActive: 7, repairable: null });
    expect(r.recoveryQuestId).toBe(recoveryQuestId(day(37)));
    expect((await t.db.quests.get(recoveryQuestId(day(37))))?.repairs_day).toBeNull();
  });

  it('one missed day: completing the Recovery quest repairs it and keeps the streak bonus', async () => {
    await onboard();
    const core = await habit('Workout', true);
    const r = await live('AAAM', core);
    const id = recoveryQuestId(day(4));
    expect(r.streak.repairable).toEqual({ day: day(3), streak: 3 });
    expect((await t.db.quests.get(id))?.repairs_day).toBe(day(3));
    expect((await t.db.days.get(day(4)))?.streak_at_start).toBe(0);

    await t.run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } });
    expect(await t.db.days.get(day(3))).toMatchObject({ repaired: true, streak_after: 3 });
    expect((await t.db.days.get(day(4)))?.streak_at_start).toBe(3);
    const xp = await t.db.xp_events.where('ref_id').equals(id).toArray();
    expect(xp.map((e) => e.base_amount)).toEqual([10]); // Recovery quest = Easy
  });

  it('an unfinished Recovery quest is closed as not done', async () => {
    await onboard();
    const core = await habit('Workout', true);
    await live('AM', core);
    expect(await t.db.quests.get(recoveryQuestId(day(2)))).toBeDefined();
    setNow(at(3));
    await rollover();
    expect((await t.db.quests.get(recoveryQuestId(day(2))))?.status).toBe('not_done');
    expect((await t.db.quest_instances.get(recoveryQuestId(day(2))))?.status).toBe('missed');
  });

  it('no Recovery quest after a day covered by a shield', async () => {
    await onboard();
    const core = await habit('Workout', true);
    const r = await live('AAAAAAAM', core);
    expect(r).toMatchObject({ shieldsUsed: 1, recoveryQuestId: null });
    expect(r.streak).toMatchObject({ streak: 7, shields: 0 });
  });

  it('a late-arriving widget action re-evaluates a closed day and its streak', async () => {
    await onboard();
    const core = await habit('Workout', true);
    await live('AM', core);
    expect((await t.db.days.get(day(1)))?.active).toBe(false);
    await t.run({
      type: 'quest.complete',
      payload: { instanceId: `${core}:${day(1)}`, version: 'min' },
      source: 'widget',
      occurred_at: new Date(at(1, 21)).toISOString(),
    });
    expect(await t.db.days.get(day(1))).toMatchObject({ active: true, streak_after: 2 });
    expect((await t.db.days.get(day(2)))?.streak_at_start).toBe(2);
  });

  it('timezone change: past days keep their dates and nothing closes early', async () => {
    await onboard();
    const core = await habit('Workout', true);
    setNow(at(0));
    await rollover();
    await complete(core, 0);
    // 06:00 IST on day 1 is still the evening of day 0 in Los Angeles.
    setTimeZoneOverride('America/Los_Angeles');
    setNow(at(1, 6));
    const r = await rollover();
    expect(r).toMatchObject({ today: day(0), closedDays: [] });
    expect(await t.db.days.get(day(0))).toMatchObject({
      closed_at: null,
      timezone: 'Asia/Kolkata',
    });
    // Next LA morning: day 0 closes normally.
    setNow(at(2, 0));
    expect((await rollover()).closedDays).toEqual([day(0)]);
  });

  it('never back-fills a day from before a habit existed', async () => {
    await onboard();
    setNow(at(0));
    await rollover();
    setNow(at(2));
    const later = await habit('Workout', true);
    await rollover();
    expect(await t.db.quest_instances.get(`${later}:${day(0)}`)).toBeUndefined();
    expect(await t.db.quest_instances.get(`${later}:${day(1)}`)).toBeUndefined();
    expect(await t.db.quest_instances.get(`${later}:${day(2)}`)).toBeDefined();
  });

  it('does nothing before onboarding', async () => {
    const r = await rollover();
    expect(r).toMatchObject({ closedDays: [], recoveryQuestId: null });
    expect(await t.db.days.count()).toBe(0);
  });
});

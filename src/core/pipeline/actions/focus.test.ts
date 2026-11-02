import type { FocusSession, Habit } from '@/core/db/types';
import { countedMinutes, timerPhase, unlinkedFocusXp } from '@/core/engine/focus';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { ensureInstancesForDay, RuleError } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
const DAY = '2026-11-02';

beforeEach(async () => {
  t = await createTestDb(ist(2026, 11, 2, 9));
});
afterEach(() => t.cleanup());

async function studyQuest(target = 60, min = 15): Promise<string> {
  const h = (
    await t.run<Habit>({
      type: 'habit.create',
      payload: {
        title: 'Game dev study',
        stat: 'INT',
        difficulty: 'normal',
        measure: 'minutes',
        target_value: target,
        min_value: min,
      },
    })
  ).value as Habit;
  await ensureInstancesForDay(t.db, DAY);
  return `${h.id}:${DAY}`;
}

const start = async (payload: object) =>
  (await t.run<FocusSession>({ type: 'focus.start', payload })).value as FocusSession;
const finish = (id: string, completed: boolean) =>
  t.run({ type: 'focus.finish', payload: { id, completed } });
const at = (h: number, m = 0) => setNow(ist(2026, 11, 2, h, m));

describe('focus engine', () => {
  it('counts planned minutes when completed, real minutes when abandoned', () => {
    const startedAt = new Date(ist(2026, 11, 2, 9)).toISOString();
    expect(
      countedMinutes({
        startedAt,
        endMs: ist(2026, 11, 2, 9, 51),
        plannedMin: 50,
        completed: true,
      }),
    ).toBe(50);
    expect(
      countedMinutes({
        startedAt,
        endMs: ist(2026, 11, 2, 9, 20),
        plannedMin: 50,
        completed: false,
      }),
    ).toBe(20);
    expect(
      countedMinutes({ startedAt, endMs: ist(2026, 11, 2, 11), plannedMin: 50, completed: false }),
    ).toBe(50);
    expect(unlinkedFocusXp(25)).toBe(25);
  });

  it('knows whether it is work, break or over', () => {
    const startedAt = new Date(ist(2026, 11, 2, 9)).toISOString();
    expect(timerPhase(startedAt, ist(2026, 11, 2, 9, 10), 25, 5)).toMatchObject({ phase: 'work' });
    expect(timerPhase(startedAt, ist(2026, 11, 2, 9, 27), 25, 5)).toMatchObject({
      phase: 'break',
      remainingMs: 3 * 60_000,
    });
    expect(timerPhase(startedAt, ist(2026, 11, 2, 9, 31), 25, 5).phase).toBe('over');
  });
});

describe('focus sessions', () => {
  it('linked: minutes go into the quest, which gives the XP — no separate focus XP', async () => {
    const id = await studyQuest();
    const s = await start({ quest_instance_id: id, planned_min: 50, break_min: 10 });
    at(9, 50);
    await finish(s.id, true);
    const inst = await t.db.quest_instances.get(id);
    expect(inst?.status).toBe('done_min'); // 50 of 60 min, past the 15-min minimum
    const xp = await t.db.xp_events.toArray();
    expect(xp.map((e) => e.reason)).toEqual(['quest_min']);
    const entry = (await t.db.progress_entries.toArray())[0];
    expect(entry).toMatchObject({ source: 'focus', amount: 50, ref_id: s.id, day: DAY });

    // A second session tops the quest up to full — still one quest award, never double.
    const s2 = await start({ quest_instance_id: id, planned_min: 25, break_min: 5 });
    at(10, 16);
    await finish(s2.id, true);
    expect((await t.db.quest_instances.get(id))?.status).toBe('done_full');
    expect((await t.db.xp_events.toArray()).map((e) => e.reason).sort()).toEqual([
      'quest_min',
      'quest_topup',
    ]);
  });

  it('unlinked: 1 XP per minute for the chosen stat, only when completed', async () => {
    const s = await start({ stat: 'WIL', planned_min: 25, break_min: 5 });
    at(9, 25);
    await finish(s.id, true);
    expect(await t.db.xp_events.toArray()).toEqual([
      expect.objectContaining({
        stat: 'WIL',
        base_amount: 25,
        reason: 'focus',
        idempotency_key: `focus:${s.id}`,
      }),
    ]);

    const s2 = await start({ stat: 'WIL', planned_min: 25, break_min: 5 });
    setNow(ist(2026, 11, 2, 9, 40) + 1000); // +1 s: the test clock kept running after the start
    await finish(s2.id, false); // abandoned
    expect(await t.db.xp_events.count()).toBe(1);
    expect((await t.db.focus_sessions.get(s2.id))?.actual_min).toBe(15);
  });

  it('abandoned but linked: the minutes really focused still count', async () => {
    const id = await studyQuest();
    const s = await start({ quest_instance_id: id, planned_min: 50 });
    at(9, 20);
    await finish(s.id, false);
    expect((await t.db.quest_instances.get(id))?.status).toBe('done_min'); // 20 ≥ 15
  });

  it('rules: one session at a time, no early "completed", minutes quests only, link or stat', async () => {
    const s = await start({ stat: 'INT', planned_min: 50 });
    await expect(start({ stat: 'INT', planned_min: 25 })).rejects.toThrow(/already running/);
    at(9, 30);
    await expect(finish(s.id, true)).rejects.toThrow(/isn’t finished yet/);
    await finish(s.id, false);
    await expect(finish(s.id, false)).rejects.toThrow(/already ended/);
    await expect(start({ planned_min: 25 })).rejects.toThrow();
    const check = (
      await t.run<Habit>({
        type: 'habit.create',
        payload: {
          title: 'Journal',
          stat: 'WIL',
          difficulty: 'easy',
          measure: 'check',
          full_version: 'a',
          min_version: 'b',
        },
      })
    ).value as Habit;
    await ensureInstancesForDay(t.db, DAY);
    await expect(
      start({ quest_instance_id: `${check.id}:${DAY}`, planned_min: 25 }),
    ).rejects.toThrow(RuleError);
  });

  it('a session that runs past midnight counts for the day it began', async () => {
    const id = await studyQuest();
    setNow(ist(2026, 11, 2, 23, 30));
    const s = await start({ quest_instance_id: id, planned_min: 50 });
    setNow(ist(2026, 11, 3, 0, 21)); // after midnight but before 3:00, the app day is still 2 Nov
    await finish(s.id, true);
    expect((await t.db.quest_instances.get(id))?.status).toBe('done_min');
    expect((await t.db.progress_entries.toArray())[0]?.day).toBe(DAY);
  });

  it('a session finished after the day closed still counts for its own day', async () => {
    const id = await studyQuest();
    setNow(ist(2026, 11, 3, 2, 30)); // still 2 Nov
    const s = await start({ quest_instance_id: id, planned_min: 50 });
    setNow(ist(2026, 11, 3, 3, 21)); // now 3 Nov — 2 Nov has closed
    await finish(s.id, true);
    expect((await t.db.quest_instances.get(id))?.status).toBe('done_min');
  });
});

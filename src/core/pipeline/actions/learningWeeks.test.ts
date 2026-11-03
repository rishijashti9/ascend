import { habitFieldsOf, STARTER_DREAM, STARTER_HABITS, STARTER_MAIN_QUESTS } from '@/data/starter';
import type { OnboardingPayload } from '@/core/pipeline';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

const iso = (ms: number) => new Date(ms).toISOString();
const live = async () => (await t.db.learning_events.toArray()).filter((e) => !e.deleted_at);

describe('notification events (SPEC 6.7 A)', () => {
  it('future reminders are scheduled; one dropped from the plan is removed again', async () => {
    const wake = { key: 'wake:2026-11-03', kind: 'wake', at: iso(ist(2026, 11, 3, 5)) };
    const brief = {
      key: 'briefing:2026-11-03',
      kind: 'briefing',
      at: iso(ist(2026, 11, 3, 5, 20)),
    };
    await t.run({ type: 'learning.notificationsPlanned', payload: { items: [wake, brief] } });
    expect((await live()).map((e) => e.id).sort()).toEqual([
      'notif:scheduled:briefing:2026-11-03',
      'notif:scheduled:wake:2026-11-03',
    ]);
    await t.run({ type: 'learning.notificationsPlanned', payload: { items: [wake] } });
    expect((await live()).map((e) => e.id)).toEqual(['notif:scheduled:wake:2026-11-03']);
  });

  it('delivered and opened are recorded once each, with minutes after the due time', async () => {
    const at = iso(ist(2026, 11, 3, 5));
    await t.run({
      type: 'learning.notificationsPlanned',
      payload: { items: [{ key: 'wake:2026-11-03', kind: 'wake', at }] },
    });
    setNow(ist(2026, 11, 3, 5, 7));
    const opened = {
      type: 'learning.notification',
      payload: { key: 'wake:2026-11-03', kind: 'wake', outcome: 'opened' },
    };
    expect((await t.run(opened)).value).toBe(true);
    expect((await t.run(opened)).value).toBe(false);
    const e = await t.db.learning_events.get('notif:opened:wake:2026-11-03');
    expect(e).toMatchObject({ kind: 'notification', type: 'wake', day: '2026-11-03' });
    expect(e?.values).toEqual({ minutes_from_due: 7 });
  });

  it('an opened reminder gets minutes to the next completion once the window has passed', async () => {
    await t.run({ type: 'onboarding.complete', payload: onboarding() });
    setNow(ist(2026, 11, 2, 18));
    await t.run({
      type: 'learning.notification',
      payload: { key: 'reminder:2026-11-02', kind: 'reminder', outcome: 'opened' },
    });
    setNow(ist(2026, 11, 2, 18, 12));
    const inst = (await t.db.quest_instances.where('day').equals('2026-11-02').toArray()).find(
      (i) => i.measure_snapshot === 'check' && i.auto_source_snapshot !== 'wake_checkin',
    );
    expect(inst).toBeDefined();
    await t.run({
      type: 'quest.complete',
      payload: { instanceId: inst?.id ?? '', version: 'full' },
    });
    setNow(ist(2026, 11, 2, 21, 30));
    await t.run({ type: 'learning.closeWeeks', payload: {} });
    const e = await t.db.learning_events.get('notif:opened:reminder:2026-11-02');
    expect(e?.values?.minutes_to_action).toBe(12);
  });
});

describe('planned vs actual per week', () => {
  it('each closed week is written once, with numbers only', async () => {
    await t.run({ type: 'onboarding.complete', payload: onboarding() });
    const inst = (await t.db.quest_instances.where('day').equals('2026-11-02').toArray()).find(
      (i) => i.measure_snapshot === 'minutes',
    );
    await t.run({ type: 'quest.logProgress', payload: { instanceId: inst?.id ?? '', amount: 40 } });
    setNow(ist(2026, 11, 10, 10)); // next week (Tuesday)
    await t.run({ type: 'day.rollover', payload: {} });
    expect((await t.run({ type: 'learning.closeWeeks', payload: {} })).value).toBe(1);
    expect((await t.run({ type: 'learning.closeWeeks', payload: {} })).value).toBe(0);
    const week = await t.db.learning_events.get('week:2026-11-02');
    expect(week).toMatchObject({ kind: 'week', type: 'planned_actual', ref_id: '2026-11-02' });
    expect(week?.values?.minutes_done).toBe(40);
    expect(week?.values?.daily_planned).toBeGreaterThan(0);
    for (const v of Object.values(week?.values ?? {})) expect(typeof v).toBe('number');
  });
});

function onboarding(): OnboardingPayload {
  return {
    name: 'Rishi',
    wake_time: '05:00',
    theme: 'dark',
    start: 'today',
    habits: STARTER_HABITS.filter((h) => h.selected).map(habitFieldsOf),
    dream: STARTER_DREAM,
    main_quests: [...STARTER_MAIN_QUESTS],
  };
}

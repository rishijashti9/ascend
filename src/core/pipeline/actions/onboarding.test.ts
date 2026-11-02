import { habitFieldsOf, STARTER_DREAM, STARTER_HABITS, STARTER_MAIN_QUESTS } from '@/data/starter';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { RuleError, type OnboardingPayload, type RolloverResult } from '..';

let t: Awaited<ReturnType<typeof createTestDb>>;
const TODAY = '2026-11-02';

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

function payload(over: Partial<OnboardingPayload> = {}): OnboardingPayload {
  return {
    name: 'Rishi',
    wake_time: '05:00',
    theme: 'dark',
    start: 'today',
    habits: STARTER_HABITS.filter((h) => h.selected).map(habitFieldsOf),
    dream: STARTER_DREAM,
    main_quests: [...STARTER_MAIN_QUESTS],
    ...over,
  };
}

const onboard = (p: OnboardingPayload) => t.run({ type: 'onboarding.complete', payload: p });

describe('onboarding.complete', () => {
  it('saves profile, settings, habits, dream and main quests together', async () => {
    await onboard(payload());
    expect(await t.db.profile.get('profile')).toMatchObject({ name: 'Rishi', start_day: TODAY });
    expect(await t.db.settings.get('settings')).toMatchObject({
      wake_time: '05:00',
      theme: 'dark',
    });
    const habits = (await t.db.habits.toArray()).sort((a, b) => a.order - b.order);
    expect(habits).toHaveLength(8);
    expect(habits.filter((h) => h.core).map((h) => h.title)).toEqual([
      'Wake up on time',
      'AI & Robotics study (phone-free)',
      'Workout',
    ]);
    const dreams = await t.db.dreams.toArray();
    expect(dreams).toHaveLength(1);
    const mqs = (await t.db.main_quests.toArray()).sort((a, b) => a.order - b.order);
    expect(mqs.map((m) => m.title)).toEqual(STARTER_MAIN_QUESTS.map((m) => m.title));
    expect(mqs.every((m) => m.dream_id === dreams[0]?.id)).toBe(true);
  });

  it('"start today": quests appear today but Day 1 is neutral', async () => {
    await onboard(payload());
    const today = await t.db.quest_instances.where('day').equals(TODAY).toArray();
    expect(today).toHaveLength(8);
    expect(today.every((i) => !i.core_snapshot)).toBe(true);
    expect(await t.db.days.get(TODAY)).toMatchObject({ neutral: true, active: false });
  });

  it('Day 1 is never missed; core counts from Day 2', async () => {
    await onboard(payload());
    setNow(ist(2026, 11, 3, 10));
    const r = (await t.run<RolloverResult>({ type: 'day.rollover', payload: {} }))
      .value as RolloverResult;
    expect(r.recoveryQuestId).toBeNull();
    expect(await t.db.days.get(TODAY)).toMatchObject({
      neutral: true,
      closed_at: expect.any(String),
    });
    const tomorrow = await t.db.quest_instances.where('day').equals('2026-11-03').toArray();
    expect(tomorrow.filter((i) => i.core_snapshot)).toHaveLength(3);
  });

  it('"start tomorrow" (after 6 PM): no quests tonight, Day 1 = tomorrow', async () => {
    setNow(ist(2026, 11, 2, 20));
    await onboard(payload({ start: 'tomorrow' }));
    expect((await t.db.profile.get('profile'))?.start_day).toBe('2026-11-03');
    expect(await t.db.quest_instances.count()).toBe(0);
  });

  it('can only run once', async () => {
    await onboard(payload());
    await expect(onboard(payload())).rejects.toThrow(RuleError);
  });

  it('rejects more than 3 core quests and saves nothing', async () => {
    const habits = payload().habits.map((h) => ({ ...h, core: true }));
    await expect(onboard(payload({ habits }))).rejects.toThrow(/At most 3 core/);
    expect(await t.db.habits.count()).toBe(0);
    expect(await t.db.profile.get('profile')).toBeUndefined();
  });

  it('works without a dream', async () => {
    await onboard(payload({ dream: null, main_quests: [] }));
    expect(await t.db.dreams.count()).toBe(0);
  });
});

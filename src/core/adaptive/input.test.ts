import { habitFieldsOf, STARTER_DREAM, STARTER_HABITS, STARTER_MAIN_QUESTS } from '@/data/starter';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import { habitModels } from './habits';
import { loadAdaptiveInput } from './load';

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(() => t.cleanup());

it('reads quests, progress and check-ins from the database (numbers only)', async () => {
  await t.run({
    type: 'onboarding.complete',
    payload: {
      name: 'Rishi',
      wake_time: '05:00',
      theme: 'dark',
      start: 'today',
      habits: STARTER_HABITS.filter((h) => h.selected).map(habitFieldsOf),
      dream: STARTER_DREAM,
      main_quests: [...STARTER_MAIN_QUESTS],
    },
  });
  setNow(ist(2026, 11, 3, 10));
  await t.run({ type: 'day.rollover', payload: {} });
  const study = (await t.db.quest_instances.where('day').equals('2026-11-03').toArray()).find(
    (i) => i.measure_snapshot === 'minutes' && i.target_snapshot === 150,
  );
  await t.run({ type: 'quest.logProgress', payload: { instanceId: study?.id ?? '', amount: 45 } });
  await t.run({
    type: 'review.save',
    payload: { type: 'daily', period: '2026-11-03', energy: 4, mood: 3, win: 'secret', lesson: '' },
  });
  const input = await loadAdaptiveInput(t.db, 'Asia/Kolkata');
  expect(input.today).toBe('2026-11-03');
  expect(input.instances.find((i) => i.id === study?.id)?.value).toBe(45);
  expect(input.energy).toEqual([{ day: '2026-11-03', value: 4 }]);
  expect(JSON.stringify(input)).not.toContain('secret'); // journal text is never read
  expect(habitModels(input).size).toBe(8);
});

import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { startAppState } from '@/core/state/app';
import { startProgressStore } from '@/core/state/progress';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { startWidgetWriter } from './writer';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

it('writes the snapshot after onboarding and again only when something changed', async () => {
  await recordAction({
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
  await startAppState();
  await startToday();
  await startProgressStore();
  const written: string[] = [];
  const stop = startWidgetWriter(
    {
      setSnapshot: async (j) => void written.push(j),
      peekPending: async () => [],
      removePending: async () => undefined,
    },
    10,
  );
  await vi.waitFor(() => expect(written).toHaveLength(1));
  const first = JSON.parse(written[0] ?? '{}') as { day: string; total: number; quests: unknown[] };
  expect(first.day).toBe('2026-11-02');
  expect(first.quests.length).toBeGreaterThan(0);
  await new Promise((r) => setTimeout(r, 50));
  expect(written).toHaveLength(1);
  stop();
});

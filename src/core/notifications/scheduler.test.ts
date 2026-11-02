import type { Habit } from '@/core/db/types';
import { clearSubscribers, ensureInstancesForDay, newBase } from '@/core/pipeline';
import { createTestDb, ist } from '@/test/testDb';
import { startNotificationScheduler } from './scheduler';
import type { Notifier, PlannedNotification } from './types';

let t: Awaited<ReturnType<typeof createTestDb>>;
let wake: Habit;
const synced: PlannedNotification[][] = [];
const notifier: Notifier = {
  platform: 'android',
  permission: async () => 'granted',
  requestPermission: async () => 'granted',
  sync: async (list) => void synced.push([...list]),
  showNow: async () => undefined,
  onTap: () => () => undefined,
};

beforeEach(async () => {
  t = await createTestDb(ist(2026, 11, 2, 4, 30));
  synced.length = 0;
  await t.db.profile.put({
    ...newBase('profile'),
    name: 'R',
    start_day: '2026-11-01',
    onboarded_at: '2026-11-01T00:00:00.000Z',
    display_title: null,
  });
  wake = (
    await t.run<Habit>({
      type: 'habit.create',
      payload: {
        title: 'Wake up on time',
        stat: 'WIL',
        difficulty: 'normal',
        measure: 'check',
        auto_source: 'wake_checkin',
        full_version: 'Up',
        min_version: 'Up late',
      },
    })
  ).value as Habit;
  await ensureInstancesForDay(t.db, '2026-11-02');
});
afterEach(async () => {
  clearSubscribers();
  await t.cleanup();
});

describe('notification scheduler', () => {
  it('syncs the plan, re-plans after changes, and leaves the notifier alone when nothing changed', async () => {
    const s = startNotificationScheduler(notifier, t.db, 0);
    await s.refresh();
    expect(synced).toHaveLength(1);
    expect(synced[0]?.[0]?.key).toBe('wake:2026-11-02');

    await s.refresh(); // same data → no second sync
    expect(synced).toHaveLength(1);

    // Checking in today removes today's reminder.
    await t.run({ type: 'quest.wakeCheckin', payload: { instanceId: `${wake.id}:2026-11-02` } });
    await s.refresh();
    expect(synced).toHaveLength(2);
    expect(synced[1]?.[0]?.key).toBe('wake:2026-11-03');

    // Switching the reminder off clears everything scheduled.
    await t.run({ type: 'settings.update', payload: { notifications: { wake_checkin: false } } });
    await s.refresh();
    expect(synced.at(-1)).toEqual([]);
    s.stop();
  });
});

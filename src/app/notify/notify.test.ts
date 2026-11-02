import type { PlannedNotification } from '@/core/notifications/types';
import { noticesStore } from '@/core/state/notices';
import { createAndroidNotifier, notificationId } from './android';
import { createBrowserNotifier } from './browser';

const plugin = vi.hoisted(() => ({
  createChannel: vi.fn(async () => undefined),
  registerActionTypes: vi.fn(async () => undefined),
  getPending: vi.fn(async () => ({
    notifications: [
      { id: 1, title: 'mine', body: '', extra: { ascend: true } },
      { id: 2, title: 'someone else', body: '', extra: {} },
      { id: 3, title: 'a test', body: '', extra: { ascend: true, kind: 'test' } },
    ],
  })),
  cancel: vi.fn(async () => undefined),
  schedule: vi.fn(async () => ({ notifications: [] })),
  checkPermissions: vi.fn(async () => ({ display: 'prompt-with-rationale' })),
  requestPermissions: vi.fn(async () => ({ display: 'granted' })),
  checkExactNotificationSetting: vi.fn(async () => ({ exact_alarm: 'denied' })),
  changeExactNotificationSetting: vi.fn(async () => ({ exact_alarm: 'granted' })),
  listener: null as null | ((e: unknown) => void),
  addListener: vi.fn(async (_name: string, fn: (e: unknown) => void) => {
    plugin.listener = fn;
    return { remove: async () => undefined };
  }),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));

const NOW = Date.UTC(2026, 10, 2, 0, 0);
const planned = (key: string, at: number, extra: Partial<PlannedNotification> = {}) =>
  ({
    key,
    kind: 'wake',
    at,
    day: '2026-11-02',
    title: 'T',
    body: 'B',
    path: '/',
    ...extra,
  }) as PlannedNotification;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  noticesStore.setState({ notices: [] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Android notifier', () => {
  it('replaces only ASCEND’s scheduled notifications and skips past ones', async () => {
    const n = createAndroidNotifier();
    await n.sync([
      planned('wake:2026-11-02', NOW - 1000),
      planned('wake:2026-11-03', NOW + 86_400_000, { wakeInstanceId: 'h:2026-11-03' }),
    ]);
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
    const [[arg]] = plugin.schedule.mock.calls as unknown as [
      [{ notifications: Record<string, unknown>[] }],
    ];
    expect(arg.notifications).toHaveLength(1);
    expect(arg.notifications[0]).toMatchObject({
      id: notificationId('wake:2026-11-03'),
      actionTypeId: 'ASCEND_WAKE',
      channelId: 'ascend',
      extra: { ascend: true, key: 'wake:2026-11-03', wakeInstanceId: 'h:2026-11-03' },
    });
    expect(plugin.registerActionTypes).toHaveBeenCalledTimes(1);
  });

  it('maps permissions and taps (the "I’m up" button and the tap time)', async () => {
    const n = createAndroidNotifier();
    expect(await n.permission()).toBe('prompt');
    expect(await n.requestPermission()).toBe('granted');
    const taps: unknown[] = [];
    n.onTap((t) => taps.push(t));
    await Promise.resolve();
    plugin.listener?.({
      actionId: 'wake_up',
      notification: {
        extra: {
          ascend: true,
          key: 'wake:2026-11-02',
          kind: 'wake',
          day: '2026-11-02',
          path: '/',
          wakeInstanceId: 'h:2026-11-02',
        },
      },
    });
    plugin.listener?.({ actionId: 'tap', notification: { extra: { other: true } } }); // not ours
    expect(taps).toEqual([
      {
        key: 'wake:2026-11-02',
        kind: 'wake',
        day: '2026-11-02',
        path: '/',
        wakeInstanceId: 'h:2026-11-02',
        wakeUp: true,
        at: NOW,
      },
    ]);
  });

  it('exact alarms: checks, opens the system screen; a delayed test is scheduled for its time', async () => {
    const n = createAndroidNotifier();
    expect(await n.exactAlarms()).toBe('denied');
    expect(await n.openExactAlarmSettings()).toBe('granted');
    await n.showNow(planned('test:x', NOW + 120_000, { kind: 'test' }));
    const [[arg]] = plugin.schedule.mock.calls as unknown as [
      [{ notifications: { schedule: { at: Date } }[] }],
    ];
    expect(arg.notifications[0]?.schedule.at.getTime()).toBe(NOW + 120_000);
  });

  it('ids are stable, positive and differ per key', () => {
    expect(notificationId('wake:2026-11-02')).toBe(notificationId('wake:2026-11-02'));
    expect(notificationId('wake:2026-11-02')).not.toBe(notificationId('wake:2026-11-03'));
    expect(notificationId('x')).toBeGreaterThan(0);
  });
});

describe('Browser notifier', () => {
  it('shows due reminders in-app while open; a system notification only when on and allowed', async () => {
    const shown: string[] = [];
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      constructor(title: string) {
        shown.push(title);
      }
      close() {}
    }
    vi.stubGlobal('Notification', FakeNotification);
    let on = false;
    const n = createBrowserNotifier(() => on);
    expect(await n.permission()).toBe('granted');
    await n.sync([
      planned('a', NOW + 60_000),
      planned('b', NOW + 2 * 86_400_000), // more than a day ahead: re-planned later
    ]);
    vi.advanceTimersByTime(60_000);
    expect(noticesStore.getState().notices.map((x) => x.key)).toEqual(['a']);
    expect(shown).toEqual([]);

    on = true;
    await n.showNow(planned('test', NOW));
    expect(shown).toEqual(['T']);
    // Re-syncing clears the old timers.
    await n.sync([]);
    vi.advanceTimersByTime(3 * 86_400_000);
    expect(noticesStore.getState().notices.map((x) => x.key)).toEqual(['a', 'test']);
    vi.unstubAllGlobals();
  });
});

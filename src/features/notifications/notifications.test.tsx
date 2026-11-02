import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { setNotifier } from '@/app/notify';
import type { Habit } from '@/core/db/types';
import { db } from '@/core/db/db';
import type { Notifier, NotificationTap, PlannedNotification } from '@/core/notifications/types';
import { handleTap } from '@/core/notifications/taps';
import { clearSubscribers, ensureInstancesForDay, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { noticesStore } from '@/core/state/notices';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { NotificationSettings } from '@/features/settings/NotificationSettings';
import { ist } from '@/test/testDb';
import { NotificationBridge } from './NotificationBridge';

function fakeNotifier(platform: 'android' | 'browser', permission: string) {
  const shown: PlannedNotification[] = [];
  let tapHandler: ((t: NotificationTap) => void) | null = null;
  const n: Notifier = {
    platform,
    permission: vi.fn(async () => permission as never),
    requestPermission: vi.fn(async () => 'granted' as const),
    sync: vi.fn(async () => undefined),
    showNow: vi.fn(async (p: PlannedNotification) => void shown.push(p)),
    onTap: (h) => {
      tapHandler = h;
      return () => (tapHandler = null);
    },
  };
  return { n, shown, tap: (t: NotificationTap) => tapHandler?.(t) };
}

let wake: string;
beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 4, 50));
  const h = (
    await recordAction<Habit>({
      type: 'habit.create',
      payload: {
        title: 'Wake up on time',
        stat: 'WIL',
        difficulty: 'normal',
        measure: 'check',
        auto_source: 'wake_checkin',
        full_version: 'Up on time',
        min_version: 'Up late',
      },
    })
  ).value as Habit;
  await ensureInstancesForDay(db, '2026-11-02');
  wake = `${h.id}:2026-11-02`;
  noticesStore.setState({ notices: [] });
});
afterEach(() => {
  clearSubscribers();
  resetClock();
  setNotifier(null);
});

describe('handleTap', () => {
  it('"I’m up" counts at the tap time even when processed later, and only once', async () => {
    const tap: NotificationTap = {
      key: 'wake:2026-11-02',
      kind: 'wake',
      day: '2026-11-02',
      path: '/',
      wakeInstanceId: wake,
      wakeUp: true,
      at: ist(2026, 11, 2, 5, 10), // within 05:00 + 20 min
    };
    setNow(ist(2026, 11, 2, 6, 30)); // the app opens later
    expect(await handleTap(tap)).toBeNull();
    expect((await db.quest_instances.get(wake))?.status).toBe('done_full');
    expect(await handleTap(tap)).toBeNull(); // delivered twice → one action
    expect(await db.xp_events.where('ref_id').equals(wake).count()).toBe(1);
  });

  it('a tap after the cutoff explains instead of failing; a plain tap does nothing', async () => {
    const base = {
      key: 'k',
      kind: 'wake' as const,
      day: '2026-11-02',
      path: '/',
      wakeInstanceId: wake,
    };
    expect(await handleTap({ ...base, wakeUp: false, at: Date.now() })).toBeNull();
    setNow(ist(2026, 11, 2, 8));
    expect(await handleTap({ ...base, key: 'k2', wakeUp: true, at: ist(2026, 11, 2, 7, 30) })).toBe(
      'The wake-up window has closed for today',
    );
  });
});

describe('Notification settings and banners', () => {
  it('web: says reminders only come while open; the test shows a banner with I’m up', async () => {
    const fake = fakeNotifier('browser', 'prompt');
    setNotifier(fake.n);
    await startAppState();
    await startToday();
    const settings = (await db.settings.get('settings')) ?? null;
    if (!settings) throw new Error('no settings');
    render(
      <MemoryRouter>
        <NotificationBridge />
        <NotificationSettings settings={settings} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/reminders appear only while ASCEND is open/)).toBeInTheDocument();

    // Turning on browser notifications asks the browser first.
    await userEvent.click(screen.getByRole('switch', { name: 'Browser notifications' }));
    expect(fake.n.requestPermission).toHaveBeenCalled();
    await waitFor(async () =>
      expect((await db.settings.get('settings'))?.notifications.browser_notifications).toBe(true),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Send a test' }));
    expect(fake.shown).toHaveLength(1);

    // A wake reminder that came due while open: one tap checks in.
    act(() =>
      noticesStore.setState({
        notices: [
          {
            key: 'wake:2026-11-02',
            kind: 'wake',
            at: Date.now(),
            day: '2026-11-02',
            title: 'Day 1. Are you up?',
            body: '',
            path: '/',
            wakeInstanceId: wake,
          },
        ],
      }),
    );
    setNow(ist(2026, 11, 2, 5, 5));
    await userEvent.click(screen.getByRole('button', { name: 'I’m up' }));
    await waitFor(async () =>
      expect((await db.quest_instances.get(wake))?.status).toBe('done_full'),
    );
    expect(screen.queryByText('Day 1. Are you up?')).not.toBeInTheDocument();
  });

  it('android: asks for permission, explains when blocked', async () => {
    const fake = fakeNotifier('android', 'denied');
    setNotifier(fake.n);
    const settings = await db.settings.get('settings');
    if (!settings) throw new Error('no settings');
    render(
      <MemoryRouter>
        <NotificationSettings settings={settings} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Notifications are blocked for ASCEND/)).toBeInTheDocument();
    expect(screen.getByText(/scheduled on this phone a week ahead/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send a test' })).not.toBeInTheDocument();
  });

  it('each reminder has its own switch; the wind-down time can be changed', async () => {
    setNotifier(fakeNotifier('browser', 'granted').n);
    await startAppState();
    const { useAppState } = await import('@/core/state/app');
    function Live() {
      const settings = useAppState((x) => x.settings);
      return settings ? <NotificationSettings settings={settings} /> : null;
    }
    render(
      <MemoryRouter>
        <Live />
      </MemoryRouter>,
    );
    for (const name of [
      'Wake-up check-in',
      'Morning briefing',
      'Core quest reminder',
      'Evening wind-down',
    ])
      expect(screen.getByRole('switch', { name })).toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Morning briefing' }));
    await waitFor(async () =>
      expect((await db.settings.get('settings'))?.notifications.morning_briefing).toBe(false),
    );
    const time = screen.getByLabelText('Wind-down time');
    fireEvent.change(time, { target: { value: '22:15' } });
    await waitFor(async () =>
      expect((await db.settings.get('settings'))?.notifications.evening_time).toBe('22:15'),
    );
    expect(await screen.findByText(/At 22:15: a nudge/)).toBeInTheDocument();
  });
});

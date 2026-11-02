import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { setNotifier } from '@/app/notify';
import type { ExactAlarms, Notifier, PlannedNotification } from '@/core/notifications/types';
import { setNow, resetClock } from '@/core/time';
import { BATTERY_GUIDES, guideFor } from '@/data/batteryGuide';
import { ReminderSetupCard } from '@/features/today/ReminderSetupCard';
import { ReliableReminders } from './ReliableReminders';

const device = vi.hoisted(() => ({ maker: 'Xiaomi' as string | null }));
vi.mock('@/app/device', () => ({ manufacturer: async () => device.maker?.toLowerCase() ?? null }));
const scheduler = vi.hoisted(() => ({ rescheduleAll: vi.fn(async () => []) }));
vi.mock('@/core/notifications/scheduler', () => scheduler);
const app = vi.hoisted(() => ({ wake: true }));
vi.mock('@/core/state/app', () => ({
  useAppState: (pick: (s: unknown) => unknown) =>
    pick({ settings: { notifications: { wake_checkin: app.wake } } }),
}));

function fake(platform: 'android' | 'browser', exact: ExactAlarms, permission = 'granted') {
  const shown: PlannedNotification[] = [];
  let state = exact;
  const n: Notifier = {
    platform,
    permission: async () => permission as never,
    requestPermission: async () => 'granted',
    sync: async () => undefined,
    showNow: async (p) => void shown.push(p),
    exactAlarms: async () => state,
    openExactAlarmSettings: vi.fn(async (): Promise<ExactAlarms> => (state = 'granted')),
    onTap: () => () => undefined,
  };
  return { n, shown };
}

afterEach(() => {
  setNotifier(null);
  resetClock();
  vi.clearAllMocks();
  device.maker = 'Xiaomi';
  app.wake = true;
});

describe('battery guides', () => {
  it('pick the phone’s brand (or Other), and each has steps', () => {
    expect(guideFor('xiaomi').id).toBe('xiaomi');
    expect(guideFor('Redmi').id).toBe('xiaomi');
    expect(guideFor('samsung').id).toBe('samsung');
    expect(guideFor('realme').id).toBe('realme');
    expect(guideFor('OPPO').id).toBe('oppo');
    expect(guideFor('OnePlus').id).toBe('oppo');
    expect(guideFor('vivo').id).toBe('vivo');
    expect(guideFor('Google').id).toBe('other');
    expect(guideFor(null).id).toBe('other');
    for (const g of BATTERY_GUIDES) expect(g.steps.length).toBeGreaterThan(0);
  });
});

describe('Make sure reminders arrive on time (Android)', () => {
  it('exact timing off → explains and opens the system screen; then re-schedules', async () => {
    const f = fake('android', 'denied');
    setNotifier(f.n);
    render(<ReliableReminders wakeTime="05:00" />);
    expect(await screen.findByText(/may deliver your 05:00 wake-up check-in/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Allow exact timing' }));
    expect(f.n.openExactAlarmSettings).toHaveBeenCalled();
    expect(await screen.findByText(/scheduled for the exact minute/)).toBeInTheDocument();
    expect(scheduler.rescheduleAll).toHaveBeenCalled();
  });

  it('opens the battery guide at this phone’s brand; other brands one tap away', async () => {
    setNotifier(fake('android', 'granted').n);
    render(<ReliableReminders wakeTime="05:00" />);
    fireEvent.click(screen.getByText(/Stop the phone from closing ASCEND/));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Xiaomi / Redmi / POCO' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(screen.getByRole('list', { name: 'Steps for Xiaomi / Redmi / POCO' })).toHaveTextContent(
      'Autostart',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Samsung' }));
    expect(screen.getByRole('list', { name: 'Steps for Samsung' })).toHaveTextContent(
      'Never sleeping apps',
    );
  });

  it('the locked-phone test is scheduled 2 minutes ahead', async () => {
    setNow(Date.UTC(2026, 10, 2, 10, 0));
    const f = fake('android', 'granted');
    setNotifier(f.n);
    render(<ReliableReminders wakeTime="05:00" />);
    await userEvent.click(screen.getByRole('button', { name: 'Test with the phone locked' }));
    expect(f.shown[0]?.kind).toBe('test');
    const delay = (f.shown[0]?.at ?? 0) - Date.UTC(2026, 10, 2, 10, 0);
    expect(delay).toBeGreaterThanOrEqual(120_000);
    expect(delay).toBeLessThan(125_000);
    expect(screen.getByRole('status')).toHaveTextContent('Lock your phone now and wait.');
  });
});

describe('Today: reminder setup card', () => {
  const renderCard = () =>
    render(
      <MemoryRouter>
        <ReminderSetupCard />
      </MemoryRouter>,
    );

  it('Android with exact timing off: says so with a link to fix it; Not now hides it', async () => {
    setNotifier(fake('android', 'denied').n);
    renderCard();
    const card = await screen.findByRole('region', { name: 'Reminder setup' });
    expect(card).toHaveTextContent('Exact timing is off, so the wake-up check-in may arrive late.');
    expect(within(card).getByRole('link', { name: 'Fix it' })).toHaveAttribute(
      'href',
      '/settings#notifications',
    );
    await userEvent.click(within(card).getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Reminder setup' })).not.toBeInTheDocument();
  });

  it('notifications not allowed comes first; nothing when all is fine, on the web, or wake-up off', async () => {
    setNotifier(fake('android', 'denied', 'prompt').n);
    const { unmount } = renderCard();
    expect(await screen.findByText(/Notifications are off/)).toBeInTheDocument();
    unmount();

    for (const f of [fake('android', 'granted'), fake('browser', 'unsupported')]) {
      setNotifier(f.n);
      const r = renderCard();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.queryByRole('region', { name: 'Reminder setup' })).not.toBeInTheDocument();
      r.unmount();
    }
    app.wake = false;
    setNotifier(fake('android', 'denied').n);
    renderCard();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('region', { name: 'Reminder setup' })).not.toBeInTheDocument();
  });
});

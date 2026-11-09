import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { getDeviceId } from '@/core/db/hlc';
import { clearSubscribers, recordAction, type Action } from '@/core/pipeline';
import { getLock, getRules } from '@/core/screentime/store';
import { startScreenStore } from '@/core/state/screen';
import { addDays, resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { ScreenTimeToday } from './ScreenTimeCard';

const run = (a: Action) => recordAction(a, { db });

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 4, 10));
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

/** `days` of readings before today: 2 h of Instagram a day. */
async function observed(days: number) {
  for (let i = 1; i <= days; i++) {
    await run({
      type: 'screen.saveDay',
      payload: {
        device_id: getDeviceId(),
        day: addDays('2026-11-04', -i),
        apps: { 'com.instagram.android': 7200, 'org.ros.docs': 3600 },
        focus: {},
        labels: { 'com.instagram.android': 'Instagram' },
        games: [],
      },
    });
  }
}

const show = async () => {
  await startScreenStore(db);
  render(
    <MemoryRouter>
      <ScreenTimeToday />
    </MemoryRouter>,
  );
};

it('shows nothing until screen time is switched on', async () => {
  await show();
  expect(screen.queryByText(/screen time/i)).toBeNull();
});

it('observe week: only a quiet note, no questions', async () => {
  setNow(ist(2026, 11, 1, 10));
  await run({ type: 'screen.setEnabled', payload: { on: true } });
  setNow(ist(2026, 11, 4, 10));
  await show();
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Screen time: observing quietly — day 4 of 7. No reminders yet.',
  );
  expect(screen.queryByRole('button')).toBeNull();
});

it('after 7 days: one card with the average and a suggestion; Accept sets and locks it', async () => {
  setNow(ist(2026, 10, 28, 10));
  await run({ type: 'screen.setEnabled', payload: { on: true } });
  setNow(ist(2026, 11, 4, 10));
  await observed(7);
  await show();
  const card = await screen.findByRole('region', { name: 'Screen time suggestion' });
  expect(card).toHaveTextContent(
    'You average 2h 00m of entertainment a day. Set your daily limit to 90 min?',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
  await waitFor(async () => expect((await getRules(db))?.limit_min).toBe(90));
  expect(await getLock(db)).toBeDefined();
  // The suggestion card is done; Today's Screen time tile takes over (Phase 12).
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: 'Screen time suggestion' })).toBeNull(),
  );
});

it('Edit lets Rishi pick another limit and a month-long lock', async () => {
  setNow(ist(2026, 10, 28, 10));
  await run({ type: 'screen.setEnabled', payload: { on: true } });
  setNow(ist(2026, 11, 4, 10));
  await observed(7);
  await show();
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  await userEvent.selectOptions(screen.getByLabelText('Daily entertainment limit'), '60');
  await userEvent.selectOptions(screen.getByLabelText('Lock it for'), 'month');
  await userEvent.click(screen.getByRole('button', { name: 'Save limit' }));
  await waitFor(async () => expect((await getRules(db))?.limit_min).toBe(60));
  const end = Date.parse((await getLock(db))?.end_at ?? '');
  expect(end).toBeGreaterThan(ist(2026, 12, 3, 10));
});

it('a banner while the reminder channel is off during a lock', async () => {
  await run({ type: 'screen.setEnabled', payload: { on: true } });
  await run({ type: 'screen.setLimit', payload: { limit_min: 60 } });
  await run({ type: 'screen.reportIncidents', payload: { broken: ['channel_off'] } });
  await show();
  const banner = await screen.findByRole('region', { name: 'Screen-time reminders are off' });
  expect(banner).toHaveTextContent('Screen-time reminders are switched off in Android settings');
  expect(banner).toHaveTextContent('7 days longer');
  expect(banner).toHaveTextContent('No XP is lost');
});

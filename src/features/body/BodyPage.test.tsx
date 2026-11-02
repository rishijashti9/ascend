import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startBody } from '@/core/state/body';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { BodyPage } from './BodyPage';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 21));
  await recordAction({
    type: 'body.log',
    payload: { day: '2026-11-01', weight: 78.8, steps: 6500 },
  });
  await startToday();
  await startBody();
  render(<BodyPage />);
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Body screen', () => {
  it('logs today and shows recent days', async () => {
    const form = screen.getByRole('form', { name: 'Today’s body log' });
    expect(within(form).getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.type(within(form).getByLabelText('Weight (kg)'), '78.4');
    await userEvent.type(within(form).getByLabelText('Workout notes'), 'Pull day');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByRole('status')).toHaveTextContent('Saved');
    expect(await db.body_logs.get('body:2026-11-02')).toMatchObject({
      weight: 78.4,
      workout_notes: 'Pull day',
    });

    const recent = screen.getByRole('region', { name: 'Recent days' });
    expect(recent).toHaveTextContent('78.8 kg');
    expect(recent).toHaveTextContent('6,500');
  });

  it('emptying a field clears it', async () => {
    await recordAction({ type: 'body.log', payload: { waist: 84 } });
    const form = screen.getByRole('form', { name: 'Today’s body log' });
    const waist = within(form).getByLabelText('Waist (cm)');
    await waitFor(() => expect(waist).toHaveValue(84));
    await userEvent.clear(waist);
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(async () =>
      expect((await db.body_logs.get('body:2026-11-02'))?.waist).toBeNull(),
    );
  });
});

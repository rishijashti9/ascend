import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startReviews } from '@/core/state/reviews';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { ReviewPage } from './ReviewPage';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 1, 21));
  await recordAction({
    type: 'review.save',
    payload: { type: 'daily', period: '2026-11-01', energy: 2, lesson: 'Sleep earlier' },
  });
  setNow(ist(2026, 11, 2, 21));
  await startToday();
  await startReviews();
  render(
    <MemoryRouter>
      <ReviewPage />
    </MemoryRouter>,
  );
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Review: daily check-in', () => {
  it('saves energy, mood, a win and a lesson; past check-ins are listed', async () => {
    const form = screen.getByRole('form', { name: 'Daily check-in' });
    expect(within(form).getByRole('button', { name: 'Save check-in' })).toBeDisabled();
    await userEvent.click(within(form).getByRole('radio', { name: 'Energy 4 of 5' }));
    await userEvent.click(within(form).getByRole('radio', { name: 'Mood 5 of 5' }));
    await userEvent.type(within(form).getByLabelText('One win'), 'Two hours of robotics');
    await userEvent.click(within(form).getByRole('button', { name: 'Save check-in' }));
    expect(await within(form).findByRole('status')).toHaveTextContent('Saved');
    await waitFor(async () =>
      expect(await db.reviews.get('review:daily:2026-11-02')).toMatchObject({
        energy: 4,
        mood: 5,
        win: 'Two hours of robotics',
      }),
    );
    const past = screen.getByRole('region', { name: 'Past check-ins' });
    expect(past).toHaveTextContent('Energy 2/5');
    expect(past).toHaveTextContent('Sleep earlier');
  });
});

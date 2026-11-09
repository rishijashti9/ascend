import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startFocusStore } from '@/core/state/focus';
import { startGoals } from '@/core/state/goals';
import { startProgressStore } from '@/core/state/progress';
import { startReviews } from '@/core/state/reviews';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { MonthlyReviewPrompt } from '@/features/today/WeeklyReviewPrompt';
import { ist } from '@/test/testDb';
import { ReviewPage } from './ReviewPage';

async function start(entry: string) {
  for (const s of [
    startAppState,
    startToday,
    startProgressStore,
    startFocusStore,
    startGoals,
    startReviews,
  ])
    await s();
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ReviewPage />
      <MonthlyReviewPrompt />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 10, 30, 21));
  await db.profile.put({
    ...newBase('profile'),
    name: 'R',
    start_day: '2026-10-29',
    onboarded_at: '2026-10-29T00:00:00.000Z',
    display_title: null,
  });
  await recordAction({
    type: 'review.save',
    payload: { type: 'daily', period: '2026-10-30', energy: 4, mood: 2 },
  });
  setNow(ist(2026, 11, 30, 20)); // the month's last day
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Monthly and yearly summaries', () => {
  it('shows the month, browses back to the first month, and saves a reflection', async () => {
    await start('/review?tab=monthly');
    expect(
      screen.getByRole('link', { name: /November 2026 summary is ready/ }),
    ).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Summary for November 2026' });
    expect(summary).toHaveTextContent('Active days0 of 30');
    expect(within(summary).getByRole('button', { name: 'Next month' })).toBeDisabled();

    await userEvent.click(within(summary).getByRole('button', { name: 'Previous month' }));
    const october = screen.getByRole('region', { name: 'Summary for October 2026' });
    expect(october).toHaveTextContent('Active days0 of 3'); // started on the 29th
    expect(october).toHaveTextContent('1 check-in · average energy 4/5 · average mood 2/5');
    expect(within(october).getByRole('button', { name: 'Previous month' })).toBeDisabled();
    await userEvent.click(within(october).getByRole('button', { name: 'Next month' }));

    const form = screen.getByRole('form', { name: 'Reflection' });
    await userEvent.type(
      within(form).getByLabelText('Looking back on this month'),
      'A solid start',
    );
    await userEvent.click(within(form).getByRole('button', { name: 'Save reflection' }));
    expect(await within(form).findByRole('status')).toHaveTextContent('Saved');
    expect((await db.reviews.get('review:monthly:2026-11'))?.text).toBe('A solid start');
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /summary is ready/ })).not.toBeInTheDocument(),
    );
  }, 15_000);

  it('the yearly tab summarises the year; on 31 Dec the prompt is for the year', async () => {
    setNow(ist(2026, 12, 31, 20));
    await start('/review?tab=yearly');
    expect(screen.getByRole('region', { name: 'Summary for 2026' })).toHaveTextContent(
      'Active days0 of 64',
    );
    expect(screen.getByRole('link', { name: /2026 summary is ready/ })).toHaveAttribute(
      'href',
      '/me/reviews?tab=yearly',
    );
  });
});

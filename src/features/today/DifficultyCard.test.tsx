import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { Habit } from '@/core/db/types';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase, recordAction } from '@/core/pipeline';
import { snoozeKey } from '@/core/pipeline/actions/difficulty';
import { startGoals } from '@/core/state/goals';
import { startAdaptive } from '@/core/state/adaptive';
import { startSuggestion } from '@/core/state/suggestion';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { DifficultyCard } from './DifficultyCard';

let study: Habit;

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  await db.profile.put({
    ...newBase('profile'),
    name: 'R',
    start_day: '2026-11-02',
    onboarded_at: '2026-11-02T00:00:00.000Z',
    display_title: null,
  });
  study = (
    await recordAction<Habit>({
      type: 'habit.create',
      payload: {
        title: 'Study',
        stat: 'INT',
        difficulty: 'normal',
        measure: 'minutes',
        target_value: 150,
        min_value: 30,
      },
    })
  ).value as Habit;
  // A week at this target passes with nothing done.
  for (const d of [3, 4, 5, 6, 7, 8, 9, 10]) {
    setNow(ist(2026, 11, d, 10));
    await recordAction({ type: 'day.rollover', payload: {} });
  }
  await startToday();
  await startGoals();
  await startAdaptive(db, 0);
  await startSuggestion();
  render(
    <MemoryRouter>
      <DifficultyCard />
    </MemoryRouter>,
  );
}, 40_000); // simulates a week of days
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Difficulty suggestion on Today', () => {
  it('a target rarely reached gets a smaller one, with the numbers; applying has Undo', async () => {
    const card = await screen.findByRole('region', { name: 'Suggestion' });
    expect(card).toHaveTextContent('This target is hard to reach right now');
    expect(card).toHaveTextContent('Study: 150 min → 115 min');
    expect(card).toHaveTextContent('Full target on 0 of the last 7 days.');
    await userEvent.click(within(card).getByRole('button', { name: 'Make it smaller' }));

    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Suggestion' })).toHaveTextContent(
        'Made 1 daily quest smaller, to hit about 4 days in 5.',
      ),
    );
    expect((await db.habits.get(study.id))?.target_value).toBe(115);
    expect((await db.meta.get(snoozeKey('ease')))?.value).toBe('2026-11-17');

    const undo = screen.getByRole('button', { name: 'Undo' });
    await waitFor(() => expect(undo).toBeEnabled());
    await userEvent.click(undo);
    await waitFor(async () => expect((await db.habits.get(study.id))?.target_value).toBe(150));
    // Still hidden for a while after Undo (it was answered).
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Suggestion' })).not.toBeInTheDocument(),
    );
  }, 15_000);

  it('"Not now" hides it for a week', async () => {
    const card = await screen.findByRole('region', { name: 'Suggestion' });
    await userEvent.click(within(card).getByRole('button', { name: 'Not now' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Suggestion' })).not.toBeInTheDocument(),
    );
    expect((await db.habits.get(study.id))?.target_value).toBe(150);
  });
});

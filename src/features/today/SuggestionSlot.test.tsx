import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase, recordAction } from '@/core/pipeline';
import { startGoals } from '@/core/state/goals';
import { startSuggestion } from '@/core/state/suggestion';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { SuggestionSlot } from './SuggestionSlot';

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
  await recordAction({
    type: 'habit.create',
    payload: {
      title: 'Study',
      stat: 'INT',
      difficulty: 'normal',
      measure: 'minutes',
      target_value: 150,
      min_value: 30,
    },
  });
  // A main quest without a plan → "Goals that need a look" has something to say too.
  const dream = await recordAction<{ id: string }>({
    type: 'dream.create',
    payload: { title: 'D' },
  });
  await recordAction({
    type: 'mainQuest.create',
    payload: { dream_id: (dream.value as { id: string }).id, title: 'Robotics', stat: 'INT' },
  });
  for (const d of [3, 4, 5]) {
    setNow(ist(2026, 11, d, 10));
    await recordAction({ type: 'day.rollover', payload: {} });
  }
  await startToday();
  await startGoals();
  await startSuggestion();
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

it('shows only one suggestion card at a time (the most important first)', async () => {
  render(
    <MemoryRouter>
      <SuggestionSlot />
    </MemoryRouter>,
  );
  await screen.findByRole('region', { name: 'Suggestion' });
  expect(screen.queryByRole('navigation', { name: 'Goals that need a look' })).toBeNull();

  // Once the difficulty suggestion is answered, the next card takes its place.
  await recordAction({ type: 'difficulty.snooze', payload: { kind: 'ease' } });
  await waitFor(() =>
    expect(screen.getByRole('navigation', { name: 'Goals that need a look' })).toBeInTheDocument(),
  );
  expect(screen.queryByRole('region', { name: 'Suggestion' })).toBeNull();
});

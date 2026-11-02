import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startProgressStore } from '@/core/state/progress';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { ist } from '@/test/testDb';
import { TodayPage } from './TodayPage';

async function setup(hour = 10, start: 'today' | 'tomorrow' = 'today') {
  setNow(ist(2026, 11, 2, hour));
  await recordAction({
    type: 'onboarding.complete',
    payload: {
      name: 'Rishi',
      wake_time: '05:00',
      theme: 'system',
      start,
      habits: STARTER_HABITS.filter((h) => h.selected).map(habitFieldsOf),
      dream: null,
      main_quests: [],
    },
  });
  await startAppState();
  await startProgressStore();
  await startToday();
  render(<TodayPage />);
}

/** Clicks once the button is enabled (cards ignore taps while an action is saving). */
async function tap(scope: HTMLElement, name: string | RegExp) {
  const button = within(scope).getByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}

const card = (title: string) =>
  screen.getByRole('heading', { name: title }).closest('li') as HTMLElement;

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('TodayPage', () => {
  it('shows the status header and every daily quest', async () => {
    await setup();
    expect(screen.getByText('Rishi')).toBeInTheDocument();
    expect(screen.getByLabelText('Rank E')).toBeInTheDocument();
    expect(screen.getByText('0 / 8 done')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8);
  });

  it('Full / Minimum taps complete a check quest, award XP, and can be undone', async () => {
    await setup();
    await tap(card('Workout'), 'Minimum');
    await waitFor(() =>
      expect(within(card('Workout')).getByText('Done · Minimum')).toBeInTheDocument(),
    );
    expect(screen.getByText('1 / 8 done')).toBeInTheDocument();
    expect(screen.getByText(/^13 total$/)).toBeInTheDocument();

    await tap(card('Workout'), 'Upgrade to Full');
    await waitFor(() => expect(screen.getByText(/^25 total$/)).toBeInTheDocument());

    await tap(card('Workout'), 'Undo Workout');
    await waitFor(() => expect(screen.getByText(/^0 total$/)).toBeInTheDocument());
    await waitFor(() =>
      expect(within(card('Workout')).getByRole('button', { name: 'Full' })).toBeInTheDocument(),
    );
  });

  it('numeric quests: quick-add minutes and save step totals', async () => {
    await setup();
    const study = card('Game dev study (phone-free)');
    await tap(study, '+10 min');
    await tap(study, '+10 min');
    await waitFor(() => expect(within(study).getByText('Done · Minimum')).toBeInTheDocument());
    expect(within(study).getByText(/^20 min \/ 60 min/)).toBeInTheDocument();

    const walk = card('Walk');
    await userEvent.type(within(walk).getByPlaceholderText('Total steps'), '8500');
    await userEvent.click(within(walk).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(walk).getByText('Done · Full')).toBeInTheDocument());
  });

  it('"I\'m up" before the window ends counts as on time', async () => {
    await setup(5);
    await userEvent.click(screen.getByRole('button', { name: /I’m up/ }));
    await waitFor(() =>
      expect(within(card('Wake up on time')).getByText('Done · Full')).toBeInTheDocument(),
    );
  });

  it('after the late cutoff the "I\'m up" button is gone', async () => {
    await setup(8);
    expect(screen.queryByRole('button', { name: /I’m up/ })).not.toBeInTheDocument();
    expect(screen.getByText('The wake-up window has closed for today.')).toBeInTheDocument();
  });

  it('when Day 1 is tomorrow, tonight shows a friendly note instead of quests', async () => {
    await setup(21, 'tomorrow');
    expect(screen.getByText(/Your first day starts tomorrow/)).toBeInTheDocument();
  });
});

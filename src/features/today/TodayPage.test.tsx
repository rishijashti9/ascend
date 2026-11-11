import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
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
  render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  );
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

  it('dashboard: the Next card shows progress and the next quest; chips filter the list', async () => {
    await setup();
    const next = screen.getByRole('region', { name: 'Next' });
    expect(next).toHaveTextContent(/^Next/);
    // UX-3: no shortcut tiles that repeat the navigation bar.
    expect(screen.queryByRole('link', { name: /^Body/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Body', pressed: false }));
    // Body = STR: Workout, Walk and Sleep.
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Workout',
      'Walk',
      'Sleep',
    ]);
    // Mind = WIL: the wake-up check-in, Journal and Meditate.
    await userEvent.click(screen.getByRole('button', { name: 'Mind' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8);
  });

  it('exactly one next action, never a closed wake-up (UX-2/UX-3)', async () => {
    await setup(10); // 10:00 — the wake-up window (until 7:00) has closed
    expect(screen.getAllByRole('region', { name: 'Next' })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'What to do now' })).toBeNull();
    const title = within(screen.getByRole('region', { name: 'Next' })).getByText(
      (_, el) => el?.tagName === 'P' && el.classList.contains('display'),
    ).textContent;
    expect(title).toBeTruthy();
    expect(title).not.toBe('Wake up on time');
  });

  it('Day 1 has no core quests yet, so the Next card says nothing about them (UX-2)', async () => {
    await setup(10);
    expect(screen.getByRole('region', { name: 'Next' })).not.toHaveTextContent(/core (done|open)/);
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
    // One number in both places: the Body log has today's steps too (task 4.7).
    expect((await db.body_logs.get('body:2026-11-02'))?.steps).toBe(8500);
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
    expect(
      screen.getByText('Missed for today — tomorrow’s check-in opens at 5:00 AM.'),
    ).toBeInTheDocument();
  });

  it('when Day 1 is tomorrow, tonight shows a friendly note instead of quests', async () => {
    await setup(21, 'tomorrow');
    expect(screen.getByText(/Your first day starts tomorrow/)).toBeInTheDocument();
  });
});

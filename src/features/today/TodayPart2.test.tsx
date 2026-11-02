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

const run = (type: string, payload: object = {}) => recordAction({ type, payload });

async function onboard() {
  setNow(ist(2026, 11, 2, 10));
  await run('onboarding.complete', {
    name: 'Rishi',
    wake_time: '05:00',
    theme: 'system',
    start: 'today',
    habits: STARTER_HABITS.filter((h) => h.selected).map(habitFieldsOf),
    dream: null,
    main_quests: [],
  });
}

async function show() {
  await startAppState();
  await startProgressStore();
  await startToday();
  render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  );
}

async function instanceId(title: string, day: string) {
  const i = await db.quest_instances
    .where('day')
    .equals(day)
    .filter((x) => x.title_snapshot === title)
    .first();
  if (!i) throw new Error(`no ${title} on ${day}`);
  return i.id;
}

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

describe('Today part 2', () => {
  it('shows one System message for Day 1', async () => {
    await onboard();
    await show();
    expect(screen.getByRole('status')).toHaveTextContent('Day 1. The System is awake.');
    // Day 1 has no core quests, so low energy would mean nothing.
    expect(screen.queryByRole('button', { name: /Low energy/ })).not.toBeInTheDocument();
  });

  it('completing a quest floats the XP it earned', async () => {
    await onboard();
    await show();
    await tap(card('Workout'), 'Full');
    await waitFor(() => expect(within(card('Workout')).getByText('+25 XP')).toBeInTheDocument(), {
      timeout: 3000, // the save can take >1 s when the whole suite runs in parallel
    });
  });

  it('low energy hides non-core quests not done yet; they can be shown again', async () => {
    await onboard();
    setNow(ist(2026, 11, 3, 10));
    await run('day.rollover');
    await show();
    await tap(document.body, /Low energy/);
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Journal' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'Workout' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show 5 hidden quests' }));
    expect(screen.getByRole('heading', { name: 'Journal' })).toBeInTheDocument();
    await tap(document.body, /Low energy: on/);
    await waitFor(() => expect(screen.queryByText(/hidden quest/)).not.toBeInTheDocument());
  });

  it('Recovery quest after a missed day: offers the repair, then restores the streak', async () => {
    await onboard();
    // Day 2: core quests done (late wake-up still counts) → streak 1.
    setNow(ist(2026, 11, 3, 6));
    await run('day.rollover');
    await run('quest.wakeCheckin', {
      instanceId: await instanceId('Wake up on time', '2026-11-03'),
    });
    await run('quest.complete', {
      instanceId: await instanceId('Workout', '2026-11-03'),
      version: 'full',
    });
    await run('quest.logProgress', {
      instanceId: await instanceId('AI & Robotics study (phone-free)', '2026-11-03'),
      amount: 30,
    });
    // Day 3 missed; Day 4 is the return day.
    setNow(ist(2026, 11, 5, 10));
    await run('day.rollover');
    await show();

    const recovery = screen.getByText('Recovery quest').closest('li') as HTMLElement;
    expect(within(recovery).getByText('Restores your 1-day streak.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('restore your 1-day streak');
    await tap(recovery, 'Done');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Streak restored at 1 day.'),
    );
    expect(screen.getByLabelText('Streak 1 day')).toBeInTheDocument();
  });
});

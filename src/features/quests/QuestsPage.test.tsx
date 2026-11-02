import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startHabits } from '@/core/state/habits';
import { startProgressStore } from '@/core/state/progress';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { ist } from '@/test/testDb';
import { QuestsPage } from './QuestsPage';

const starters = STARTER_HABITS.filter((h) => h.selected)
  .slice(0, 4)
  .map(habitFieldsOf);

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  for (const h of starters) await recordAction({ type: 'habit.create', payload: h });
  await startHabits();
  await startProgressStore();
  render(
    <MemoryRouter>
      <QuestsPage />
    </MemoryRouter>,
  );
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

const row = (title: string) =>
  screen.getByRole('heading', { name: title }).closest('li') as HTMLElement;
const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

async function tap(scope: HTMLElement, name: string | RegExp) {
  const button = within(scope).getByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}

describe('QuestsPage', () => {
  it('lists daily quests with their core count', () => {
    expect(titles()).toEqual(starters.map((h) => h.title));
    expect(screen.getByText(/3 of 3 core/)).toBeInTheDocument();
  });

  it('creates a new daily quest', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'New quest' }));
    const form = screen.getByRole('region', { name: 'New daily quest' });
    expect(within(form).getByRole('button', { name: 'Add quest' })).toBeDisabled();
    await userEvent.type(within(form).getByLabelText('Title'), 'Stretch');
    await userEvent.type(within(form).getByLabelText('Full version'), '15 min yoga');
    await userEvent.type(within(form).getByLabelText('Minimum version'), '2 stretches');
    await userEvent.click(within(form).getByRole('button', { name: 'Sat' }));
    await tap(form, 'Add quest');
    await waitFor(() => expect(row('Stretch')).toBeInTheDocument());
    expect(within(row('Stretch')).getByText('Mon, Tue, Wed, Thu, Fri, Sun')).toBeInTheDocument();
  });

  it('edits a quest and saves only what changed', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit Workout' }));
    const input = within(row('Workout')).getByLabelText('Full version');
    await userEvent.clear(input);
    await userEvent.type(input, '45 min gym');
    await tap(row('Workout'), 'Save');
    await waitFor(() => expect(screen.getByText(/45 min gym · minimum/)).toBeInTheDocument());
  });

  it('core: a 4th is blocked until one is removed', async () => {
    const free = within(row('Game dev study (phone-free)')).getByRole('button', { name: 'Core' });
    expect(free).toBeDisabled();
    await tap(row('Workout'), 'Core');
    await waitFor(() => expect(free).toBeEnabled());
    await tap(row('Game dev study (phone-free)'), 'Core');
    await waitFor(() => expect(free).toHaveAttribute('aria-pressed', 'true'));
  });

  it('reorders with Up / Down', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit Wake up on time' }));
    await tap(row('Wake up on time'), 'Move Wake up on time down');
    await waitFor(() => expect(titles()[0]).toBe('AI & Robotics study (phone-free)'));
    expect(titles()[1]).toBe('Wake up on time');
  });

  it('pause → restore, and archive → delete forever (with confirmation)', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit Workout' }));
    await tap(row('Workout'), 'Pause');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Paused/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit Workout' }));
    await tap(row('Workout'), 'Restore');
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /Paused/ })).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Edit Workout' }));
    await tap(row('Workout'), 'Archive');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Archived/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit Workout' }));
    await tap(row('Workout'), 'Delete…');
    expect(screen.getByRole('alertdialog', { name: 'Delete forever?' })).toBeInTheDocument();
    await tap(row('Workout'), 'Delete forever');
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Workout' })).not.toBeInTheDocument(),
    );
    expect(
      (await db.habits.toArray()).find((h) => h.title === 'Workout')?.deleted_at,
    ).not.toBeNull();
  });
});

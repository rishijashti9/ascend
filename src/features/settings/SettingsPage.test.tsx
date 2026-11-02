import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startHabits } from '@/core/state/habits';
import { startProgressStore } from '@/core/state/progress';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { ist } from '@/test/testDb';
import { SettingsPage } from './SettingsPage';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  for (const h of STARTER_HABITS.filter((x) => x.selected).slice(0, 3)) {
    await recordAction({ type: 'habit.create', payload: habitFieldsOf(h) });
  }
  await startAppState();
  await startHabits();
  await startProgressStore();
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

const section = (name: string) => screen.getByRole('region', { name });
const stored = async () => db.settings.get('settings');

describe('SettingsPage', () => {
  it('saves the theme', async () => {
    await userEvent.click(within(section('Appearance')).getByRole('radio', { name: /Dark/ }));
    await waitFor(async () => expect((await stored())?.theme).toBe('dark'));
    await waitFor(() =>
      expect(within(section('Appearance')).getByRole('radio', { name: /Dark/ })).toBeChecked(),
    );
  });

  it('saves day-start hour and week start', async () => {
    await userEvent.selectOptions(screen.getByLabelText('New day starts at'), '4');
    await waitFor(async () => expect((await stored())?.day_start_hour).toBe(4));
    // Both selects pause while a save is in flight.
    const week = screen.getByLabelText('Week starts on');
    await waitFor(() => expect(week).toBeEnabled());
    await userEvent.selectOptions(week, '0');
    await waitFor(async () => expect((await stored())?.week_start).toBe(0));
  });

  it('saves wake-up times and the wake-up quest wording follows', async () => {
    const wake = section('Wake-up');
    const window = within(wake).getByLabelText('On-time window (minutes)');
    await userEvent.clear(window);
    await userEvent.type(window, '30');
    expect(within(wake).getByText(/On time until 5:30 AM/)).toBeInTheDocument();
    await userEvent.click(within(wake).getByRole('button', { name: 'Save wake-up times' }));
    await waitFor(async () => expect((await stored())?.wake_window_min).toBe(30));
    const habit = (await db.habits.toArray()).find((h) => h.auto_source === 'wake_checkin');
    expect(habit?.full_version).toBe('"I\'m up" by 5:30 AM');
  });

  it('explains a late cutoff that is too early', async () => {
    const wake = section('Wake-up');
    const window = within(wake).getByLabelText('On-time window (minutes)');
    await userEvent.clear(window);
    await userEvent.type(window, '120');
    await userEvent.click(within(wake).getByRole('button', { name: 'Save wake-up times' }));
    expect(await within(wake).findByRole('alert')).toHaveTextContent(/late cutoff must be after/);
    expect((await stored())?.wake_window_min).toBe(20);
  });

  it('lists the core quests with a link to change them', () => {
    const core = section('Core quests');
    expect(within(core).getAllByRole('listitem')).toHaveLength(3);
    expect(within(core).getByRole('link', { name: /Change core quests/ })).toHaveAttribute(
      'href',
      '/quests',
    );
  });

  it('Rebuild progress reports what it checked', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Rebuild progress' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/days checked|Checked/);
  });

  it('Reset all data needs a second, explicit confirmation', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Reset all data…' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Reset all data?' });
    expect(within(dialog).getByRole('button', { name: 'Delete everything' })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.habits.count()).toBe(3);
  });
});

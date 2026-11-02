import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Habit } from '@/core/db/types';
import { db } from '@/core/db/db';
import { clearSubscribers, ensureInstancesForDay, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startFocusStore } from '@/core/state/focus';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { FocusPage } from './FocusPage';

let questId: string;

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 9));
  const h = (
    await recordAction<Habit>({
      type: 'habit.create',
      payload: {
        title: 'Game dev study',
        stat: 'INT',
        difficulty: 'normal',
        measure: 'minutes',
        target_value: 60,
        min_value: 15,
      },
    })
  ).value as Habit;
  await ensureInstancesForDay(db, '2026-11-02');
  questId = `${h.id}:2026-11-02`;
  await startAppState();
  await startToday();
  await startFocusStore();
  render(<FocusPage />);
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

const runner = () => screen.findByRole('dialog', { name: 'Focus session' });

describe('Focus screen', () => {
  it('linked session: the timer runs; ending early counts the minutes toward the quest', async () => {
    expect(screen.getByRole('radio', { name: /Game dev study/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: /Start 25-minute focus/ }));
    const dlg = await runner();
    expect(within(dlg).getByRole('timer')).toHaveTextContent(/^2[45]:\d\d$/);
    expect(dlg).toHaveTextContent('Game dev study');

    setNow(ist(2026, 11, 2, 9, 20) + 1000);
    await userEvent.click(within(dlg).getByRole('button', { name: 'End early' }));
    // The screen's clock ticks once a second; wait for it to catch up with the jump.
    await waitFor(
      () =>
        expect(within(dlg).getByRole('alertdialog')).toHaveTextContent(
          /20 minutes will count toward “Game dev study”/,
        ),
      { timeout: 2500 },
    );
    await userEvent.click(within(dlg).getByRole('button', { name: 'End now' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await db.quest_instances.get(questId))?.status).toBe('done_min');
  });

  it('unlinked session run to the end: honesty check, then 1 XP per minute', async () => {
    await userEvent.click(screen.getByRole('radio', { name: /No quest/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Willpower' }));
    await userEvent.click(screen.getByRole('button', { name: /Start 25-minute focus/ }));
    await runner();
    setNow(ist(2026, 11, 2, 9, 26));
    const question = await screen.findByText(/Was your phone face-down/, {}, { timeout: 2500 });
    expect(question).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(async () =>
      expect(await db.xp_events.toArray()).toEqual([
        expect.objectContaining({ stat: 'WIL', base_amount: 25 }),
      ]),
    );
    expect((await db.focus_sessions.toArray())[0]?.face_down).toBe(true);
  });

  it('back long after the end: asks, and "No" counts nothing', async () => {
    await userEvent.click(screen.getByRole('button', { name: /Start 25-minute focus/ }));
    await runner();
    setNow(ist(2026, 11, 2, 11));
    await userEvent.click(
      await screen.findByRole('button', { name: 'No — don’t count it' }, { timeout: 2500 }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await db.quest_instances.get(questId))?.status).toBe('pending');
    expect((await db.focus_sessions.toArray())[0]).toMatchObject({
      completed: false,
      actual_min: 0,
    });
  });
});

import { render, screen, within } from '@testing-library/react';
import type { FocusSession, Habit } from '@/core/db/types';
import { db } from '@/core/db/db';
import { clearSubscribers, ensureInstancesForDay, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startFocusStore } from '@/core/state/focus';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { SessionHistory } from './SessionHistory';

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
  const a = (
    await recordAction<FocusSession>({
      type: 'focus.start',
      payload: { quest_instance_id: `${h.id}:2026-11-02`, planned_min: 25 },
    })
  ).value as FocusSession;
  setNow(ist(2026, 11, 2, 9, 26));
  await recordAction({
    type: 'focus.finish',
    payload: { id: a.id, completed: true, face_down: true },
  });
  const b = (
    await recordAction<FocusSession>({
      type: 'focus.start',
      payload: { stat: 'WIL', planned_min: 25 },
    })
  ).value as FocusSession;
  setNow(ist(2026, 11, 2, 9, 36) + 1000);
  await recordAction({ type: 'focus.finish', payload: { id: b.id, completed: false } });
  await startAppState();
  await startToday();
  await startFocusStore();
  render(<SessionHistory />);
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Session history', () => {
  it('sums the week per stat and lists sessions by day', () => {
    const week = screen.getByRole('region', { name: 'This week' });
    expect(week).toHaveTextContent('35 min focused · 2 sessions, 1 completed');
    expect(within(week).getByLabelText('Intellect: 25 minutes')).toBeInTheDocument();
    expect(within(week).getByLabelText('Willpower: 10 minutes')).toBeInTheDocument();
    const history = screen.getByRole('region', { name: 'Session history' });
    expect(history).toHaveTextContent('Today · 35 min');
    expect(history).toHaveTextContent('Game dev study');
    expect(history).toHaveTextContent('Ended early');
    expect(within(history).getByLabelText('Phone face-down')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Focus minutes' })).toBeInTheDocument();
  });
});

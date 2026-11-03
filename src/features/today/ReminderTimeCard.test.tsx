import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { computeAdaptive, adaptiveStore } from '@/core/state/adaptive';
import { startAppState } from '@/core/state/app';
import { db } from '@/core/db/db';
import { clearSubscribers } from '@/core/pipeline';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { pastDays, testInput, testInstance } from '@/test/adaptiveInput';
import { ist } from '@/test/testDb';
import { ReminderTimeCard } from './ReminderTimeCard';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  await startAppState();
  const instances = pastDays('2026-11-02', 20).map((d) => {
    const [y, m, day] = d.split('-').map(Number);
    return testInstance('study', d, 'done_full', {
      core: true,
      completedAt: new Date(ist(y ?? 0, m ?? 0, day ?? 0, 20)).toISOString(),
    });
  });
  adaptiveStore.setState(computeAdaptive(testInput({ instances })));
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

it('suggests the learned reminder time; one tap moves it and records the answer', async () => {
  render(<ReminderTimeCard />);
  const card = await screen.findByRole('region', { name: 'Suggestion' });
  expect(card).toHaveTextContent('You usually finish your core quests between 20:00 and 22:00.');
  await userEvent.click(screen.getByRole('button', { name: 'Move to 19:30' }));
  await waitFor(async () =>
    expect((await db.settings.get('settings'))?.notifications.reminder_time).toBe('19:30'),
  );
  await waitFor(async () =>
    expect(
      (await db.learning_events.toArray()).map((e) => [e.type, e.outcome, e.values]),
    ).toContainEqual(['reminder_time', 'accepted', { from_min: 1080, to_min: 1170 }]),
  );
});

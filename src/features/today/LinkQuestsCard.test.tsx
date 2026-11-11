import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { Dream, Habit, MainQuest } from '@/core/db/types';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startGoals } from '@/core/state/goals';
import { startHabits } from '@/core/state/habits';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { ist } from '@/test/testDb';
import { loadLinkSnooze } from './linkCard';
import { SuggestionSlot } from './SuggestionSlot';

/** Linking plan L2: the card on Today — suggestion, approve, Undo, Not now. */
let mq: MainQuest;

/** Today is 2026-11-03; the person started on `startDay` (Day 2 by default). */
async function setup(startDay = '2026-11-02') {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 3, 10));
  await db.profile.put({
    ...newBase('profile'),
    name: 'R',
    start_day: startDay,
    onboarded_at: '2026-11-02T00:00:00.000Z',
    display_title: null,
  });
  for (const t of ['AI & Robotics study', 'Workout']) {
    const h = STARTER_HABITS.find((x) => x.title.startsWith(t));
    await recordAction({
      type: 'habit.create',
      payload: habitFieldsOf(h as (typeof STARTER_HABITS)[number]),
    });
  }
  const dream = (await recordAction<Dream>({ type: 'dream.create', payload: { title: 'D' } }))
    .value as Dream;
  mq = (
    await recordAction<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: dream.id, title: 'Core robotics skills', stat: 'INT' },
    })
  ).value as MainQuest;
  await startAppState();
  await startToday();
  await startGoals();
  await startHabits();
  await loadLinkSnooze();
  render(
    <MemoryRouter>
      <SuggestionSlot />
    </MemoryRouter>,
  );
}
afterEach(() => {
  clearSubscribers();
  resetClock();
});

const study = async () =>
  (await db.habits.toArray()).find((h) => h.title.startsWith('AI & Robotics study')) as Habit;

it('suggests the main quest with its reason, then links on approval — with Undo', async () => {
  await setup();
  const card = await screen.findByRole('region', { name: 'Link your daily quests' });
  const select = within(card).getByLabelText('AI & Robotics study (phone-free)');
  expect(select).toHaveValue(mq.id); // pre-selected suggestion
  expect(card).toHaveTextContent('Suggested because it shares “robotics”');
  expect(card).toHaveTextContent('1 other daily quest match no main quest');

  await userEvent.click(within(card).getByRole('button', { name: 'Link this' }));
  const done = await screen.findByRole('region', { name: 'Suggestion' });
  expect(done).toHaveTextContent('Linked 1 daily quest to the main quest they serve.');
  const h = await study();
  expect([h.linked_goal_type, h.linked_goal_id]).toEqual(['main_quest', mq.id]);

  // The applied note appears as soon as the history updates; Undo is enabled once the apply
  // action has finished (its button is busy until then).
  const undo = within(done).getByRole('button', { name: 'Undo' });
  await waitFor(() => expect(undo).toBeEnabled());
  await userEvent.click(undo);
  await waitFor(async () => expect((await study()).linked_goal_id).toBeNull());
  // Undone and snoozed for the week: the card doesn't come straight back.
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: /Link your daily quests|Suggestion/ })).toBeNull(),
  );
});

it('"No link" leaves a quest out; "Not now" hides the card', async () => {
  await setup();
  const card = await screen.findByRole('region', { name: 'Link your daily quests' });
  await userEvent.selectOptions(
    within(card).getByLabelText('AI & Robotics study (phone-free)'),
    'No link',
  );
  expect(within(card).getByRole('button', { name: /Link th/ })).toBeDisabled();
  await userEvent.click(within(card).getByRole('button', { name: 'Not now' }));
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: 'Link your daily quests' })).toBeNull(),
  );
  expect((await study()).linked_goal_id).toBeNull();
});

it('never shows on Day 1, which stays for planning the goals from onboarding', async () => {
  await setup('2026-11-03');
  // The goal nudge ("needs a plan") gets the slot instead.
  await screen.findByRole('navigation', { name: 'Goals that need a look' });
  expect(screen.queryByRole('region', { name: 'Link your daily quests' })).toBeNull();
});

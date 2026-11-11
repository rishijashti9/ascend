import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { Dream, Habit, MainQuest } from '@/core/db/types';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startGoals } from '@/core/state/goals';
import { startHabits } from '@/core/state/habits';
import { startProgressStore } from '@/core/state/progress';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { ist } from '@/test/testDb';
import { changesOf, editableOf } from './habitDiff';
import { QuestsPage } from './QuestsPage';

/** Linking plan L1 (docs/product/LINKING-PLAN.md): a daily quest can serve a main quest. */
let mq: MainQuest;

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  const dream = (await recordAction<Dream>({ type: 'dream.create', payload: { title: 'D' } }))
    .value as Dream;
  mq = (
    await recordAction<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: dream.id, title: 'Core robotics skills', stat: 'INT' },
    })
  ).value as MainQuest;
  const study = STARTER_HABITS.find((h) => h.title.startsWith('AI & Robotics study'));
  if (!study) throw new Error('no starter study quest');
  await recordAction({ type: 'habit.create', payload: habitFieldsOf(study) });
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

const studyHabit = async () =>
  (await db.habits.toArray()).find((h) => h.title.startsWith('AI & Robotics study')) as Habit;

describe('daily quest goal link (L1)', () => {
  it('the editor offers the main quests, and saving links the daily quest', async () => {
    await startAppState();
    await startGoals();
    await startHabits();
    await startProgressStore();
    render(
      <MemoryRouter>
        <QuestsPage />
      </MemoryRouter>,
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit AI & Robotics study (phone-free)' }),
    );
    const row = screen
      .getByRole('heading', { name: 'AI & Robotics study (phone-free)' })
      .closest('li') as HTMLElement;
    const picker = within(row).getByLabelText('Toward goal');
    expect(within(picker).getByRole('option', { name: 'Core robotics skills' })).toBeTruthy();
    await userEvent.selectOptions(picker, 'Core robotics skills');
    const save = within(row).getByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(async () => {
      const h = await studyHabit();
      expect([h.linked_goal_type, h.linked_goal_id]).toEqual(['main_quest', mq.id]);
    });
  });
});

describe('changesOf: the goal link', () => {
  it('saves both fields when the link changes, nothing when it does not', async () => {
    const h = await studyHabit();
    expect(changesOf(h, editableOf(h))).toEqual({});
    const linked = {
      ...editableOf(h),
      linked_goal_type: 'main_quest' as const,
      linked_goal_id: mq.id,
    };
    expect(changesOf(h, linked)).toEqual({ linked_goal_type: 'main_quest', linked_goal_id: mq.id });
  });

  it('clearing the link sets both fields to null', async () => {
    await recordAction({
      type: 'habit.update',
      payload: {
        id: (await studyHabit()).id,
        changes: { linked_goal_type: 'main_quest', linked_goal_id: mq.id },
      },
    });
    const h = await studyHabit();
    const cleared = { ...editableOf(h), linked_goal_type: null, linked_goal_id: null };
    expect(changesOf(h, cleared)).toEqual({ linked_goal_type: null, linked_goal_id: null });
  });

  it('onboarding drafts (no link fields) never touch the link', async () => {
    const h = await studyHabit();
    const { linked_goal_type: _t, linked_goal_id: _i, ...noLink } = editableOf(h); // eslint-disable-line @typescript-eslint/no-unused-vars
    expect(changesOf(h, noLink)).toEqual({});
  });
});

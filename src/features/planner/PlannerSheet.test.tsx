import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Dream, MainQuest } from '@/core/db/types';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startGoals } from '@/core/state/goals';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { MainQuestPage } from '@/features/goals/MainQuestPage';
import { ist } from '@/test/testDb';

let questId: string;

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 4, 10));
  const d = (await recordAction<Dream>({ type: 'dream.create', payload: { title: 'Robotics' } }))
    .value as Dream;
  questId = (
    (
      await recordAction<MainQuest>({
        type: 'mainQuest.create',
        payload: { dream_id: d.id, title: 'Core robotics skills', stat: 'INT' },
      })
    ).value as MainQuest
  ).id;
  await startGoals();
  const router = createMemoryRouter([{ path: '/goals/:id', element: <MainQuestPage /> }], {
    initialEntries: [`/goals/${questId}`],
  });
  render(<RouterProvider router={router} />);
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Planner sheet', () => {
  it('analyze → interview → a plan waiting for review on the goal page', async () => {
    await userEvent.click(await screen.findByRole('button', { name: /Re-plan/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Core robotics skills' });
    await within(sheet).findByRole('region', { name: 'Analysis' });
    expect(within(sheet).getByLabelText('Plan type')).toHaveValue('skill');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Next' }));

    await userEvent.click(within(sheet).getByRole('radio', { name: 'Some experience' }));
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Unclear next step' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Make my plan' }));

    const preview = await within(sheet).findByRole('region', { name: 'Plan waiting for review' });
    expect(preview).toHaveTextContent(/Milestone: Core robotics skills: guided practice/);
    expect(preview).toHaveTextContent(/This week: /);
    await userEvent.click(within(preview).getByRole('button', { name: 'Approve all' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      await screen.findByRole('heading', { name: 'Core robotics skills: guided practice' }),
    ).toBeInTheDocument();

    // Plan history on the goal page: Undo removes what the plan added.
    const history = await screen.findByRole('region', { name: 'Plan history' });
    await userEvent.click(within(history).getByRole('button', { name: /Undo/ }));
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Core robotics skills: guided practice' }),
      ).not.toBeInTheDocument(),
    );
    expect(within(history).getByText(/undone/)).toBeInTheDocument();
    expect((await db.main_quests.get(questId))?.planner_context).toMatchObject({
      level: 'some',
      obstacle: 'unclear',
      template: 'skill',
    });
  }, 15_000);

  it('answered questions are not asked again', async () => {
    await recordAction({
      type: 'goal.saveContext',
      payload: {
        goalType: 'main_quest',
        id: questId,
        answers: {
          level: 'advanced',
          minutes_per_day: 60,
          days: 'every',
          obstacle: 'none',
          deadline: '',
          done_looks_like: '',
        },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Re-plan/ }));
    const sheet = screen.getByRole('dialog');
    await waitFor(() =>
      expect(within(sheet).getByRole('button', { name: 'Make my plan' })).toBeInTheDocument(),
    );
  });

  it('"Not now" sets the plan aside and changes nothing', async () => {
    await userEvent.click(await screen.findByRole('button', { name: /Re-plan/ }));
    const sheet = screen.getByRole('dialog');
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Next' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Make my plan' }));
    const preview = await within(sheet).findByRole('region', { name: 'Plan waiting for review' });
    await userEvent.click(within(preview).getByRole('button', { name: 'Not now' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Plan waiting for review' }),
      ).not.toBeInTheDocument(),
    );
    expect(await db.milestones.count()).toBe(0);
  }, 15_000);
});

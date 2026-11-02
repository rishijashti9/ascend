import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Dream, MainQuest, Milestone } from '@/core/db/types';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startGoals } from '@/core/state/goals';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { MainQuestPage } from './MainQuestPage';

let quest: MainQuest;
let milestone: Milestone;

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 10, 1, 10)); // goal created on 1 Oct
  const d = (await recordAction<Dream>({ type: 'dream.create', payload: { title: 'D' } }))
    .value as Dream;
  quest = (
    await recordAction<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: d.id, title: 'MS in Germany', stat: 'INT', target_date: '2027-10-01' },
    })
  ).value as MainQuest;
  milestone = (
    await recordAction<Milestone>({
      type: 'milestone.create',
      payload: {
        main_quest_id: quest.id,
        title: 'IELTS 7.5',
        estimated_weekly_quests: 8,
        target_date: '2026-10-29',
      },
    })
  ).value as Milestone;
  setNow(ist(2026, 11, 2, 10)); // 32 days later, nothing done
  await startAppState();
  await startToday();
  await startGoals();
  const router = createMemoryRouter([{ path: '/goals/:id', element: <MainQuestPage /> }], {
    initialEntries: [`/goals/${quest.id}`],
  });
  render(<RouterProvider router={router} />);
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Goal follow-ups', () => {
  it('a 30-day check-in: "Yes, keep going" restarts the clock', async () => {
    const card = await screen.findByRole('region', { name: 'Check-in' });
    expect(card).toHaveTextContent('Is MS in Germany still important to you?');
    await userEvent.click(within(card).getByRole('button', { name: 'Yes, keep going' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Check-in' })).not.toBeInTheDocument(),
    );
    expect((await db.main_quests.get(quest.id))?.last_checkin_day).toBe('2026-11-02');
  });

  it('deadline risk: one tap gives the milestone 2 more weeks', async () => {
    const card = await screen.findByRole('region', { name: 'Deadline at risk' });
    expect(card).toHaveTextContent(/IELTS 7.5” is behind schedule/);
    await userEvent.click(within(card).getByRole('button', { name: 'Give it 2 more weeks' }));
    await waitFor(async () =>
      expect((await db.milestones.get(milestone.id))?.target_date).toBe('2026-11-16'),
    );
  });

  it('deadline risk: "Make it smaller" lowers the estimate', async () => {
    const card = await screen.findByRole('region', { name: 'Deadline at risk' });
    await userEvent.click(within(card).getByRole('button', { name: 'Make it smaller' }));
    await waitFor(async () =>
      expect((await db.milestones.get(milestone.id))?.estimated_weekly_quests).toBe(6),
    );
  });
});

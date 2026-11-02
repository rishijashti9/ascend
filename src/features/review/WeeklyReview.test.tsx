import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { Dream, MainQuest, PlanProposal } from '@/core/db/types';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase, recordAction } from '@/core/pipeline';
import { loadPlannerState, planMainQuest, runWeeklyPlan, type ProposalItem } from '@/core/planner';
import { startAppState } from '@/core/state/app';
import { startFocusStore } from '@/core/state/focus';
import { startGoals } from '@/core/state/goals';
import { startProgressStore } from '@/core/state/progress';
import { startQuests } from '@/core/state/quests';
import { startReviews } from '@/core/state/reviews';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { ReviewPage } from './ReviewPage';

const weekly = async (week: string) =>
  (await db.quests.toArray()).filter(
    (q) => q.type === 'weekly' && q.week_start === week && !q.deleted_at,
  );

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10)); // Monday
  await db.profile.put({
    ...newBase('profile'),
    name: 'R',
    start_day: '2026-11-02',
    onboarded_at: '2026-11-02T00:00:00.000Z',
    display_title: null,
  });
  const d = (await recordAction<Dream>({ type: 'dream.create', payload: { title: 'D' } }))
    .value as Dream;
  const goal = (
    await recordAction<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: d.id, title: 'Core robotics skills', stat: 'INT' },
    })
  ).value as MainQuest;
  const plan = planMainQuest(await loadPlannerState(db), goal, { level: 'some' });
  const p = (
    await recordAction<PlanProposal>({
      type: 'plan.propose',
      payload: {
        goal_type: 'main_quest',
        goal_id: goal.id,
        trigger: 'replan',
        summary: plan.summary,
        items: plan.items,
      },
    })
  ).value as PlanProposal;
  await recordAction({
    type: 'plan.apply',
    payload: { id: p.id, selected: (p.items as ProposalItem[]).map((i) => i.id) },
  });
  setNow(ist(2026, 11, 8, 18)); // Sunday evening — the week's last day
  for (const start of [
    startAppState,
    startToday,
    startProgressStore,
    startFocusStore,
    startQuests,
    startGoals,
    startReviews,
  ])
    await start();
  render(
    <MemoryRouter initialEntries={['/review?tab=weekly']}>
      <ReviewPage />
    </MemoryRouter>,
  );
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Weekly review', () => {
  it('shows the week, saves the answers and plans next week ahead (no duplicate on Monday)', async () => {
    const week = screen.getByRole('region', { name: 'This week' });
    expect(week).toHaveTextContent('Weekly quests0 of');
    const form = screen.getByRole('form', { name: 'Weekly review' });
    await userEvent.type(within(form).getByLabelText('What went well?'), 'Stuck with study');
    const next = await within(form).findAllByRole('checkbox', { name: /Keep:/ });
    expect(next.length).toBeGreaterThan(0);
    expect(within(form).getAllByText('Carried over').length).toBeGreaterThan(0);
    await userEvent.click(next[0] as HTMLElement); // drop one
    await userEvent.click(within(form).getByRole('button', { name: /Save and plan/ }));
    expect(await within(form).findByRole('status')).toHaveTextContent('Saved');

    expect((await db.reviews.get('review:weekly:2026-11-02'))?.answers.went_well).toBe(
      'Stuck with study',
    );
    const planned = await weekly('2026-11-09');
    expect(planned).toHaveLength(next.length - 1);
    expect(
      (await db.plan_history.toArray()).some(
        (h) => h.trigger === 'weekly:2026-11-09' && /^Next week’s quests/.test(h.summary),
      ),
    ).toBe(true);

    // Monday: the automatic weekly plan sees the week is already planned.
    setNow(ist(2026, 11, 9, 10));
    await runWeeklyPlan(db);
    expect(await weekly('2026-11-09')).toHaveLength(planned.length);
    await waitFor(() => expect(within(form).getByText(/Next week is planned/)).toBeInTheDocument());
  }, 15_000);
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import type { JobApplication } from '@/core/db/types';
import { jobStats } from '@/core/engine/jobs';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startJobs } from '@/core/state/jobs';
import { startQuests } from '@/core/state/quests';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { FollowUpsCard } from './FollowUpsCard';
import { JobSuggestionCard } from './JobSuggestionCard';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 11));
  await recordAction({ type: 'settings.update', payload: { jobs_enabled: true } });
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

async function start() {
  await startAppState();
  await startToday();
  await startJobs();
  await startQuests();
}

describe('Today: follow-ups', () => {
  it('shows due follow-ups; "Done" moves the reminder a week on', async () => {
    const job = (
      await recordAction<JobApplication>({
        type: 'job.create',
        payload: { company: 'Agile Robots', role: 'Intern', applied_at: '2026-10-26' },
      })
    ).value as JobApplication;
    expect(job.follow_up_at).toBe('2026-11-02');
    await start();
    render(
      <MemoryRouter>
        <FollowUpsCard />
      </MemoryRouter>,
    );
    const card = await screen.findByRole('region', { name: 'Follow-ups' });
    expect(card).toHaveTextContent('Agile Robots');
    await userEvent.click(within(card).getByRole('button', { name: 'Done — again in a week' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Follow-ups' })).toBeNull());
    expect((await db.job_applications.get(job.id))?.follow_up_at).toBe('2026-11-09');
  });
});

describe('Jobs: planner suggestion', () => {
  const stats = {
    ...jobStats([], '2026-11-02', 1),
    drops: { applied: 0, assessment: 0, interview: 3 },
    mostDrop: 'interview' as const,
  };

  it('adds the suggested step to this week, then disappears', async () => {
    await start();
    render(<JobSuggestionCard stats={stats} />);
    const card = await screen.findByRole('region', { name: 'Planner suggestion' });
    await userEvent.click(within(card).getByRole('button', { name: 'Add to this week' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Planner suggestion' })).toBeNull(),
    );
    expect((await db.quests.toArray()).map((q) => [q.title, q.type, q.week_start])).toEqual([
      ['One mock interview', 'weekly', '2026-11-02'],
    ]);
  });

  it('"Not now" hides it', async () => {
    await start();
    render(<JobSuggestionCard stats={stats} />);
    const card = await screen.findByRole('region', { name: 'Planner suggestion' });
    await userEvent.click(within(card).getByRole('button', { name: 'Not now' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Planner suggestion' })).toBeNull(),
    );
  });
});

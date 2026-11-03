import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startGoals } from '@/core/state/goals';
import { startSkills } from '@/core/state/skills';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { CareerGap } from './CareerGap';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  await db.profile.put({
    ...newBase('profile'),
    name: 'R',
    start_day: '2026-11-02',
    onboarded_at: '2026-11-02T00:00:00.000Z',
    display_title: null,
    compass: { target_career: 'robotics-engineer' },
  });
  await startAppState();
  await startToday();
  await startGoals();
  await startSkills();
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

it('shows the gap with readiness, and turns it into a plan waiting for approval', async () => {
  render(
    <MemoryRouter>
      <CareerGap />
    </MemoryRouter>,
  );
  const section = await screen.findByRole('region', { name: 'Your path' });
  expect(section).toHaveTextContent('Robotics engineer');
  expect(section).toHaveTextContent(/hours of focused learning left/);
  expect(section).toHaveTextContent(/ROS 2/);
  await userEvent.click(screen.getByRole('button', { name: /Turn into a plan/ }));
  await waitFor(async () => {
    const proposals = await db.plan_proposals.toArray();
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ status: 'pending', trigger: 'career:robotics-engineer' });
  });
  const mq = await db.main_quests.toArray();
  expect(mq[0]?.title).toBe('Become a robotics engineer');
  expect(await db.milestones.count()).toBe(0); // nothing applied before approval
}, 30_000);

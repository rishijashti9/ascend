import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { startAchievements } from '@/core/achievements/auto';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase, recordAction } from '@/core/pipeline';
import { achievementsStore, startAchievementsStore } from '@/core/state/achievements';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ACHIEVEMENTS } from '@/data/achievements';
import { generateHistory } from '@/dev/generate';
import { ist } from '@/test/testDb';
import { AchievementList } from './AchievementList';
import { AchievementToast } from './AchievementToast';

const check = async () =>
  (await recordAction<string[]>({ type: 'achievements.check', source: 'system', payload: {} }))
    .value ?? [];

beforeEach(async () => {
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 20));
  await generateHistory({ days: 40, seed: 5, database: db });
  await db.open();
}, 60_000);
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('achievements.check', () => {
  it('unlocks what history earned, once, with a date that sticks; Jobs ones stay hidden', async () => {
    // Applications exist, but Jobs isn't built yet (Phase 9): Applicant must not unlock.
    for (let i = 0; i < 12; i++) {
      await db.job_applications.put({
        ...newBase(`job${i}`),
        company: 'C',
        role: 'R',
        link: null,
        source: null,
        applied_at: '2026-11-01',
        stage: 'applied',
        stage_history: [],
        salary_range: null,
        notes: null,
        follow_up_at: null,
        linked_quest_instance_id: null,
      });
    }
    const first = await check();
    expect(first).toContain('first-step');
    expect(first).not.toContain('applicant');
    const stored = await db.achievements_unlocked.get('ach:first-step');
    expect(stored?.achievement_key).toBe('first-step');

    setNow(ist(2026, 11, 3, 20));
    expect(await check()).toEqual([]);
    expect((await db.achievements_unlocked.get('ach:first-step'))?.unlocked_at).toBe(
      stored?.unlocked_at,
    );
  }, 30_000);

  it('the auto-check runs after events and the toast + Profile list show the result', async () => {
    await startAchievementsStore();
    render(
      <MemoryRouter>
        <AchievementToast />
        <AchievementList />
      </MemoryRouter>,
    );
    const stop = startAchievements(db, 10);
    expect(
      await screen.findByText(/achievements unlocked|Achievement:/, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    stop();
    // Unlock events arrive one by one: wait until the toast has counted every stored unlock
    // and the store has them all.
    const stored = await db.achievements_unlocked.count();
    expect(stored).toBeGreaterThan(1);
    await waitFor(
      () => expect(screen.getByRole('status')).toHaveTextContent(`${stored} achievements unlocked`),
      { timeout: 10_000 },
    );
    await waitFor(
      () => expect(Object.keys(achievementsStore.getState().unlocked)).toHaveLength(stored),
      { timeout: 10_000 },
    );
    const n = Object.keys(achievementsStore.getState().unlocked).length;
    const visible = ACHIEVEMENTS.filter((a) => !a.feature).length;
    const list = screen.getByRole('region', { name: 'Achievements' });
    await waitFor(() => expect(list).toHaveTextContent(`${n} of ${visible} unlocked`));
    expect(within(list).getByRole('list', { name: 'Unlocked' })).toHaveTextContent('First Step');
    expect(list).not.toHaveTextContent('Applicant');

    await userEvent.click(within(list).getByText(/Still to unlock/));
    const locked = within(list).getByRole('list', { name: 'Still to unlock' });
    expect(within(locked).getByText('Centurion')).toBeInTheDocument();
    expect(locked).toHaveTextContent(/\d+ \/ 100/);

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    });
    expect(screen.queryByText(/achievements unlocked|Achievement:/)).not.toBeInTheDocument();
  }, 30_000);
});

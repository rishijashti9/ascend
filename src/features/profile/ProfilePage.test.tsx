import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startFocusStore } from '@/core/state/focus';
import { progressStore, startProgressStore } from '@/core/state/progress';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { generateHistory } from '@/dev/generate';
import { ist } from '@/test/testDb';
import { ProfilePage } from './ProfilePage';

beforeEach(async () => {
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2027, 1, 20, 20));
  await generateHistory({ days: 60, seed: 3, database: db });
  await db.open();
  for (const s of [startAppState, startToday, startProgressStore, startFocusStore]) await s();
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}, 60_000);
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Profile', () => {
  it('shows level, rank, lifetime numbers, stats, XP per week and a multi-year heatmap', async () => {
    const progress = progressStore.getState().progress;
    if (!progress) throw new Error('no progress');
    const player = screen.getByRole('region', { name: 'Player' });
    expect(player).toHaveTextContent(`Level ${progress.level.level}`);
    expect(player).toHaveTextContent(`Rank ${progress.rank}`);
    expect(player).toHaveTextContent(`Days active${progress.streak.daysActive}`);

    // Stats triangle: every corner labelled, and a table with the same numbers.
    const stats = screen.getByRole('region', { name: 'Stats' });
    expect(within(stats).getByRole('img')).toHaveAccessibleName(
      `Strength level ${progress.stats.STR.level}, Intellect level ${progress.stats.INT.level}, Willpower level ${progress.stats.WIL.level}`,
    );
    await userEvent.click(within(stats).getByRole('button', { name: 'Table' }));
    expect(within(stats).getByRole('table')).toHaveTextContent(
      `StrengthLevel ${progress.stats.STR.level}`,
    );

    // XP per week: one table row per week.
    const xp = screen.getByRole('region', { name: 'XP per week' });
    await userEvent.click(within(xp).getByRole('button', { name: 'Table' }));
    expect(within(xp).getAllByRole('row')).toHaveLength(12);

    // Heatmap: years back to the first year of play; arrow keys read a day.
    const heat = screen.getByRole('region', { name: 'Active days' });
    const years = within(heat).getByRole('group', { name: 'Year' });
    expect(within(years).getByRole('button', { name: '2027' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const calendar = within(heat).getByRole('img', { name: /Activity calendar for 2027/ });
    fireEvent.keyDown(calendar, { key: 'ArrowRight' });
    expect(within(heat).getByRole('status')).toHaveTextContent(
      /20 Jan 2027 — (Not active|Active|Daily Clear)/,
    );
    await userEvent.click(within(years).getByRole('button', { name: '2026' }));
    const activeIn2026 = Object.entries(progress.perDay).filter(
      ([d, s]) => d.startsWith('2026') && s.active,
    ).length;
    expect(heat).toHaveTextContent(
      `${activeIn2026} active day${activeIn2026 === 1 ? '' : 's'} in 2026`,
    );
  }, 30_000);
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { titleName } from '@/core/achievements/titles';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase, recordAction } from '@/core/pipeline';
import { achievementId } from '@/core/pipeline/actions/achievements';
import { startAchievementsStore } from '@/core/state/achievements';
import { startAppState } from '@/core/state/app';
import { startProgressStore } from '@/core/state/progress';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { StatusHeader } from '@/features/today/StatusHeader';
import { ist } from '@/test/testDb';
import { TitlePicker } from './TitlePicker';

const unlock = (key: string) =>
  db.achievements_unlocked.put({
    ...newBase(achievementId(key)),
    achievement_key: key,
    unlocked_at: '2026-11-02T10:00:00.000Z',
  });
const setTitle = (key: string | null) =>
  recordAction({ type: 'profile.setTitle', payload: { key } });

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  await db.profile.put({
    ...newBase('profile'),
    name: 'Rishi',
    start_day: '2026-11-02',
    onboarded_at: '2026-11-02T00:00:00.000Z',
    display_title: null,
  });
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('profile.setTitle', () => {
  it('accepts only unlocked, visible achievements; null clears it', async () => {
    await expect(setTitle('first-light')).rejects.toThrow('That title isn’t unlocked yet');
    await expect(setTitle('no-such-thing')).rejects.toThrow('That title isn’t unlocked yet');
    // Unlocked, but its feature (Jobs) isn't built yet → hidden, so not wearable.
    await unlock('applicant');
    await expect(setTitle('applicant')).rejects.toThrow('That title isn’t unlocked yet');

    await unlock('first-light');
    await setTitle('first-light');
    expect((await db.profile.get('profile'))?.display_title).toBe('first-light');
    expect(titleName('first-light')).toBe('First Light');
    await setTitle(null);
    expect((await db.profile.get('profile'))?.display_title).toBeNull();
  });
});

describe('Title picker', () => {
  it('lists unlocked achievements and shows the chosen title on Today’s status', async () => {
    await unlock('first-step');
    await unlock('kindling');
    for (const s of [startAppState, startToday, startProgressStore, startAchievementsStore])
      await s();
    render(
      <MemoryRouter>
        <TitlePicker current={null} />
        <StatusHeader day="2026-11-02" />
      </MemoryRouter>,
    );
    const select = screen.getByLabelText('Title');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['No title', 'First Step', 'Kindling']);
    await userEvent.selectOptions(select, 'kindling');
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Status' })).toHaveTextContent('Rishi · Kindling'),
    );
    expect((await db.profile.get('profile'))?.display_title).toBe('kindling');
  });

  it('explains how to get a title when nothing is unlocked', async () => {
    await startAchievementsStore();
    render(<TitlePicker current={null} />);
    expect(screen.getByText(/Unlock an achievement to choose a title/)).toBeInTheDocument();
  });
});

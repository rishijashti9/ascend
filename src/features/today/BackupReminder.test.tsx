import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { BackupReminder } from './BackupReminder';

vi.mock('@/app/files', () => ({ exportBackup: vi.fn(async () => 'saved') }));

async function setup(startDay: string) {
  await db.profile.put({
    ...newBase('profile'),
    name: 'Rishi',
    start_day: startDay,
    onboarded_at: '2026-11-01T00:00:00.000Z',
    display_title: null,
  });
  await startAppState();
  await startToday();
  render(<BackupReminder />);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 12, 10));
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('BackupReminder', () => {
  it('appears after a week without a backup; "Later" hides it', async () => {
    await setup('2026-11-02');
    expect(screen.getByRole('region', { name: 'Backup reminder' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Backup reminder' })).not.toBeInTheDocument(),
    );
  });

  it('stays hidden during the first week', async () => {
    await setup('2026-11-08');
    expect(screen.queryByRole('region', { name: 'Backup reminder' })).not.toBeInTheDocument();
  });
});

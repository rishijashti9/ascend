import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildBackup } from '@/core/backup/export';
import { AscendDB, db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { ist } from '@/test/testDb';
import { ImportPanel } from './ImportPanel';

const exportBackup = vi.fn(async () => 'saved' as const);
vi.mock('@/app/files', () => ({ exportBackup: () => exportBackup() }));

/** A backup made on "another device" with 2 habits. */
async function otherDeviceBackup(): Promise<File> {
  const other = new AscendDB(`other-${crypto.randomUUID()}`);
  await other.open();
  for (const h of STARTER_HABITS.slice(0, 2)) {
    await recordAction({ type: 'habit.create', payload: habitFieldsOf(h) }, { db: other });
  }
  const backup = await buildBackup(other);
  other.close();
  return new File([JSON.stringify(backup)], 'ascend-backup.json', { type: 'application/json' });
}

const pick = (file: File) => userEvent.upload(screen.getByLabelText(/Choose backup file/), file);

beforeEach(async () => {
  await db.delete();
  await db.open();
  exportBackup.mockClear();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('ImportPanel', () => {
  it('rejects a file that is not JSON', async () => {
    render(<ImportPanel allowMerge backupFirst={false} />);
    await pick(new File(['not json'], 'x.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/isn’t valid JSON/);
  });

  it('rejects JSON that is not an ASCEND backup', async () => {
    render(<ImportPanel allowMerge backupFirst={false} />);
    await pick(new File(['{"a":1}'], 'x.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not an ASCEND backup/);
  });

  it('shows what is in the file, then imports it', async () => {
    const file = await otherDeviceBackup();
    render(<ImportPanel allowMerge backupFirst={false} />);
    await pick(file);
    expect(await screen.findByText(/2 daily\s+quests/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Merge/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Import complete');
    expect(await db.habits.count()).toBe(2);
    expect(exportBackup).not.toHaveBeenCalled();
  });

  it('saves a safety backup of this device first when there is data', async () => {
    const third = STARTER_HABITS[2];
    if (!third) throw new Error('missing starter');
    await recordAction({ type: 'habit.create', payload: habitFieldsOf(third) });
    const file = await otherDeviceBackup();
    render(<ImportPanel allowMerge backupFirst />);
    await pick(file);
    await userEvent.click(await screen.findByRole('radio', { name: /Merge/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(exportBackup).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('status')).toHaveTextContent('Import complete');
    expect(await db.habits.count()).toBe(3); // merged
  });

  it('onboarding restore offers no merge option', async () => {
    const file = await otherDeviceBackup();
    render(<ImportPanel allowMerge={false} backupFirst={false} />);
    await pick(file);
    await screen.findByText(/2 daily\s+quests/);
    expect(screen.queryByRole('radio', { name: /Merge/ })).not.toBeInTheDocument();
  });
});

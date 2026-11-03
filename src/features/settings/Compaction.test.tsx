import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase } from '@/core/pipeline';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { Compaction } from './Compaction';

const exported = vi.fn(async () => 'saved' as const);
vi.mock('@/app/files', () => ({
  exportBackup: () => exported(),
  exportWithPhotos: () => exported(),
}));

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  const old = '2025-06-10';
  await db.xp_events.add({
    ...newBase('x1'),
    day: old,
    occurred_at: `${old}T10:00:00.000Z`,
    stat: 'INT',
    base_amount: 25,
    reason: 'quest_full',
    idempotency_key: 'k1',
    ref_type: 'quest_instance',
    ref_id: 'h:2025-06-10',
  });
  await startToday();
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

it('preview first, export before anything changes, then compaction and its history', async () => {
  render(<Compaction totalBytes={30 * 1024 * 1024} />);
  expect(screen.getByText(/Your history is getting large \(30\.0 MB\)/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Show what would be compacted/ }));
  expect(await screen.findByText(/1 XP records/)).toBeInTheDocument();
  expect(await db.xp_events.count()).toBe(1); // nothing changed yet
  await userEvent.click(screen.getByRole('button', { name: 'Export, then compact' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(/progress is exactly the same/),
  );
  expect(exported).toHaveBeenCalledOnce();
  expect(await db.xp_events.count()).toBe(0);
  expect(await db.summaries.count()).toBe(1);
  expect(await screen.findByText(/detail before 2025-11-01 summarised/)).toBeInTheDocument();
}, 30_000);

import Dexie from 'dexie';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AscendDB } from '@/core/db/db';
import { clearSubscribers, newBase } from '@/core/pipeline';
import { accountStore } from '@/core/state/account';
import { RETRY_MS, startSync, syncStore } from '@/core/state/sync';
import { connect } from '@/core/sync/link';
import { resetClock, setNow } from '@/core/time';
import { SyncPausedNote } from '@/features/today/SyncPausedNote';
import { MemoryCloud } from '@/test/memoryBackend';
import { syncedAgo, syncStatusText } from './syncText';

const NOW = Date.UTC(2026, 10, 3, 9, 0);

describe('sync status wording', () => {
  it('is plain and never alarming', () => {
    const base = { lastSyncedAt: null, message: null };
    expect(syncStatusText({ ...base, status: 'syncing' }, NOW)).toBe('Syncing…');
    expect(syncStatusText({ ...base, status: 'synced', lastSyncedAt: NOW - 30_000 }, NOW)).toBe(
      'Synced just now.',
    );
    expect(
      syncStatusText({ ...base, status: 'synced', lastSyncedAt: NOW - 12 * 60_000 }, NOW),
    ).toBe('Synced 12 min ago.');
    expect(syncStatusText({ ...base, status: 'paused' }, NOW)).toMatch(
      /^Sync paused — the cloud is resting\. Your data is safe/,
    );
    expect(syncStatusText({ ...base, status: 'offline' }, NOW)).toMatch(/^Offline/);
    expect(
      syncStatusText({ ...base, status: 'error', message: 'Your sign-in has expired.' }, NOW),
    ).toBe('Your sign-in has expired.');
    expect(syncStatusText({ ...base, status: 'off' }, NOW)).toBeNull();
    expect(syncedAgo(NOW - 3 * 86_400_000, NOW)).toMatch(/^on /);
  });
});

describe('paused cloud', () => {
  let db: AscendDB;
  const cloud = new MemoryCloud();
  beforeEach(async () => {
    db = new AscendDB(`p-${crypto.randomUUID()}`);
    await db.open();
    await db.profile.put({
      ...newBase('profile'),
      name: 'R',
      start_day: '2026-11-02',
      onboarded_at: '2026-11-02T00:00:00Z',
      display_title: null,
    });
    await connect(db, cloud.backend(), 'u1', 'upload');
  });
  afterEach(async () => {
    clearSubscribers();
    resetClock();
    vi.useRealTimers();
    cloud.down = false;
    accountStore.setState({ status: 'signed_out', userId: null, email: null });
    syncStore.setState({ status: 'off', lastSyncedAt: null, message: null, failingSince: null });
    db.close();
    await Dexie.delete(db.name);
  });

  it('retries with back-off and clears the failure once the cloud is back', async () => {
    cloud.down = 'paused';
    accountStore.setState({ status: 'signed_in', userId: 'u1', email: null });
    const runner = startSync(() => cloud.backend(), { database: db, retryMs: [50] });
    await vi.waitFor(() => expect(syncStore.getState().status).toBe('paused'));
    expect(syncStore.getState().failingSince).not.toBeNull();
    expect(RETRY_MS).toEqual([60_000, 300_000, 900_000, 3_600_000]);

    cloud.down = false; // the retry (50 ms here) finds it back
    await vi.waitFor(() => expect(syncStore.getState().status).toBe('synced'));
    expect(syncStore.getState().failingSince).toBeNull();
    runner.stop();
  });

  it('Today shows a quiet note only after a day of failing', () => {
    setNow(NOW);
    syncStore.setState({
      status: 'paused',
      failingSince: NOW - 2 * 3_600_000,
      lastSyncedAt: null,
      message: null,
    });
    const { rerender } = render(
      <MemoryRouter>
        <SyncPausedNote />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Sync paused for a while/)).not.toBeInTheDocument();
    syncStore.setState({ failingSince: NOW - 25 * 3_600_000 });
    rerender(
      <MemoryRouter>
        <SyncPausedNote />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('link', { name: /Sync paused for a while — your data is safe/ }),
    ).toHaveAttribute('href', '/settings#account');
  });
});

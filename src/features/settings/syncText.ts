import type { SyncState } from '@/core/state/sync';

/** "just now" / "12 min ago" / "at 14:05" / "on 3 Nov". */
export function syncedAgo(at: number, now: number): string {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const d = new Date(at);
  return new Date(now).toDateString() === d.toDateString()
    ? `at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    : `on ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

/** What sync is doing, in plain words — never alarming: the data is always safe locally. */
export function syncStatusText(
  s: Pick<SyncState, 'status' | 'lastSyncedAt' | 'message'>,
  now: number,
): string | null {
  switch (s.status) {
    case 'checking':
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return s.lastSyncedAt ? `Synced ${syncedAgo(s.lastSyncedAt, now)}.` : 'Synced.';
    case 'offline':
      return 'Offline — changes are saved on this device and sync when you’re back online.';
    case 'paused':
      return 'Sync paused — the cloud is resting. Your data is safe on this device; ASCEND keeps trying.';
    case 'error':
      return (
        s.message ?? 'Sync hit a problem. Your data is safe on this device; ASCEND keeps trying.'
      );
    default:
      return null;
  }
}

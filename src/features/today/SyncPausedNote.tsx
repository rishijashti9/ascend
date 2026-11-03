import { CloudOff } from 'lucide-react';
import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import { useSync } from '@/core/state/sync';
import { useNow } from '@/ui/hooks/useNow';

const DAY_MS = 24 * 3_600_000;

/**
 * A quiet note on Today, only when sync has been failing for over a day (SPEC 9: a quiet
 * "Sync paused" note). Shorter hiccups only show in Settings → Account.
 */
export function SyncPausedNote() {
  const failingSince = useSync((s) => s.failingSince);
  const status = useSync((s) => s.status);
  const now = useNow(60_000);
  if (!isEnabled('sync') || !failingSince || now - failingSince < DAY_MS) return null;
  if (status !== 'paused' && status !== 'offline' && status !== 'error') return null;
  return (
    <Link
      to="/settings#account"
      className="border-border bg-surface text-muted flex min-h-11 items-center gap-2 rounded-lg border px-4 py-3 text-sm"
    >
      <CloudOff aria-hidden size={18} className="shrink-0" />
      <span className="flex-1">
        Sync paused for a while — your data is safe on this device, and it will catch up.
      </span>
    </Link>
  );
}

import { syncRunner, useSync } from '@/core/state/sync';
import { syncStatusText } from './syncText';
import { Button } from '@/ui/Button';
import { useNow } from '@/ui/hooks/useNow';

export function SyncStatusLine() {
  const state = useSync((s) => s);
  const now = useNow(30_000);
  const text = syncStatusText(state, now);
  if (!text) return null;
  const busy = state.status === 'syncing' || state.status === 'checking';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p
        role="status"
        className={`flex-1 text-sm ${state.status === 'synced' || busy ? 'text-muted' : ''}`}
      >
        {text}
      </p>
      <Button variant="secondary" disabled={busy} onClick={() => void syncRunner()?.syncNow()}>
        Sync now
      </Button>
    </div>
  );
}

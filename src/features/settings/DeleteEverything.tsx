import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { exportBackup } from '@/app/files';
import { deleteEverything } from '@/core/data/deleteEverything';
import { deleteAllData } from '@/core/db/open';
import { useAccount } from '@/core/state/account';
import { supabaseBackend } from '@/core/sync/backend';
import { getSupabase } from '@/core/sync/client';
import { Button } from '@/ui/Button';
import { Card } from './sections';

/**
 * "Delete everything" (SPEC 6.7 D): a clear two-step confirmation, an automatic final export,
 * then cloud data (and the account, if ticked) and this device.
 */
export function DeleteEverything() {
  const signedIn = useAccount((s) => s.status === 'signed_in');
  const [confirming, setConfirming] = useState(false);
  const [withAccount, setWithAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMessage(null);
    const client = signedIn ? getSupabase() : null;
    const r = await deleteEverything({
      exportFinal: () => exportBackup('ascend-final-export'),
      cloud: client ? { backend: supabaseBackend(client), client } : null,
      deleteAccount: withAccount,
      wipeDevice: () => deleteAllData(),
    });
    if (r.ok) {
      window.location.assign('/');
      return;
    }
    setMessage(r.message);
    setBusy(false);
  };

  return (
    <Card title="Delete everything">
      {!confirming ? (
        <Button variant="secondary" className="self-start" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden size={16} /> Delete everything…
        </Button>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <p>
            This removes all your ASCEND data from this device
            {signedIn ? ' and from your cloud account' : ''} — quests, XP, goals, logs, photos and
            everything learned. It can’t be undone. A final export is saved first, so you keep a
            copy.
          </p>
          {signedIn && (
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="size-5"
                checked={withAccount}
                onChange={(e) => setWithAccount(e.target.checked)}
              />
              Also delete my account
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void run()}>
              {busy ? 'Deleting…' : 'Yes, export and delete everything'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Keep my data
            </Button>
          </div>
        </div>
      )}
      {message && (
        <p role="alert" className="text-warning-text text-sm">
          {message}
        </p>
      )}
    </Card>
  );
}

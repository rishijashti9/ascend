import { useState } from 'react';
import { writeLocalBackup } from '@/app/localBackup';
import { logError } from '@/core/errorLog';
import type { LinkChoice } from '@/core/sync/link';
import { syncRunner } from '@/core/state/sync';
import { Button } from '@/ui/Button';

const CHOICES: { id: LinkChoice; label: string; text: string }[] = [
  {
    id: 'merge',
    label: 'Merge both',
    text: 'Combine this device and your account. Where the same thing was changed in both, the latest change wins. Nothing is lost.',
  },
  {
    id: 'keep_device',
    label: 'Keep this device’s data',
    text: 'Your account is replaced with what’s on this device.',
  },
  {
    id: 'use_cloud',
    label: 'Use my account’s data',
    text: 'This device is replaced with what’s in your account (photos stay — they never sync).',
  },
];

/**
 * First sign-in when this device and the account both have data (SPEC 9): ask, and make a
 * backup file first — if it can't be saved, nothing changes.
 */
export function SyncChoice() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (choice: LinkChoice) => {
    setBusy(true);
    setError(null);
    try {
      const where = await writeLocalBackup('ascend-before-sync');
      if (!where) {
        setError('Couldn’t save a backup first, so nothing was changed. Try again.');
        return;
      }
      setMessage(`A backup of this device was saved first (${where}).`);
      await syncRunner()?.choose(choice);
    } catch (e) {
      logError(e, 'sync.choose');
      setError('Something went wrong. Nothing was changed; please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="group"
      aria-label="Sync choice"
      className="border-border flex flex-col gap-3 border-t pt-4"
    >
      <p className="font-medium">This device and your account both have data.</p>
      <p className="text-muted text-sm">
        Choose what to keep. A backup file of this device is saved first, whatever you choose.
      </p>
      <ul className="flex flex-col gap-3">
        {CHOICES.map((c) => (
          <li key={c.id} className="flex flex-col gap-1">
            <Button
              variant={c.id === 'merge' ? 'primary' : 'secondary'}
              className="self-start"
              disabled={busy}
              onClick={() => void pick(c.id)}
            >
              {c.label}
            </Button>
            <span className="text-muted text-sm">{c.text}</span>
          </li>
        ))}
      </ul>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

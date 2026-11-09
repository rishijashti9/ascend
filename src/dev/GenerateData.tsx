import { useState } from 'react';
import type { AscendDB } from '@/core/db';
import { logError } from '@/core/errorLog';
import { clearSubscribers } from '@/core/pipeline';
import { generateHistory } from './generate';

const SIZES = [
  { days: 30, label: '30 days' },
  { days: 365, label: '1 year' },
  { days: 730, label: '2 years' },
];

/** Dev tools: replace all data with generated history (two taps), then reload the app. */
export function GenerateData({ db, reload }: { db: AscendDB; reload: () => void }) {
  const [days, setDays] = useState(365);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function generate() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    // Screens reload after every action; with thousands of actions that's far too slow.
    // The app reloads at the end anyway.
    clearSubscribers();
    try {
      await generateHistory({
        days,
        database: db,
        onProgress: (done, total) => setProgress(`Day ${done} / ${total}`),
      });
      reload();
    } catch (e) {
      logError(e, 'dev.generate');
      setProgress(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="border-border flex flex-col gap-2 border-t pt-3">
      <span className="text-muted">Generate test data (replaces ALL data)</span>
      <div className="flex gap-2">
        <select
          aria-label="Amount of history"
          value={days}
          disabled={progress !== null}
          onChange={(e) => setDays(Number(e.target.value))}
          className="control min-h-11 px-2"
        >
          {SIZES.map((s) => (
            <option key={s.days} value={s.days}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={progress !== null && !progress.startsWith('Failed')}
          onClick={() => void generate()}
          className="border-warning text-warning-text min-h-11 flex-1 rounded-md border px-3 font-medium"
        >
          {progress ?? (confirm ? 'Tap again: wipe and generate' : 'Generate')}
        </button>
      </div>
    </div>
  );
}

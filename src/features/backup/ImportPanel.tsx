import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { exportBackup } from '@/app/files';
import { runRollover } from '@/app/rollover';
import { backupCounts, parseBackup, type Backup } from '@/core/backup/format';
import { readZip, type ZipContents } from '@/core/backup/zip';
import { logError } from '@/core/errorLog';
import { recordAction, type ImportResult } from '@/core/pipeline';
import { Button } from '@/ui/Button';

type Mode = 'replace' | 'merge';

const MODES: { value: Mode; label: string; detail: string }[] = [
  {
    value: 'replace',
    label: 'Replace',
    detail: 'This device ends up exactly like the backup.',
  },
  {
    value: 'merge',
    label: 'Merge',
    detail: 'Combine both. The newer change wins; XP is never counted twice.',
  },
];

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Pick a backup file → see what's in it → choose Replace or Merge → import. When there is
 * data on this device, a safety backup of it is saved first (SPEC 11: auto-export first).
 */
export function ImportPanel({
  allowMerge,
  backupFirst,
  onImported,
}: {
  allowMerge: boolean;
  backupFirst: boolean;
  onImported?: (result: ImportResult) => void;
}) {
  const [backup, setBackup] = useState<Backup | null>(null);
  const [mode, setMode] = useState<Mode>('replace');
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<ZipContents['photos']>([]);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function choose(file: File | undefined) {
    setBackup(null);
    setMessage(null);
    setPhotos([]);
    if (!file) return;
    let raw: unknown;
    if (file.name.toLowerCase().endsWith('.zip')) {
      // "Export with photos": the backup plus photos (this device only).
      try {
        const contents = readZip(new Uint8Array(await file.arrayBuffer()));
        raw = contents.backup;
        setPhotos(contents.photos);
      } catch (e) {
        setMessage({
          text: e instanceof Error ? e.message : 'That .zip couldn’t be read.',
          error: true,
        });
        return;
      }
    } else {
      try {
        raw = JSON.parse(await file.text());
      } catch {
        setMessage({ text: 'That file isn’t a backup (it isn’t valid JSON).', error: true });
        return;
      }
    }
    const parsed = parseBackup(raw);
    if (parsed.ok) setBackup(parsed.backup);
    else setMessage({ text: parsed.error, error: true });
  }

  async function runImport() {
    if (!backup) return;
    setBusy(true);
    setMessage(null);
    try {
      if (backupFirst && (await exportBackup('ascend-before-import')) === 'cancelled') {
        setMessage({ text: 'Import stopped: the safety backup wasn’t saved.', error: true });
        return;
      }
      // Photos first: the data import can switch screens (e.g. leave onboarding) right away.
      if (photos.length > 0) await recordAction({ type: 'photo.restore', payload: { photos } });
      const { value } = await recordAction<ImportResult>({
        type: 'data.import',
        payload: { mode, backup },
      });
      await runRollover(); // close any days between the backup and today
      setBackup(null);
      setMessage({ text: 'Import complete. Your progress has been rebuilt.', error: false });
      if (value) onImported?.(value);
    } catch (e) {
      logError(e, 'import');
      setMessage({ text: 'Import failed — nothing was changed. Please try again.', error: true });
    } finally {
      setBusy(false);
    }
  }

  const counts = backup ? backupCounts(backup) : null;
  return (
    <div className="flex flex-col gap-3">
      {!backup && (
        <label className="control hover:bg-surface-2 inline-flex min-h-11 cursor-pointer items-center gap-2 self-start px-4 font-medium focus-within:outline-2">
          <FileUp aria-hidden size={18} />
          Choose backup file…
          <input
            type="file"
            accept=".json,application/json,.zip,application/zip"
            className="sr-only"
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </label>
      )}

      {backup && counts && (
        <div className="inset flex flex-col gap-3 p-3">
          <p className="text-sm">
            Backup from <strong>{dateOf(backup.exported_at)}</strong>: {counts.habits} daily quests,{' '}
            {counts.days} days, {counts.xpEvents} XP records
            {photos.length > 0 && `, ${photos.length} photo${photos.length === 1 ? '' : 's'}`}.
          </p>
          {allowMerge && (
            <div role="radiogroup" aria-label="Import mode" className="flex flex-col gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.value}
                  onClick={() => setMode(m.value)}
                  className={`panel flex min-h-11 flex-col items-start px-3 py-2 text-left ${
                    mode === m.value ? 'outline-accent font-semibold outline-2' : ''
                  }`}
                >
                  <span>{m.label}</span>
                  <span className="text-muted text-xs font-normal">{m.detail}</span>
                </button>
              ))}
            </div>
          )}
          {backupFirst && (
            <p className="text-muted text-xs">
              A backup of what’s on this device now is saved first, just in case.
            </p>
          )}
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void runImport()}>
              {busy ? 'Importing…' : 'Import'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setBackup(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={message.error ? 'text-warning-text text-sm' : 'text-sm'}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

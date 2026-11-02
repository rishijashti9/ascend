import { Download } from 'lucide-react';
import { useState } from 'react';
import { exportBackup } from '@/app/files';
import { isNativeApp } from '@/app/platform';
import { logError } from '@/core/errorLog';
import { useAppState } from '@/core/state/app';
import { useHabits } from '@/core/state/habits';
import { ImportPanel } from '@/features/backup/ImportPanel';
import { Button } from '@/ui/Button';
import { Card } from './sections';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Export / import (SPEC 11): the safety net until sync exists, and the way to move devices. */
export function BackupSection() {
  const lastExportAt = useAppState((s) => s.lastExportAt);
  const hasData = useHabits((s) => s.habits.length > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportNow() {
    setBusy(true);
    setError(null);
    try {
      await exportBackup();
    } catch (e) {
      logError(e, 'export');
      setError('Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Backup">
      <div className="flex flex-col gap-2">
        <Button className="self-start" disabled={busy} onClick={() => void exportNow()}>
          <Download aria-hidden size={18} />
          {busy ? 'Exporting…' : 'Export my data'}
        </Button>
        <p className="text-muted text-xs">
          {lastExportAt ? `Last export: ${when(lastExportAt)}.` : 'No export yet.'}{' '}
          {isNativeApp()
            ? 'Choose where to keep the file (Files, Drive, email…).'
            : 'Your data lives only in this browser until sync arrives — export weekly and keep the file somewhere safe.'}{' '}
          Photos are never included.
        </p>
        {error && (
          <p role="alert" className="text-warning-text text-sm">
            {error}
          </p>
        )}
      </div>
      <div className="border-border flex flex-col gap-2 border-t pt-4">
        <h3 className="text-sm font-medium">Import a backup</h3>
        <ImportPanel allowMerge backupFirst={hasData} />
      </div>
    </Card>
  );
}

import { HardDriveDownload } from 'lucide-react';
import { exportBackup } from '@/app/files';
import { isNativeApp } from '@/app/platform';
import { isEnabled } from '@/config/features';
import { backupReminderDue } from '@/core/backup/reminder';
import { useAppState } from '@/core/state/app';
import { useToday } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { useNow } from '@/ui/hooks/useNow';

/** A gentle weekly "back up your data" note in the browser (see core/backup/reminder.ts). */
export function BackupReminder() {
  const { lastExportAt, backupSnoozeUntil, profile } = useAppState((s) => s);
  const day = useToday((s) => s.day);
  const now = useNow(60_000);
  const { run, busy } = useAction();

  const due =
    isEnabled('exportImport') &&
    backupReminderDue({
      native: isNativeApp(),
      startDay: profile?.start_day ?? null,
      today: day,
      lastExportAt,
      snoozeUntil: backupSnoozeUntil,
      nowMs: now,
    });
  if (!due) return null;

  return (
    <div
      role="region"
      aria-label="Backup reminder"
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <p className="flex items-start gap-2 text-sm">
        <HardDriveDownload aria-hidden size={18} className="text-accent-text mt-0.5 shrink-0" />
        <span>
          {lastExportAt
            ? 'It’s been a week since your last backup.'
            : 'Your progress lives only in this browser.'}{' '}
          Export a copy and keep it somewhere safe.
        </span>
      </p>
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void exportBackup()}>
          Export now
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void run({ type: 'backup.snooze', payload: {} })}
        >
          Later
        </Button>
      </div>
    </div>
  );
}

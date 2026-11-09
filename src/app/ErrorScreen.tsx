import { useState } from 'react';
import { RotateCw, Copy, Check, Download } from 'lucide-react';
import { isEnabled } from '@/config/features';
import { formatErrorLog, logError } from '@/core/errorLog';
import { exportBackup } from './files';
import { Button } from '@/ui/Button';
import { Robot } from '@/ui/Robot';

/**
 * Friendly full-page error screen shown instead of a blank page. "Export my data" tries to
 * save a backup even while the app is broken, so data can always be rescued.
 */
export function ErrorScreen({ message }: { message?: string }) {
  const [copied, setCopied] = useState(false);
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  async function exportData() {
    setExportState('busy');
    try {
      setExportState((await exportBackup()) === 'saved' ? 'done' : 'idle');
    } catch (e) {
      logError(e, 'error-screen export');
      setExportState('failed');
    }
  }

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(formatErrorLog() || (message ?? 'Unknown error'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main
      role="alert"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6"
    >
      <div className="flex flex-col gap-3">
        <Robot size={56} />
        <h1 className="display text-2xl">Something went wrong</h1>
        <p className="text-muted">
          Your data is safe on this device. Reloading usually fixes this. If it keeps happening,
          copy the error details and share them.
        </p>
        {message && <p className="inset p-4 font-mono text-sm break-words">{message}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => window.location.reload()}>
          <RotateCw aria-hidden size={18} />
          Reload
        </Button>
        <Button variant="secondary" onClick={copyDetails}>
          {copied ? <Check aria-hidden size={18} /> : <Copy aria-hidden size={18} />}
          {copied ? 'Copied' : 'Copy error details'}
        </Button>
        {isEnabled('exportImport') && (
          <Button
            variant="secondary"
            disabled={exportState === 'busy'}
            onClick={() => void exportData()}
          >
            <Download aria-hidden size={18} />
            {exportState === 'done'
              ? 'Exported'
              : exportState === 'failed'
                ? 'Export failed — try again'
                : 'Export my data'}
          </Button>
        )}
      </div>
    </main>
  );
}

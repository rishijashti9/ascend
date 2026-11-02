import { useState } from 'react';
import { RotateCw, Copy, Check } from 'lucide-react';
import { formatErrorLog } from '@/core/errorLog';
import { Button } from '@/ui/Button';

/**
 * Friendly full-page error screen shown instead of a blank page.
 * "Export my data" is added here when export exists (task 2.13).
 */
export function ErrorScreen({ message }: { message?: string }) {
  const [copied, setCopied] = useState(false);

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
      className="bg-bg mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted">
          Your data is safe on this device. Reloading usually fixes this. If it keeps happening,
          copy the error details and share them.
        </p>
        {message && <p className="bg-surface-2 rounded-md p-3 font-mono text-sm">{message}</p>}
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
      </div>
    </main>
  );
}

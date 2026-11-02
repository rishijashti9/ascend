import { useRegisterSW } from 'virtual:pwa-register/react';
import { RotateCw, X } from 'lucide-react';
import { logError } from '@/core/errorLog';
import { Button } from '@/ui/Button';

const CHECK_EVERY_MS = 60 * 60 * 1000; // look for a new version hourly while open

/**
 * Calm "Update ready — reload" prompt (SPEC 9). The app never reloads by itself:
 * Rishi taps Reload when ready, so a focus session or form is never interrupted.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), CHECK_EVERY_MS);
    },
    onRegisterError(error: unknown) {
      logError(error, 'service worker');
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="border-border bg-surface shadow-overlay fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border p-3 lg:bottom-6"
    >
      <span className="flex-1 text-sm">Update ready.</span>
      <Button onClick={() => void updateServiceWorker(true)}>
        <RotateCw aria-hidden size={18} />
        Reload
      </Button>
      <Button variant="ghost" aria-label="Later" onClick={() => setNeedRefresh(false)}>
        <X aria-hidden size={18} />
      </Button>
    </div>
  );
}

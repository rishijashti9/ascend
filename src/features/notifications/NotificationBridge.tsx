import { Bell, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getNotifier } from '@/app/notify';
import { logError } from '@/core/errorLog';
import { handleTap } from '@/core/notifications/taps';
import { dismissNotice, useNotices } from '@/core/state/notices';
import { nowMs } from '@/core/time';

/**
 * Connects notification taps to the app (open the right screen; "I'm up" checks in at the tap
 * time) and shows reminders that came due while ASCEND is open as quiet banners (SPEC 8: the
 * web shows reminders in-app).
 */
export function NotificationBridge() {
  const navigate = useNavigate();
  const notices = useNotices((s) => s.notices);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () =>
      getNotifier().onTap((tap) => {
        void handleTap(tap)
          .then(setMessage)
          .catch((error: unknown) => logError(error, 'notifications.tap'))
          .finally(() => navigate(tap.path));
      }),
    [navigate],
  );

  if (notices.length === 0 && !message) return null;
  return (
    <div
      className="fixed inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] z-40 mx-auto flex max-w-md flex-col gap-2 lg:left-auto lg:right-6"
      aria-live="polite"
    >
      {message && (
        <p
          role="alert"
          className="border-border bg-surface text-warning-text shadow-card rounded-lg border px-4 py-3 text-sm"
        >
          {message}
        </p>
      )}
      {notices.map((n) => (
        <div
          key={n.key}
          role="status"
          className="border-border bg-surface shadow-card flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          <Bell aria-hidden size={18} className="text-accent-text mt-0.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p>
              <span className="font-medium">{n.title}</span>{' '}
              <span className="text-muted">{n.body}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {n.wakeInstanceId && (
                <button
                  type="button"
                  className="bg-accent-fill text-on-accent min-h-11 rounded-md px-4 font-medium"
                  onClick={() => {
                    dismissNotice(n.key);
                    void handleTap({
                      key: n.key,
                      kind: n.kind,
                      day: n.day,
                      path: n.path,
                      wakeInstanceId: n.wakeInstanceId ?? null,
                      wakeUp: true,
                      at: nowMs(),
                    }).then(setMessage);
                  }}
                >
                  I’m up
                </button>
              )}
              {n.path !== '/' && (
                <button
                  type="button"
                  className="text-accent-text min-h-11 px-2"
                  onClick={() => {
                    dismissNotice(n.key);
                    navigate(n.path);
                  }}
                >
                  Open
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss reminder"
            onClick={() => dismissNotice(n.key)}
            className="text-muted flex size-11 shrink-0 items-center justify-center"
          >
            <X aria-hidden size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

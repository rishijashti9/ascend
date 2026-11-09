import { Bell, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getNotifier } from '@/app/notify';
import { logError } from '@/core/errorLog';
import { handleTap, LEARNED_KINDS } from '@/core/notifications/taps';
import { recordAction } from '@/core/pipeline';
import { dismissNotice, useNotices } from '@/core/state/notices';
import { nowMs } from '@/core/time';
import { Button } from '@/ui/Button';

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
      getNotifier().onDelivered?.((n) => {
        if (!LEARNED_KINDS.has(n.kind)) return;
        void recordAction({
          type: 'learning.notification',
          payload: { key: n.key, kind: n.kind, outcome: 'delivered' },
          occurred_at: new Date(n.at).toISOString(),
          action_id: `notification-delivered:${n.key}`,
        }).catch((error: unknown) => logError(error, 'learning.notification'));
      }),
    [],
  );

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
          className="panel shadow-float text-warning-text outline-warning px-5 py-4 text-sm outline-2"
        >
          {message}
        </p>
      )}
      {notices.map((n) => (
        <div
          key={n.key}
          role="status"
          className="panel shadow-float flex items-start gap-3 py-3 pr-2 pl-3 text-sm"
        >
          <span
            aria-hidden
            className="bg-tile-lime text-on-tile-lime grid size-10 shrink-0 place-items-center rounded-full"
          >
            <Bell size={18} strokeWidth={2.5} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="pt-0.5">
              <span className="display block text-base">{n.title}</span>
              <span className="text-muted">{n.body}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {n.wakeInstanceId && (
                <Button
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
                </Button>
              )}
              {n.path !== '/' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    dismissNotice(n.key);
                    navigate(n.path);
                  }}
                >
                  Open
                </Button>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss reminder"
            onClick={() => dismissNotice(n.key)}
            className="text-muted hover:text-text hover:bg-surface-2 grid size-11 shrink-0 place-items-center rounded-full"
          >
            <X aria-hidden size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

import { logError } from '@/core/errorLog';
import type {
  Notifier,
  NotificationTap,
  NotifyPermission,
  PlannedNotification,
} from '@/core/notifications/types';
import { pushNotice } from '@/core/state/notices';
import { nowMs } from '@/core/time';

/**
 * Web / laptop (SPEC 8): browsers can't schedule reminders ahead, so they only come while
 * ASCEND is open. A due reminder always shows as an in-app banner; if browser notifications
 * are switched on (and allowed), a system notification is shown as well — but browsers may
 * delay or drop them, which Settings says plainly.
 */
const MAX_DELAY = 24 * 3_600_000; // re-planned at least daily (rollover), so a day ahead is enough

const toTap = (n: PlannedNotification, wakeUp: boolean): NotificationTap => ({
  key: n.key,
  kind: n.kind,
  day: n.day,
  path: n.path,
  wakeInstanceId: n.wakeInstanceId ?? null,
  wakeUp,
  at: nowMs(),
});

export function createBrowserNotifier(browserNotificationsOn: () => boolean): Notifier {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const handlers = new Set<(tap: NotificationTap) => void>();
  const supported = () => typeof window !== 'undefined' && 'Notification' in window;

  function fire(n: PlannedNotification) {
    timers.delete(n.key);
    pushNotice(n);
    if (!browserNotificationsOn() || !supported() || Notification.permission !== 'granted') return;
    try {
      const shown = new Notification(n.title, { body: n.body, tag: n.key });
      shown.onclick = () => {
        window.focus();
        for (const h of handlers) h(toTap(n, false));
        shown.close();
      };
    } catch (error) {
      // Some mobile browsers only allow notifications from a service worker.
      logError(error, 'notifications.browser');
    }
  }

  return {
    platform: 'browser',
    async permission() {
      if (!supported()) return 'unsupported';
      const p = Notification.permission;
      return p === 'default' ? 'prompt' : (p as NotifyPermission);
    },
    async requestPermission() {
      if (!supported()) return 'unsupported';
      const p = await Notification.requestPermission();
      return p === 'default' ? 'prompt' : (p as NotifyPermission);
    },
    async sync(list) {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      const now = nowMs();
      for (const n of list) {
        const delay = n.at - now;
        if (delay <= 0 || delay > MAX_DELAY) continue;
        timers.set(
          n.key,
          setTimeout(() => fire(n), delay),
        );
      }
    },
    async showNow(n) {
      const delay = n.at - nowMs();
      if (delay > 1000) setTimeout(() => fire(n), delay);
      else fire(n);
    },
    // Browsers have no exact alarms; reminders only come while ASCEND is open anyway.
    async exactAlarms() {
      return 'unsupported';
    },
    async openExactAlarmSettings() {
      return 'unsupported';
    },
    onTap(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

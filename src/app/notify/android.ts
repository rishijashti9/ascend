import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { logError } from '@/core/errorLog';
import { nowMs } from '@/core/time';
import type {
  ExactAlarms,
  Notifier,
  NotificationTap,
  NotifyPermission,
  PlannedNotification,
} from '@/core/notifications/types';

/**
 * Android: Capacitor Local Notifications — scheduled ahead (SPEC: the next 7 days), shown even
 * when the app is closed, offline. Only notifications ASCEND made (marked in `extra`) are ever
 * cancelled. The "I'm up" button is an action type; its tap opens the app, and the time of the
 * tap is what counts.
 */
const CHANNEL = 'ascend';
const WAKE_TYPE = 'ASCEND_WAKE';
const WAKE_ACTION = 'wake_up';

/** A stable positive 31-bit id from the key (Android needs integer ids). */
export function notificationId(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 1 || 1;
}

const toPermission = (state: string): NotifyPermission =>
  state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';

const toExact = (state: string): ExactAlarms => (state === 'granted' ? 'granted' : 'denied');

function toSchema(n: PlannedNotification, at: number): LocalNotificationSchema {
  return {
    id: notificationId(n.key),
    title: n.title,
    body: n.body,
    channelId: CHANNEL,
    autoCancel: true,
    schedule: { at: new Date(at), allowWhileIdle: true },
    ...(n.wakeInstanceId ? { actionTypeId: WAKE_TYPE } : {}),
    extra: {
      ascend: true,
      key: n.key,
      kind: n.kind,
      day: n.day,
      path: n.path,
      wakeInstanceId: n.wakeInstanceId ?? null,
    },
  };
}

export function createAndroidNotifier(): Notifier {
  let ready: Promise<void> | null = null;
  const setup = () =>
    (ready ??= (async () => {
      await LocalNotifications.createChannel({
        id: CHANNEL,
        name: 'Reminders',
        description: 'Wake-up check-in, briefing and gentle reminders',
        importance: 4,
      });
      await LocalNotifications.registerActionTypes({
        types: [
          { id: WAKE_TYPE, actions: [{ id: WAKE_ACTION, title: 'I’m up', foreground: true }] },
        ],
      });
    })().catch((error: unknown) => {
      logError(error, 'notifications.setup');
    }));

  return {
    platform: 'android',
    async permission() {
      return toPermission((await LocalNotifications.checkPermissions()).display);
    },
    async requestPermission() {
      return toPermission((await LocalNotifications.requestPermissions()).display);
    },
    async sync(list) {
      await setup();
      const pending = await LocalNotifications.getPending();
      // Ours, except Settings tests (a test waiting 2 minutes must survive a re-plan).
      const ours = pending.notifications.filter((p) => {
        const x = p.extra as { ascend?: boolean; kind?: string } | undefined;
        return x?.ascend && x.kind !== 'test';
      });
      if (ours.length > 0)
        await LocalNotifications.cancel({ notifications: ours.map((p) => ({ id: p.id })) });
      const now = Date.now();
      const upcoming = list.filter((n) => n.at > now);
      if (upcoming.length > 0) {
        await LocalNotifications.schedule({
          notifications: upcoming.map((n) => toSchema(n, n.at)),
        });
      }
    },
    async showNow(n) {
      await setup();
      await LocalNotifications.schedule({
        notifications: [toSchema(n, Math.max(n.at, Date.now() + 1000))],
      });
    },
    async exactAlarms() {
      return toExact((await LocalNotifications.checkExactNotificationSetting()).exact_alarm);
    },
    async openExactAlarmSettings() {
      return toExact((await LocalNotifications.changeExactNotificationSetting()).exact_alarm);
    },
    onTap(handler: (tap: NotificationTap) => void) {
      const handle = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
        const x = (e.notification.extra ?? {}) as Record<string, unknown>;
        if (!x.ascend) return;
        handler({
          key: String(x.key),
          kind: x.kind as PlannedNotification['kind'],
          day: String(x.day),
          path: typeof x.path === 'string' ? x.path : '/',
          wakeInstanceId: typeof x.wakeInstanceId === 'string' ? x.wakeInstanceId : null,
          wakeUp: e.actionId === WAKE_ACTION,
          at: nowMs(),
        });
      });
      return () => void handle.then((h) => h.remove());
    },
  };
}

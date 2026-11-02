import { useEffect, useState } from 'react';
import { getNotifier } from '@/app/notify';
import type { Settings } from '@/core/db/types';
import type { NotifyPermission } from '@/core/notifications/types';
import { useToday } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { Switch } from '@/ui/Switch';
import { Card } from './sections';

/**
 * Notifications (SPEC 7.11, 8): what this device can really do, said plainly — Android
 * schedules reminders a week ahead and works offline; a browser only reminds while ASCEND is
 * open (browser notifications are optional and may be delayed or dropped).
 */
export function NotificationSettings({ settings }: { settings: Settings }) {
  const notifier = getNotifier();
  const day = useToday((s) => s.day);
  const [permission, setPermission] = useState<NotifyPermission | null>(null);
  const [tested, setTested] = useState(false);
  const { run, busy, error } = useAction();
  const n = settings.notifications;
  const android = notifier.platform === 'android';

  useEffect(() => {
    void notifier.permission().then(setPermission);
  }, [notifier]);

  const ask = async () => setPermission(await notifier.requestPermission());
  const test = async () => {
    await notifier.showNow({
      key: `test:${Date.now()}`,
      kind: 'test',
      at: Date.now(),
      day: day ?? '',
      title: 'ASCEND',
      body: 'Notifications are working.',
      path: '/settings',
    });
    setTested(true);
  };
  const canShow = android ? permission === 'granted' : true;

  return (
    <Card title="Notifications">
      <p className="text-muted text-sm">
        {android
          ? 'Reminders are scheduled on this phone a week ahead, so they arrive even when ASCEND is closed or offline.'
          : 'In a browser, reminders appear only while ASCEND is open — as a banner at the top of the screen. Browsers can’t schedule them ahead, so don’t rely on this for waking up; the Android app can.'}
      </p>

      {android && permission === 'prompt' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex-1 text-sm">ASCEND needs permission to show notifications.</span>
          <Button onClick={() => void ask()}>Allow notifications</Button>
        </div>
      )}
      {android && permission === 'denied' && (
        <p className="text-warning-text text-sm">
          Notifications are blocked for ASCEND. Turn them on in Android Settings → Apps → ASCEND →
          Notifications.
        </p>
      )}

      {!android && permission !== 'unsupported' && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium" id="browser-notifications-label">
              Browser notifications
            </p>
            <p className="text-muted text-sm">
              Also show a system notification while ASCEND is open in a tab.
              {permission === 'denied' &&
                ' They’re blocked for this site in your browser settings.'}
            </p>
          </div>
          <Switch
            on={n.browser_notifications && permission === 'granted'}
            labelledBy="browser-notifications-label"
            disabled={busy || permission === 'denied'}
            onChange={(on) =>
              void (async () => {
                if (
                  on &&
                  permission !== 'granted' &&
                  (await notifier.requestPermission()) !== 'granted'
                ) {
                  setPermission(await notifier.permission());
                  return;
                }
                setPermission(await notifier.permission());
                await run({
                  type: 'settings.update',
                  payload: { notifications: { browser_notifications: on } },
                });
              })()
            }
          />
        </div>
      )}

      {canShow && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void test()}>
            Send a test
          </Button>
          {tested && (
            <span role="status" className="text-muted text-sm">
              Sent
              {android ? ' — it should appear in a moment.' : ' — look at the top of the screen.'}
            </span>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}

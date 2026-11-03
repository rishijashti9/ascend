import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { getNotifier } from '@/app/notify';
import type { Settings } from '@/core/db/types';
import {
  addMinutes,
  FOLLOW_UP_TIME,
  minuteInQuietHours,
  REMINDER_TIME,
} from '@/core/notifications/plan';
import type { NotifyPermission } from '@/core/notifications/types';
import { useToday } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { Switch } from '@/ui/Switch';
import { ReliableReminders } from './ReliableReminders';
import { Card } from './sections';

type Toggle =
  'wake_checkin' | 'morning_briefing' | 'quest_reminders' | 'evening_winddown' | 'job_followups';
const KINDS: { key: Toggle; label: string; hint: (s: Settings) => string }[] = [
  {
    key: 'wake_checkin',
    label: 'Wake-up check-in',
    hint: (s) =>
      `At ${s.wake_time}: “Day N. Are you up?” with an “I’m up” button — the moment you tap is what counts.`,
  },
  {
    key: 'morning_briefing',
    label: 'Morning briefing',
    hint: () => 'When the wake-up window ends: how many quests today, and where to start.',
  },
  {
    key: 'quest_reminders',
    label: 'Core quest reminder',
    hint: () =>
      `At ${REMINDER_TIME}, only if core quests are still open — the minimum versions count.`,
  },
  {
    key: 'evening_winddown',
    label: 'Evening wind-down',
    hint: (s) => `At ${s.notifications.evening_time}: a nudge for the 1-minute check-in.`,
  },
  {
    key: 'job_followups',
    label: 'Job follow-ups',
    hint: () =>
      `At ${FOLLOW_UP_TIME} on an application’s follow-up day (7 days after applying, unless you change it).`,
  },
];

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

  const { hash } = useLocation();
  useEffect(() => {
    void notifier.permission().then(setPermission);
  }, [notifier]);
  // Opened from Today's "Fix it": bring this card into view.
  useEffect(() => {
    if (hash === '#notifications') document.getElementById('notifications')?.scrollIntoView();
  }, [hash]);

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
  const held = [
    n.morning_briefing &&
      minuteInQuietHours(
        addMinutes(settings.wake_time, settings.wake_window_min),
        settings.quiet_hours,
      ) &&
      'The morning briefing',
    n.quest_reminders &&
      minuteInQuietHours(REMINDER_TIME, settings.quiet_hours) &&
      'The core quest reminder',
    n.evening_winddown &&
      minuteInQuietHours(n.evening_time, settings.quiet_hours) &&
      `The wind-down at ${n.evening_time}`,
  ].filter((x): x is string => typeof x === 'string');

  return (
    <Card title="Notifications" id="notifications">
      <p className="text-muted text-sm">
        {android
          ? 'Reminders are scheduled on this phone a week ahead, so they arrive even when ASCEND is closed or offline.'
          : 'In a browser, reminders appear only while ASCEND is open — as a small banner at the top. Browsers can’t schedule them ahead, so don’t rely on this for waking up; the Android app can.'}
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

      <ul className="divide-border flex flex-col divide-y">
        {KINDS.filter((k) => k.key !== 'job_followups' || settings.jobs_enabled).map((k) => (
          <li key={k.key} className="flex items-start justify-between gap-4 py-3">
            <div>
              <p className="font-medium" id={`notify-${k.key}`}>
                {k.label}
              </p>
              <p className="text-muted text-sm">{k.hint(settings)}</p>
            </div>
            <Switch
              on={n[k.key]}
              labelledBy={`notify-${k.key}`}
              disabled={busy}
              onChange={(on) =>
                void run({ type: 'settings.update', payload: { notifications: { [k.key]: on } } })
              }
            />
          </li>
        ))}
      </ul>
      {n.evening_winddown && (
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>Wind-down time</span>
          <input
            type="time"
            value={n.evening_time}
            disabled={busy}
            onChange={(e) => {
              if (/^\d{2}:\d{2}$/.test(e.target.value)) {
                void run({
                  type: 'settings.update',
                  payload: { notifications: { evening_time: e.target.value } },
                });
              }
            }}
            className="border-border bg-surface min-h-11 rounded-md border px-3 text-base"
          />
        </label>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium" id="quiet-hours-label">
            Quiet hours
          </p>
          <p className="text-muted text-sm">
            Nothing arrives during quiet hours — except the wake-up check-in, which you asked for.
          </p>
        </div>
        <Switch
          on={settings.quiet_hours !== null}
          labelledBy="quiet-hours-label"
          disabled={busy}
          onChange={(on) =>
            void run({
              type: 'settings.update',
              payload: { quiet_hours: on ? { start: '22:00', end: '04:45' } : null },
            })
          }
        />
      </div>
      {settings.quiet_hours && (
        <div className="flex flex-wrap gap-4 text-sm">
          {(['start', 'end'] as const).map((edge) => (
            <label key={edge} className="flex items-center gap-2">
              <span>{edge === 'start' ? 'From' : 'Until'}</span>
              <input
                type="time"
                aria-label={edge === 'start' ? 'Quiet hours from' : 'Quiet hours until'}
                value={settings.quiet_hours?.[edge] ?? ''}
                disabled={busy}
                onChange={(e) => {
                  const quiet = settings.quiet_hours;
                  if (quiet && /^\d{2}:\d{2}$/.test(e.target.value)) {
                    void run({
                      type: 'settings.update',
                      payload: { quiet_hours: { ...quiet, [edge]: e.target.value } },
                    });
                  }
                }}
                className="border-border bg-surface min-h-11 rounded-md border px-3 text-base"
              />
            </label>
          ))}
        </div>
      )}
      {held.length > 0 && (
        <p className="text-warning-text text-sm">
          {held.join(' and ')} {held.length === 1 ? 'falls' : 'fall'} inside quiet hours, so{' '}
          {held.length === 1 ? 'it' : 'they'} won’t arrive.
        </p>
      )}
      <p className="text-muted text-sm">
        If you don’t open ASCEND for a week, reminders stop by themselves — except one gentle note.
        They start again the next time you open it.
      </p>

      {android && permission === 'granted' && <ReliableReminders wakeTime={settings.wake_time} />}

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

import { AlarmClock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getNotifier } from '@/app/notify';
import { isEnabled } from '@/config/features';
import { useAppState } from '@/core/state/app';

/**
 * Android only: while the wake-up check-in can't arrive on time — notifications not allowed,
 * or exact alarms off — Today says so once, with a link to fix it (task 6.5). It disappears
 * as soon as both are fine; "Not now" hides it until the app is opened again.
 */
export function ReminderSetupCard() {
  const notifier = getNotifier();
  const settings = useAppState((s) => s.settings);
  const [problem, setProblem] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const wakeOn = settings?.notifications.wake_checkin ?? false;

  useEffect(() => {
    if (notifier.platform !== 'android' || !wakeOn) return;
    const check = async () => {
      const [permission, exact] = await Promise.all([
        notifier.permission(),
        notifier.exactAlarms(),
      ]);
      setProblem(
        permission !== 'granted'
          ? 'Notifications are off, so the wake-up check-in can’t reach you.'
          : exact === 'denied'
            ? 'Exact timing is off, so the wake-up check-in may arrive late.'
            : null,
      );
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [notifier, wakeOn]);

  if (!isEnabled('notifications') || !wakeOn || !problem || hidden) return null;
  return (
    <section
      aria-label="Reminder setup"
      className="panel flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
    >
      <AlarmClock aria-hidden size={18} className="text-warning-text shrink-0" />
      <span className="flex-1">{problem}</span>
      <Link
        to="/settings#notifications"
        className="text-accent-text min-h-11 content-center px-2 font-medium"
      >
        Fix it
      </Link>
      <button type="button" onClick={() => setHidden(true)} className="text-muted min-h-11 px-2">
        Not now
      </button>
    </section>
  );
}

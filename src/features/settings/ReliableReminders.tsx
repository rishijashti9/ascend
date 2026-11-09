import { useEffect, useState } from 'react';
import { manufacturer } from '@/app/device';
import { getNotifier } from '@/app/notify';
import type { ExactAlarms } from '@/core/notifications/types';
import { rescheduleAll } from '@/core/notifications/scheduler';
import { useToday } from '@/core/state/today';
import { nowMs } from '@/core/time';
import { BATTERY_GUIDES, guideFor } from '@/data/batteryGuide';
import { Button } from '@/ui/Button';

const TEST_DELAY_MS = 2 * 60_000;

/**
 * Making the 5:00 wake-up arrive on time on Android (Rishi's request, task 6.5):
 * 1. Exact alarms ("Alarms & reminders", Android 12+) — without them Android may deliver a
 *    reminder minutes late. Checked again whenever you come back to the app.
 * 2. Battery optimisation — many brands stop apps they think are idle; a guide per brand,
 *    opened at this phone's brand, plus a 2-minute test to try with the phone locked.
 */
export function ReliableReminders({ wakeTime }: { wakeTime: string }) {
  const notifier = getNotifier();
  const day = useToday((s) => s.day);
  const [exact, setExact] = useState<ExactAlarms | null>(null);
  const [brand, setBrand] = useState(guideFor(null).id);
  const [testAt, setTestAt] = useState<number | null>(null);

  useEffect(() => {
    const check = () => void notifier.exactAlarms().then(setExact);
    check();
    void manufacturer().then((m) => setBrand(guideFor(m).id));
    // Coming back from the system settings screen.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [notifier]);

  const allowExact = async () => {
    const state = await notifier.openExactAlarmSettings();
    setExact(state);
    // Reminders already scheduled were inexact: schedule them again.
    if (state === 'granted') await rescheduleAll();
  };
  const testLocked = async () => {
    const at = nowMs() + TEST_DELAY_MS;
    await notifier.showNow({
      key: `test:${at}`,
      kind: 'test',
      at,
      day: day ?? '',
      title: 'ASCEND test',
      body: 'This arrived on time with your phone locked — reminders will work.',
      path: '/settings',
    });
    setTestAt(at);
  };
  const guide = BATTERY_GUIDES.find((g) => g.id === brand) ?? guideFor(null);

  return (
    <div className="border-border flex flex-col gap-4 border-t pt-4">
      <h3 className="display">Make sure reminders arrive on time</h3>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium" id="exact-alarms">
          Exact timing{' '}
          <span className={exact === 'granted' ? 'text-success-text' : 'text-warning-text'}>
            {exact === 'granted' ? '· Allowed' : exact === 'denied' ? '· Off' : ''}
          </span>
        </p>
        {exact === 'denied' ? (
          <>
            <p className="text-muted text-sm">
              Without “Alarms & reminders”, Android may deliver your {wakeTime} wake-up check-in
              several minutes late. Allow it on the next screen, then come back.
            </p>
            <Button className="self-start" onClick={() => void allowExact()}>
              Allow exact timing
            </Button>
          </>
        ) : (
          exact === 'granted' && (
            <p className="text-muted text-sm">
              Your {wakeTime} wake-up check-in is scheduled for the exact minute.
            </p>
          )
        )}
      </div>

      <details className="flex flex-col gap-2">
        <summary className="text-accent-text min-h-11 cursor-pointer py-2 text-sm font-medium">
          Stop the phone from closing ASCEND (battery optimisation)
        </summary>
        <p className="text-muted mt-1 text-sm">
          Some phones stop apps they think are idle — and their reminders with them. ASCEND can’t
          change this itself; it takes a minute in your phone’s settings.
        </p>
        <div role="group" aria-label="Phone brand" className="mt-2 flex flex-wrap gap-1">
          {BATTERY_GUIDES.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={g.id === brand}
              onClick={() => setBrand(g.id)}
              className={`min-h-11 rounded-md px-3 text-sm ${
                g.id === brand ? 'bg-surface-2 font-semibold' : 'text-muted'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
        <ol
          aria-label={`Steps for ${guide.name}`}
          className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm"
        >
          {guide.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="text-muted mt-2 text-xs">Menu names differ a little between versions.</p>
      </details>

      <div className="flex flex-col gap-2">
        <Button variant="secondary" className="self-start" onClick={() => void testLocked()}>
          Test with the phone locked
        </Button>
        {testAt !== null && (
          <p role="status" className="text-muted text-sm">
            A test arrives at{' '}
            {new Date(testAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            . Lock your phone now and wait. If it’s late or never comes, follow the steps above.
          </p>
        )}
      </div>
    </div>
  );
}

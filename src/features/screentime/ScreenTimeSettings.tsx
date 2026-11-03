import { useEffect, useState } from 'react';
import { screenBridge } from '@/app/screenTime';
import type { ScreenStatus } from '@/core/screentime/bridge';
import { formatMinutes } from '@/core/screentime/observe';
import { loadScreen, useScreen } from '@/core/state/screen';
import { ENTERTAINMENT_APPS } from '@/data/entertainmentApps';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { Switch } from '@/ui/Switch';
import { Card } from '@/features/settings/sections';
import { LimitEditor } from './LimitEditor';
import { shortDate } from './format';

/** Set when Rishi taps "Allow screen time", so coming back with access starts the observe week. */
let waitingForAccess = false;

/**
 * Settings → Screen time (SPEC 6.8). Setup is one button ("Allow screen time" → Android's Usage
 * access screen); the observe week and the suggestion follow on Today. Afterwards: the limit
 * and its lock, waiting changes with their date, reminders on/off, and the entertainment list.
 */
export function ScreenTimeSettings() {
  const rules = useScreen((s) => s.rules);
  const lock = useScreen((s) => s.lock);
  const observe = useScreen((s) => s.observe);
  const { run, busy, error } = useAction();
  const [status, setStatus] = useState<ScreenStatus | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!screenBridge.available()) return;
    let alive = true;
    const check = async () => {
      const s = await screenBridge.status().catch(() => null);
      if (!alive || !s) return;
      setStatus(s);
      // Back from Android's Usage access screen with access granted: the observe week starts.
      if (s.usageAccess && waitingForAccess) {
        waitingForAccess = false;
        await run({ type: 'screen.setEnabled', payload: { on: true } });
      }
    };
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [run]);

  if (!screenBridge.available()) {
    return (
      <Card title="Screen time">
        <p className="text-muted text-sm">
          Screen time works in the ASCEND Android app on your phone: it counts time in entertainment
          apps and reminds you — it never blocks anything.
          {rules?.limit_min ? ` Your daily limit is ${formatMinutes(rules.limit_min)}.` : ''}
        </p>
      </Card>
    );
  }

  const enabled = rules?.enabled ?? false;
  const access = status?.usageAccess ?? false;

  async function allow() {
    if (access) {
      await run({ type: 'screen.setEnabled', payload: { on: true } });
      return;
    }
    waitingForAccess = true;
    await screenBridge.openUsageAccess().catch(() => undefined);
  }

  if (!enabled || !access) {
    return (
      <Card title="Screen time">
        <p className="text-sm">
          Counts how long you spend in entertainment apps each day and, once you’ve set a limit,
          reminds you calmly when you’re past it or scrolling after wind-down. It never blocks
          anything. Only daily totals per app are kept — on this phone and your own account, never
          sent to any AI.
        </p>
        <Button className="self-start" disabled={busy} onClick={() => void allow()}>
          {enabled ? 'Allow usage access again' : 'Allow screen time'}
        </Button>
        <div className="text-muted flex flex-col gap-1 text-sm">
          <p>
            Android opens its “Usage access” list: find ASCEND and switch on “Permit usage access”.
          </p>
          <p>
            Nothing Phone: Settings → Apps → Special app access → Usage access → ASCEND → Permit
            usage access.
          </p>
          <p>Then come back here — the first 7 days only observe, with no reminders.</p>
        </div>
        {error && (
          <p role="alert" className="text-warning-text text-sm">
            {error}
          </p>
        )}
      </Card>
    );
  }

  const pending = rules?.pending ?? null;
  const pendingText: string[] = [];
  if (pending) {
    if ('limit_min' in pending)
      pendingText.push(
        pending.limit_min === null ? 'no limit' : `limit ${formatMinutes(pending.limit_min ?? 0)}`,
      );
    if (pending.reminders === false) pendingText.push('reminders off');
    if (pending.enabled === false) pendingText.push('screen time off');
    for (const p of pending.removed_apps ?? []) pendingText.push(`${appName(p)} off the list`);
  }

  return (
    <Card title="Screen time">
      {observe.phase === 'observing' && (
        <p className="text-sm" role="status">
          Observing quietly — day {observe.day} of 7. On {shortDate(Date.parse(observe.endsOn))}{' '}
          Today shows one suggestion for your daily limit.
        </p>
      )}
      {rules?.limit_min !== null && rules?.limit_min !== undefined && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Daily entertainment limit:{' '}
            <span className="font-medium">{formatMinutes(rules.limit_min)}</span>
            {lock.active && lock.endMs ? ` · locked until ${shortDate(lock.endMs)}` : ''}
          </p>
          {pendingText.length > 0 && lock.endMs && (
            <p className="text-muted text-sm">
              Waiting for the lock to end ({shortDate(lock.endMs)}): {pendingText.join(', ')}.
            </p>
          )}
          {editing ? (
            <LimitEditor initial={rules.limit_min} onDone={() => setEditing(false)} />
          ) : (
            <Button variant="secondary" className="self-start" onClick={() => setEditing(true)}>
              Change limit
            </Button>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium" id="screen-reminders-label">
            Reminders
          </p>
          <p className="text-muted text-sm">
            Over your limit or after your wind-down time, on entertainment apps only: one calm
            notification, updated every minute. Silent in quiet hours.
          </p>
        </div>
        <Switch
          on={rules?.reminders ?? true}
          labelledBy="screen-reminders-label"
          disabled={busy}
          onChange={(on) => void run({ type: 'screen.setReminders', payload: { on } })}
        />
      </div>
      <AppList />
      <Button
        variant="ghost"
        className="self-start"
        disabled={busy}
        onClick={() => void run({ type: 'screen.setEnabled', payload: { on: false } })}
      >
        Turn screen time off
      </Button>
      {lock.active && (
        <p className="text-muted text-xs">
          While the limit is locked, anything that loosens it (a higher limit, removing an app,
          reminders or screen time off) waits until the lock ends.
        </p>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}

function appName(pkg: string): string {
  return ENTERTAINMENT_APPS.find((a) => a.packages.includes(pkg))?.name ?? pkg;
}

/** The entertainment list: apps seen recently, each with Add / Remove. */
function AppList() {
  const top = useScreen((s) => s.weekTop);
  const all = useScreen((s) => s.weekApps);
  const { run, busy } = useAction();
  const apps = all.length ? all : top;
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">Entertainment apps</p>
      <p className="text-muted text-sm">
        Built in: {ENTERTAINMENT_APPS.map((a) => a.name).join(', ')} and games. Everything else is
        never limited.
      </p>
      {apps.length > 0 && (
        <ul className="flex flex-col">
          {apps.map((a) => (
            <li key={a.pkg} className="flex items-center justify-between gap-2 py-1">
              <span className="text-sm">
                {a.label}
                <span className="text-muted">
                  {' '}
                  · {a.entertainment ? 'entertainment' : 'not limited'}
                </span>
              </span>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run({
                    type: a.entertainment ? 'screen.removeApp' : 'screen.addApp',
                    payload: { pkg: a.pkg },
                  }).then(() => loadScreen())
                }
              >
                {a.entertainment ? 'Remove' : 'Add'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

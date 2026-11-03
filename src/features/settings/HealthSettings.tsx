import { useEffect, useState } from 'react';
import { healthConnect } from '@/app/health';
import type { Settings } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { readHealthNow, useHealth } from '@/core/health/runner';
import { nowMs } from '@/core/time';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { Switch } from '@/ui/Switch';
import { Card } from './sections';
import { syncedAgo } from './syncText';

/**
 * Health Connect (SPEC 6.4, task 10.1): steps, sleep and workouts fill the Walk / Sleep /
 * Workout quests and the Body log automatically on Android. Manual entries always win.
 */
export function HealthSettings({ settings }: { settings: Settings }) {
  const availability = useHealth((s) => s.availability);
  const granted = useHealth((s) => s.granted);
  const lastReadAt = useHealth((s) => s.lastReadAt);
  const readError = useHealth((s) => s.error);
  const { run, busy, error } = useAction();
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    void readHealthNow(healthConnect); // refreshes availability / access when Settings opens
  }, []);

  const on = settings.health_connect_enabled && granted;

  async function connect() {
    setAsking(true);
    setRefused(false);
    try {
      const ok = await healthConnect.requestAccess();
      if (!ok) {
        setRefused(true);
        return;
      }
      if (await run({ type: 'settings.update', payload: { health_connect_enabled: true } })) {
        await readHealthNow(healthConnect);
      }
    } catch (e) {
      logError(e, 'health.connect');
      setRefused(true);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Card title="Health Connect">
      {availability === 'unsupported' && (
        <p className="text-muted text-sm">
          Steps, sleep and workouts are read by the Android app from Health Connect. On this device
          they arrive through sync; you can always type them in.
        </p>
      )}
      {availability === 'not_installed' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Health Connect isn’t set up on this phone yet. Install or update it from the Play Store,
            then come back here.
          </p>
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => void healthConnect.openSettings().catch(() => undefined)}
          >
            Open Health Connect
          </Button>
        </div>
      )}
      {availability === 'available' && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium" id="health-label">
                Read steps, sleep and workouts
              </p>
              <p className="text-muted text-sm">
                Fills your Walk, Sleep and Workout quests and the Body log when ASCEND opens and
                every 15 minutes while it’s open. A number you type yourself always wins. ASCEND
                only reads — it never writes to Health Connect.
              </p>
            </div>
            {on ? (
              <Switch
                on
                labelledBy="health-label"
                disabled={busy}
                onChange={() =>
                  void run({ type: 'settings.update', payload: { health_connect_enabled: false } })
                }
              />
            ) : null}
          </div>
          {on ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted text-sm" role="status">
                {lastReadAt ? `Read ${syncedAgo(lastReadAt, nowMs())}.` : 'Reading…'}
              </p>
              <Button variant="secondary" onClick={() => void readHealthNow(healthConnect)}>
                Read now
              </Button>
              <Button
                variant="ghost"
                onClick={() => void healthConnect.openSettings().catch(() => undefined)}
              >
                Manage access
              </Button>
            </div>
          ) : (
            <Button className="self-start" disabled={asking || busy} onClick={() => void connect()}>
              Connect Health Connect
            </Button>
          )}
          {refused && (
            <p role="alert" className="text-warning-text text-sm">
              Health Connect didn’t allow all three (steps, sleep, workouts). Try again, or allow
              them in Health Connect → App permissions → ASCEND.
            </p>
          )}
          {on && readError && <p className="text-warning-text text-sm">{readError}</p>}
        </>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { Wrench, X } from 'lucide-react';
import { db as appDb, type AscendDB } from '@/core/db';
import {
  currentTimeZone,
  dayOf,
  getClockOffset,
  getTimeZoneOverride,
  instantAt,
  now,
  resetClock,
  setClockOffset,
  setNow,
  setTimeZoneOverride,
} from '@/core/time';
import { clearDevClock, saveDevClock } from './devClock';
import { GenerateData } from './GenerateData';

const DAY_MS = 86_400_000;
const ZONES = ['', 'Asia/Kolkata', 'Europe/Berlin', 'UTC', 'America/New_York', 'Pacific/Auckland'];

/** Formats an instant for <input type="datetime-local"> in the app's current timezone. */
function toLocalInput(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  return parts.replace(' ', 'T');
}

/**
 * Developer-only panel (SPEC 0.10). Never part of production builds: main.tsx imports it
 * only when `import.meta.env.DEV` is true, so the bundler drops it entirely.
 */
export function DevTools({
  db = appDb,
  reload = () => window.location.reload(),
}: {
  db?: AscendDB;
  reload?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dayStartHour, setDayStartHour] = useState(3);
  const [jumpText, setJumpText] = useState('1');
  const jumpDays = Math.min(3650, Math.max(1, Math.floor(Number(jumpText)) || 1));
  const [confirmReset, setConfirmReset] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    void db.settings.get('settings').then((s) => s && setDayStartHour(s.day_start_hour));
  }, [db]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  const tz = currentTimeZone();
  const current = now();

  function apply(change: () => void) {
    change();
    saveDevClock();
    reload();
  }

  async function resetAllData() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    db.close();
    await db.delete();
    resetClock();
    clearDevClock();
    reload();
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open developer tools"
        onClick={() => setOpen(true)}
        className="bg-warning text-bg fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 z-50 flex size-11 items-center justify-center rounded-full lg:bottom-4"
      >
        <Wrench aria-hidden size={20} />
      </button>
    );
  }

  return (
    <section
      aria-label="Developer tools"
      className="border-warning bg-surface shadow-overlay fixed inset-x-3 bottom-3 z-50 flex max-h-[80dvh] flex-col gap-3 overflow-y-auto rounded-lg border-2 p-4 text-sm sm:right-auto sm:w-96"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-warning-text font-semibold">Developer tools</h2>
        <button
          type="button"
          aria-label="Close developer tools"
          onClick={() => setOpen(false)}
          className="text-muted p-2"
        >
          <X aria-hidden size={18} />
        </button>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
        <dt className="text-muted">App time</dt>
        <dd data-testid="dev-now">{toLocalInput(current, tz).replace('T', ' ')}</dd>
        <dt className="text-muted">App day</dt>
        <dd data-testid="dev-day">{dayOf(current, tz, dayStartHour)}</dd>
        <dt className="text-muted">Timezone</dt>
        <dd>
          {tz}
          {getTimeZoneOverride() ? ' (override)' : ''}
        </dd>
        <dt className="text-muted">Offset</dt>
        <dd>{(getClockOffset() / DAY_MS).toFixed(2)} days</dd>
      </dl>

      <label className="flex flex-col gap-1">
        <span className="text-muted">Set date and time</span>
        <input
          type="datetime-local"
          aria-label="Set date and time"
          defaultValue={toLocalInput(current, tz)}
          className="border-border bg-surface-2 min-h-11 rounded-md border px-2"
          onChange={(e) => {
            if (!e.target.value) return;
            // Interpret the typed wall time in the app's timezone.
            const [date = '', time = ''] = e.target.value.split('T');
            apply(() => setNow(instantAt(date, time, tz)));
          }}
        />
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          className="border-border min-h-11 rounded-md border px-3"
          onClick={() => apply(() => setClockOffset(getClockOffset() + DAY_MS))}
        >
          +1 day
        </button>
        <button
          type="button"
          className="border-border min-h-11 rounded-md border px-3"
          onClick={() => apply(() => setClockOffset(getClockOffset() + 7 * DAY_MS))}
        >
          +7 days
        </button>
        <label className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={3650}
            aria-label="Days to jump"
            value={jumpText}
            onChange={(e) => setJumpText(e.target.value)}
            className="border-border bg-surface-2 min-h-11 w-20 rounded-md border px-2"
          />
          <button
            type="button"
            className="border-border min-h-11 rounded-md border px-3"
            onClick={() => apply(() => setClockOffset(getClockOffset() + jumpDays * DAY_MS))}
          >
            Jump
          </button>
        </label>
        <button
          type="button"
          className="border-border min-h-11 rounded-md border px-3"
          onClick={() => apply(() => setClockOffset(0))}
        >
          Real time
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-muted">Timezone override</span>
        <select
          aria-label="Timezone override"
          value={getTimeZoneOverride() ?? ''}
          onChange={(e) => apply(() => setTimeZoneOverride(e.target.value || null))}
          className="border-border bg-surface-2 min-h-11 rounded-md border px-2"
        >
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {z || 'Device timezone'}
            </option>
          ))}
        </select>
      </label>

      <GenerateData db={db} reload={reload} />

      <button
        type="button"
        onClick={() => void resetAllData()}
        className="bg-error text-bg min-h-11 rounded-md px-3 font-medium"
      >
        {confirmReset ? 'Tap again to delete ALL data' : 'Reset all data'}
      </button>
    </section>
  );
}

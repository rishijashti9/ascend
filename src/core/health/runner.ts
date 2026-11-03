import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { getSettings, recordAction } from '@/core/pipeline';
import { addDays, currentTimeZone, dayOf, instantAt, nowMs } from '@/core/time';
import { sleepHoursFor, workoutMinutesFor, type DayReading } from './readings';
import type { HealthAvailability, HealthSource } from './source';

/**
 * Reads Health Connect when the app opens, comes back to the front, and every 15 minutes while
 * it's open (task 10.1; the plugin has no background job). Today and yesterday are read —
 * yesterday's final steps or a late sleep entry still count for yesterday (SPEC 4.8).
 */
export const READ_EVERY_MS = 15 * 60_000;

export interface HealthState {
  availability: HealthAvailability | 'checking';
  granted: boolean;
  lastReadAt: number | null;
  error: string | null;
}

export const healthStore = createStore<HealthState>(() => ({
  availability: 'checking',
  granted: false,
  lastReadAt: null,
  error: null,
}));

export function useHealth<T>(selector: (s: HealthState) => T): T {
  return useStore(healthStore, selector);
}

/** One app day's readings from the source. */
export async function readDay(
  source: HealthSource,
  day: string,
  dayStartHour: number,
  tz: string,
  now: number,
): Promise<DayReading & { at: string }> {
  const hh = `${String(dayStartHour).padStart(2, '0')}:00`;
  const start = instantAt(day, hh, tz);
  const next = instantAt(addDays(day, 1), hh, tz);
  const until = Math.min(now, next);
  // Sleep that ends this day may have started the evening before.
  const [steps, sleep, workouts] = await Promise.all([
    source.steps(start, until),
    source.sleep(start - 18 * 3_600_000, until),
    source.workouts(start, until),
  ]);
  return {
    day,
    at: new Date(Math.min(now, next - 60_000)).toISOString(),
    steps,
    sleepHours: sleepHoursFor(sleep, start, next),
    workoutMinutes: workoutMinutesFor(workouts, start, next),
  };
}

/** Checks access and, when switched on and allowed, reads and applies today + yesterday. */
export async function readHealthNow(
  source: HealthSource,
  database: AscendDB = defaultDb,
): Promise<void> {
  try {
    const availability = await source.availability();
    const granted = availability === 'available' && (await source.granted());
    healthStore.setState({ availability, granted });
    const settings = await getSettings(database);
    const onboarded = (await database.profile.get('profile'))?.onboarded_at;
    if (!settings.health_connect_enabled || !granted || !onboarded) return;
    const tz = currentTimeZone();
    const now = nowMs();
    const today = dayOf(now, tz, settings.day_start_hour);
    const readings = [];
    for (const day of [addDays(today, -1), today]) {
      readings.push(await readDay(source, day, settings.day_start_hour, tz, now));
    }
    await recordAction(
      { type: 'health.apply', source: 'health', payload: { readings } },
      {
        db: database,
      },
    );
    healthStore.setState({ lastReadAt: now, error: null });
  } catch (error) {
    logError(error, 'health.read');
    healthStore.setState({ error: 'Couldn’t read Health Connect just now — it tries again soon.' });
  }
}

/** Starts reading at startup, on resume and every 15 minutes. Returns a stop function. */
export function startHealthReader(
  source: HealthSource,
  onResume: (listener: () => void) => () => void,
  database: AscendDB = defaultDb,
): () => void {
  void readHealthNow(source, database);
  const timer = setInterval(() => void readHealthNow(source, database), READ_EVERY_MS);
  const stopResume = onResume(() => void readHealthNow(source, database));
  return () => {
    clearInterval(timer);
    stopResume();
  };
}

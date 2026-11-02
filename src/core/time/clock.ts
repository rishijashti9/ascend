/**
 * The app's single source of "now" and "which timezone".
 * Never call `new Date()` / `Date.now()` for app logic: use `now()` so the
 * developer tools can travel in time, and tests can control it.
 */

let offsetMs = 0;
let timeZoneOverride: string | null = null;

/** Current instant, shifted by the dev-tools offset (0 in normal use). */
export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

export function nowMs(): number {
  return Date.now() + offsetMs;
}

/** The device's current IANA timezone (e.g. "Asia/Kolkata"), unless overridden for testing. */
export function currentTimeZone(): string {
  return timeZoneOverride ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ---- Developer / test controls (never used by normal app code) ----

export function getClockOffset(): number {
  return offsetMs;
}

export function setClockOffset(ms: number): void {
  offsetMs = ms;
}

/** Makes `now()` return exactly this instant (keeps ticking from there). */
export function setNow(instant: Date | number): void {
  offsetMs = (typeof instant === 'number' ? instant : instant.getTime()) - Date.now();
}

export function setTimeZoneOverride(tz: string | null): void {
  if (tz !== null && !isValidTimeZone(tz)) throw new Error(`Unknown timezone: ${tz}`);
  timeZoneOverride = tz;
}

export function getTimeZoneOverride(): string | null {
  return timeZoneOverride;
}

export function resetClock(): void {
  offsetMs = 0;
  timeZoneOverride = null;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

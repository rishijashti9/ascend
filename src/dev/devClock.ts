import {
  getClockOffset,
  getTimeZoneOverride,
  setClockOffset,
  setTimeZoneOverride,
} from '@/core/time';

/** Dev-only: the time-travel state survives reloads so "open the app later" can be tested. */
const KEY = 'ascend.dev.clock';

interface DevClockState {
  offsetMs: number;
  timeZone: string | null;
}

export function restoreDevClock(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const state = JSON.parse(raw) as DevClockState;
    setClockOffset(Number(state.offsetMs) || 0);
    setTimeZoneOverride(state.timeZone ?? null);
  } catch {
    localStorage.removeItem(KEY);
  }
}

export function saveDevClock(): void {
  const state: DevClockState = { offsetMs: getClockOffset(), timeZone: getTimeZoneOverride() };
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearDevClock(): void {
  localStorage.removeItem(KEY);
}

import { localParts, parseTime } from '@/core/time';
import { formatMinutes } from './observe';

/**
 * Screen-time reminders (SPEC 6.8) — pure rules. The Android foreground service mirrors these
 * (ScreenTimeService.java); the app uses them for the status card and to plan the service.
 *
 * Only on entertainment apps, only in two cases: over the daily limit, or after the wind-down
 * time (until the day-start hour). A first gentle notification, then a re-alert every minute
 * while an entertainment app stays in front — one notification, updated. "I'm on a break"
 * pauses for 20 minutes, at most twice a day. In quiet hours the updates are silent.
 */
export const REALERT_MS = 60_000;
export const BREAK_MS = 20 * 60_000;
export const MAX_BREAKS_PER_DAY = 2;

export type ReminderCase = 'over_limit' | 'wind_down';

export interface ReminderInput {
  nowMs: number;
  tz: string;
  dayStartHour: number;
  /** Wind-down time "HH:MM" (the evening wind-down setting). */
  windDown: string;
  quietHours: { start: string; end: string } | null;
  /** Today's entertainment seconds so far. */
  entertainmentSec: number;
  limitMin: number | null;
  remindersOn: boolean;
  /** A break is running until this instant. */
  breakUntilMs: number | null;
}

/** Minutes after local midnight. */
function localMinutes(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  return p.hour * 60 + p.minute;
}

/** Is a local time inside a window that may run past midnight? */
export function inWindow(minutes: number, start: number, end: number): boolean {
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export function isWindDown(
  nowMs: number,
  tz: string,
  windDown: string,
  dayStartHour: number,
): boolean {
  const m = localMinutes(nowMs, tz);
  return inWindow(m, parseTime(windDown), dayStartHour * 60);
}

export function inQuietHours(
  nowMs: number,
  tz: string,
  quiet: ReminderInput['quietHours'],
): boolean {
  if (!quiet) return false;
  return inWindow(localMinutes(nowMs, tz), parseTime(quiet.start), parseTime(quiet.end));
}

/**
 * Which reminder case applies right now, ignoring what's on screen (the service is "armed" while
 * this is not null). Over the limit wins over wind-down.
 */
export function activeCase(i: ReminderInput): ReminderCase | null {
  if (!i.remindersOn) return null;
  if (i.breakUntilMs !== null && i.nowMs < i.breakUntilMs) return null;
  if (i.limitMin !== null && i.entertainmentSec >= i.limitMin * 60) return 'over_limit';
  if (isWindDown(i.nowMs, i.tz, i.windDown, i.dayStartHour)) return 'wind_down';
  return null;
}

/**
 * When the service should next wake up while no case is active: the wind-down time, or the
 * earliest moment the remaining allowance could run out (it only runs out while entertainment
 * is on screen), whichever comes first. Null = nothing to wait for today.
 */
export function nextCheckMs(i: ReminderInput, windDownStartMs: number): number | null {
  if (!i.remindersOn) return null;
  const candidates: number[] = [];
  if (i.breakUntilMs !== null && i.nowMs < i.breakUntilMs) candidates.push(i.breakUntilMs);
  if (windDownStartMs > i.nowMs) candidates.push(windDownStartMs);
  if (i.limitMin !== null) {
    const remainingMs = (i.limitMin * 60 - i.entertainmentSec) * 1000;
    if (remainingMs > 0) candidates.push(i.nowMs + remainingMs);
  }
  return candidates.length ? Math.min(...candidates) : null;
}

/** May another break start today? */
export function canTakeBreak(breaksToday: number): boolean {
  return breaksToday < MAX_BREAKS_PER_DAY;
}

export interface ReminderState {
  /** When the current stretch on entertainment began (first notification), or null. */
  stretchStartMs: number | null;
  /** When the notification was last shown or updated. */
  lastAlertMs: number | null;
}

export interface ReminderStep {
  state: ReminderState;
  /** Show/update the notification now. */
  alert: boolean;
  /** First notification of a stretch (gentler wording). */
  first: boolean;
  /** Silent update (quiet hours). */
  silent: boolean;
  /** Remove the notification (left the app, or no case active). */
  clear: boolean;
}

/**
 * One check of the service (every minute while armed): what to do given what's in front.
 */
export function reminderStep(
  i: ReminderInput,
  onEntertainment: boolean,
  state: ReminderState,
): ReminderStep {
  const c = activeCase(i);
  if (!c || !onEntertainment) {
    const had = state.stretchStartMs !== null;
    return {
      state: { stretchStartMs: null, lastAlertMs: null },
      alert: false,
      first: false,
      silent: false,
      clear: had,
    };
  }
  const silent = inQuietHours(i.nowMs, i.tz, i.quietHours);
  if (state.stretchStartMs === null) {
    return {
      state: { stretchStartMs: i.nowMs, lastAlertMs: i.nowMs },
      alert: true,
      first: true,
      silent,
      clear: false,
    };
  }
  // Re-alert once the interval has passed (a little slack for timer drift).
  const due = state.lastAlertMs === null || i.nowMs - state.lastAlertMs >= REALERT_MS - 2_000;
  return {
    state: { ...state, lastAlertMs: due ? i.nowMs : state.lastAlertMs },
    alert: due,
    first: false,
    silent,
    clear: false,
  };
}

/** Calm, never shaming. `appName` is what's on screen; `stretchMin` = minutes on it so far. */
export function reminderText(
  c: ReminderCase,
  opts: { appName: string; first: boolean; stretchMin: number; overMin: number; windDown: string },
): { title: string; body: string } {
  if (c === 'over_limit') {
    if (opts.first)
      return {
        title: 'You’ve reached today’s entertainment limit',
        body: `${opts.appName} is still open. A good moment to switch to something else?`,
      };
    return {
      title: `${formatMinutes(opts.stretchMin)} on ${opts.appName}`,
      body: `${formatMinutes(opts.overMin)} past today’s limit. Ready to switch?`,
    };
  }
  if (opts.first)
    return {
      title: 'It’s wind-down time',
      body: `It’s past ${opts.windDown}. Putting ${opts.appName} away now protects tomorrow’s early start.`,
    };
  return {
    title: `${formatMinutes(opts.stretchMin)} on ${opts.appName}`,
    body: `Wind-down started at ${opts.windDown}. Sleep is what makes the morning easy.`,
  };
}

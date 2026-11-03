import type { BaseRecord, DayString, IsoTime } from './common';

/**
 * Phase 11 — Screen Time (SPEC 6.8). Phone only. Only daily totals per app are ever stored —
 * never what happened inside an app. Synced to the user's own account, never sent to any AI.
 */

/**
 * One device's screen time for one ASCEND day. id = `<device id>:<day>`, so each device only
 * ever writes its own records (the latest reading of the day replaces the earlier one).
 */
export interface ScreenDay extends BaseRecord {
  device_id: string;
  day: DayString;
  /** Seconds in the foreground per app (Android package name). */
  apps: Record<string, number>;
  /** Of those, seconds inside focus sessions (YouTube doesn't count then — SPEC 6.8). */
  focus: Record<string, number>;
  /** App names for display (package → label), only for apps in `apps`. */
  labels: Record<string, string>;
  /** Packages Android marks as games (they count as entertainment). */
  games: string[];
}

/** Rule values a lock protects (SPEC 6.8 "Lock"). */
export interface ScreenRuleValues {
  /** Reminders on (tracking stays on while screen time is switched on). */
  reminders: boolean;
  /** Daily entertainment limit in minutes; null until the first suggestion is accepted. */
  limit_min: number | null;
  /** Apps added to the built-in entertainment list. */
  added_apps: string[];
  /** Built-in (or added) apps taken off the list. */
  removed_apps: string[];
}

/**
 * The screen-time rules (singleton, id `screen_rules`). Looser changes made during a lock wait
 * in `pending` and apply when the lock ends (shown with that date).
 */
export interface ScreenRules extends BaseRecord, ScreenRuleValues {
  /** Screen time switched on (Settings → Screen time). Off by default. */
  enabled: boolean;
  /** First day of the observe week (the day screen time was first switched on). */
  observe_start_day: DayString | null;
  /** Looser values waiting for the lock to end (only the fields that changed). */
  pending: Partial<ScreenRuleValues & { enabled: boolean }> | null;
}

/**
 * The lock (singleton, id `screen_lock`). Its end only ever moves later: accepting or changing
 * the limit sets it to at least now + 1 week (or 1 month), and each incident adds 7 days.
 * Sync and import keep the later end, so neither can shorten it.
 */
export interface ScreenLock extends BaseRecord {
  started_at: IsoTime;
  end_at: IsoTime;
}

export type ScreenEventKind = 'break' | 'incident';

/** Why a lock was extended (SPEC 6.8): something that stops the reminders was switched off. */
export type IncidentKind = 'notifications_off' | 'channel_off' | 'usage_access_off';

/**
 * A break ("I'm on a break": 20 min, max 2 a day) or an incident (+7 days on the lock, a banner
 * on Today until fixed).
 */
export interface ScreenEvent extends BaseRecord {
  kind: ScreenEventKind;
  day: DayString;
  at: IsoTime;
  /** Incidents only. */
  incident?: IncidentKind;
  /** Incidents only: when it was fixed (the banner hides), or null while still broken. */
  resolved_at?: IsoTime | null;
}

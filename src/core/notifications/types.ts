import type { DayString } from '@/core/db/types';

/**
 * Notifications (SPEC 6 "Notifications", 8 platform notes). The planner decides WHAT to remind
 * and WHEN (pure); a Notifier delivers it on the platform (Android: scheduled a week ahead;
 * web: while ASCEND is open). Everything is recomputed from data, never stored.
 */
export type NotificationKind =
  | 'wake'
  | 'briefing'
  | 'reminder'
  | 'winddown'
  | 'welcome_back'
  | 'job_followup'
  | 'widget'
  | 'test';

export interface PlannedNotification {
  /** Stable key, e.g. `wake:2026-11-03` — the same reminder always gets the same key. */
  key: string;
  kind: NotificationKind;
  /** When to show it (epoch ms). */
  at: number;
  /** The app day it belongs to. */
  day: DayString;
  title: string;
  body: string;
  /** Screen to open when tapped. */
  path: string;
  /** The wake-up check-in carries an "I'm up" button that completes this quest instance. */
  wakeInstanceId?: string;
}

/** A tap on a notification (or its "I'm up" button), with the real time of the tap. */
export interface NotificationTap {
  key: string;
  kind: NotificationKind;
  day: DayString;
  path: string;
  wakeInstanceId: string | null;
  /** True when the "I'm up" button itself was tapped (not just the notification). */
  wakeUp: boolean;
  /** Tap time (epoch ms) — what counts for the wake-up check-in (SPEC 7). */
  at: number;
}

export type NotifyPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

/** Android 12+ "Alarms & reminders": without it, Android may deliver a reminder late. */
export type ExactAlarms = 'granted' | 'denied' | 'unsupported';

export interface Notifier {
  readonly platform: 'android' | 'browser';
  permission(): Promise<NotifyPermission>;
  requestPermission(): Promise<NotifyPermission>;
  /** Replace everything ASCEND has scheduled with this list (past ones are ignored). */
  sync(list: readonly PlannedNotification[]): Promise<void>;
  /** Show one now — or at `n.at` if that's in the future (the Settings tests). Never cancelled by sync. */
  showNow(n: PlannedNotification): Promise<void>;
  /** Whether reminders can fire at the exact minute (Android 12+). */
  exactAlarms(): Promise<ExactAlarms>;
  /** Opens the system screen to allow exact alarms; returns the state afterwards. */
  openExactAlarmSettings(): Promise<ExactAlarms>;
  /** Listen for taps. Returns an unsubscribe function. */
  onTap(handler: (tap: NotificationTap) => void): () => void;
}

/**
 * The phone's side of screen time (Android, tasks 11.6–11.8). `app/screenTime.ts` talks to the
 * Java plugin; tests use a fake. Off Android everything reports "not available".
 */
export interface ScreenStatus {
  /** Android "Usage access" granted to ASCEND. */
  usageAccess: boolean;
  /** ASCEND's notifications allowed at all. */
  notifications: boolean;
  /** The screen-time reminder channel isn't switched off. */
  channel: boolean;
}

export interface UsageTotals {
  /** Seconds per app (package name). */
  apps: Record<string, number>;
  labels: Record<string, string>;
  games: string[];
}

export interface ScreenBridge {
  available(): boolean;
  status(): Promise<ScreenStatus>;
  openUsageAccess(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  /** Totals between two instants (ms). Rejects without Usage access. */
  totals(start: number, end: number): Promise<UsageTotals>;
  /** Hands the rules to the phone's reminder service (JSON from snapshot.ts). */
  setRules(json: string): Promise<void>;
}

export const NO_SCREEN_BRIDGE: ScreenBridge = {
  available: () => false,
  status: () => Promise.resolve({ usageAccess: false, notifications: false, channel: false }),
  openUsageAccess: () => Promise.resolve(),
  openNotificationSettings: () => Promise.resolve(),
  totals: () => Promise.reject(new Error('Screen time is only available in the Android app')),
  setRules: () => Promise.resolve(),
};

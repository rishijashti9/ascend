import { registerPlugin } from '@capacitor/core';
import type { ScreenBridge, ScreenStatus, UsageTotals } from '@/core/screentime/bridge';
import { NO_SCREEN_BRIDGE } from '@/core/screentime/bridge';
import { isNativeApp } from './platform';

/** The Java plugin in android/…/ScreenTimePlugin.java (Phase 11). */
interface NativeScreenTime {
  status(): Promise<ScreenStatus>;
  openUsageAccess(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  totals(options: { start: number; end: number }): Promise<UsageTotals>;
  setRules(options: { json: string }): Promise<void>;
}

const Native = registerPlugin<NativeScreenTime>('ScreenTime');

/** Android: the real plugin. Elsewhere: screen time isn't available (phone only, SPEC 6.8). */
export const screenBridge: ScreenBridge = isNativeApp()
  ? {
      available: () => true,
      status: () => Native.status(),
      openUsageAccess: () => Native.openUsageAccess(),
      openNotificationSettings: () => Native.openNotificationSettings(),
      totals: (start, end) => Native.totals({ start, end }),
      setRules: (json) => Native.setRules({ json }),
    }
  : NO_SCREEN_BRIDGE;

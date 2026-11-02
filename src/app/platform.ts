import { Capacitor } from '@capacitor/core';

/** True inside the Android app (Capacitor), false in a browser or installed PWA. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

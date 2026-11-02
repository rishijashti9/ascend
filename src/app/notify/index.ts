import type { Notifier } from '@/core/notifications/types';
import { appStore } from '@/core/state/app';
import { isNativeApp } from '../platform';
import { createAndroidNotifier } from './android';
import { createBrowserNotifier } from './browser';

/** The notifier for this platform: Android local notifications, or in-app / browser. */
let notifier: Notifier | null = null;

export function getNotifier(): Notifier {
  notifier ??= isNativeApp()
    ? createAndroidNotifier()
    : createBrowserNotifier(
        () => appStore.getState().settings?.notifications.browser_notifications ?? false,
      );
  return notifier;
}

/** Tests: use a fake notifier (or reset with null). */
export function setNotifier(n: Notifier | null): void {
  notifier = n;
}

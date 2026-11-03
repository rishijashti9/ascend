import { registerPlugin } from '@capacitor/core';
import type { PendingTap, WidgetBridge } from '@/core/widget/bridge';
import { isNativeApp } from './platform';

/** The Java plugin in android/…/WidgetBridgePlugin.java (task 10.2). */
interface NativeWidgetBridge {
  setSnapshot(options: { json: string }): Promise<void>;
  peekPending(): Promise<{ taps: string }>;
  removePending(options: { ids: string[] }): Promise<void>;
}

const Native = registerPlugin<NativeWidgetBridge>('WidgetBridge');

/** Android: the real widgets. Elsewhere: does nothing (there are no widgets on the web). */
export const widgetBridge: WidgetBridge = {
  async setSnapshot(json) {
    if (isNativeApp()) await Native.setSnapshot({ json });
  },
  async peekPending() {
    if (!isNativeApp()) return [];
    const { taps } = await Native.peekPending();
    const parsed: unknown = JSON.parse(taps || '[]');
    return Array.isArray(parsed) ? (parsed as PendingTap[]) : [];
  },
  async removePending(ids) {
    if (isNativeApp() && ids.length > 0) await Native.removePending({ ids });
  },
};

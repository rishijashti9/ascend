/**
 * The native side of the widgets (Android, task 10.2–10.3): it keeps the snapshot the widgets
 * draw and a queue of taps made on them. app/widgetBridge.ts talks to the Java plugin; tests
 * use a fake.
 */
export interface PendingTap {
  /** Made on the phone when tapped; also the action id, so a tap never counts twice. */
  id: string;
  type: string;
  payload: unknown;
  /** The real tap time (what counts, SPEC 6.4). */
  occurred_at: string;
}

export interface WidgetBridge {
  setSnapshot(json: string): Promise<void>;
  peekPending(): Promise<PendingTap[]>;
  removePending(ids: string[]): Promise<void>;
}

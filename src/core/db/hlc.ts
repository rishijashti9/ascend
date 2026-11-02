import { nowMs } from '@/core/time';

/**
 * Hybrid logical clock (HLC) for last-write-wins sync (SPEC 9).
 * Format: `<15-digit ms>-<4-char counter>-<device id>`, so plain string comparison
 * orders writes correctly, and a phone with a wrong clock can't jump ahead forever
 * (Phase 7 also folds in the server-received time).
 */

const DEVICE_KEY = 'ascend.deviceId';

let lastMs = 0;
let counter = 0;
let deviceId: string | null = null;

export function getDeviceId(): string {
  if (deviceId) return deviceId;
  let id: string;
  try {
    id = localStorage.getItem(DEVICE_KEY) ?? crypto.randomUUID().slice(0, 8);
    localStorage.setItem(DEVICE_KEY, id);
  } catch {
    // Storage blocked: use a per-session id (still unique enough for ordering).
    id = crypto.randomUUID().slice(0, 8);
  }
  deviceId = id;
  return id;
}

function format(ms: number, count: number): string {
  return `${String(ms).padStart(15, '0')}-${count.toString(36).padStart(4, '0')}-${getDeviceId()}`;
}

export function parseHlc(hlc: string): { ms: number; counter: number; device: string } {
  const [ms, count, device] = hlc.split('-');
  return { ms: Number(ms), counter: parseInt(count ?? '0', 36), device: device ?? '' };
}

/** A new timestamp for a local write: always greater than any previous one on this device. */
export function nextHlc(): string {
  const physical = nowMs();
  if (physical > lastMs) {
    lastMs = physical;
    counter = 0;
  } else {
    counter += 1;
  }
  return format(lastMs, counter);
}

/** Merge a timestamp seen from another device (sync), so later local writes sort after it. */
export function observeHlc(remote: string): void {
  const r = parseHlc(remote);
  const physical = nowMs();
  const maxMs = Math.max(lastMs, r.ms, physical);
  if (maxMs === lastMs && maxMs === r.ms) counter = Math.max(counter, r.counter) + 1;
  else if (maxMs === lastMs) counter += 1;
  else if (maxMs === r.ms) counter = r.counter + 1;
  else counter = 0;
  lastMs = maxMs;
}

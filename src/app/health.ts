import { Health } from '@capgo/capacitor-health';
import type { HealthSource } from '@/core/health/source';
import { isNativeApp } from './platform';

/**
 * Health Connect on Android (task 10.1) through `@capgo/capacitor-health` 8.11.12. Read only:
 * steps, sleep and workouts. Everything here is a thin wrapper — the rules live in
 * core/health (pure, tested). In a browser nothing is available.
 */
const READ = ['steps', 'sleep', 'workouts'] as const;

const iso = (ms: number) => new Date(ms).toISOString();

export const healthConnect: HealthSource = {
  async availability() {
    if (!isNativeApp()) return 'unsupported';
    try {
      const r = await Health.isAvailable();
      if (r.available) return 'available';
      return /install|update|provider/i.test(r.reason ?? '') ? 'not_installed' : 'unsupported';
    } catch {
      return 'unsupported';
    }
  },
  async granted() {
    try {
      const s = await Health.checkAuthorization({ read: [...READ] });
      return READ.every((t) => s.readAuthorized.includes(t));
    } catch {
      return false;
    }
  },
  async requestAccess() {
    const s = await Health.requestAuthorization({ read: [...READ] });
    return READ.every((t) => s.readAuthorized.includes(t));
  },
  async openSettings() {
    await Health.openHealthConnectSettings();
  },
  async steps(fromMs, toMs) {
    if (toMs <= fromMs) return null;
    const r = await Health.queryAggregated({
      dataType: 'steps',
      startDate: iso(fromMs),
      endDate: iso(toMs),
      bucket: 'month',
      aggregation: 'sum',
    });
    if (r.samples.length === 0) return null;
    return Math.round(r.samples.reduce((t, s) => t + (s.value || 0), 0));
  },
  async sleep(fromMs, toMs) {
    const r = await Health.readSamples({
      dataType: 'sleep',
      startDate: iso(fromMs),
      endDate: iso(toMs),
      limit: 200,
      ascending: true,
    });
    return r.samples;
  },
  async workouts(fromMs, toMs) {
    const r = await Health.queryWorkouts({
      startDate: iso(fromMs),
      endDate: iso(toMs),
      limit: 100,
      ascending: true,
    });
    return r.workouts;
  },
};

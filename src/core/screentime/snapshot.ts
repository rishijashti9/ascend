import type { AscendDB } from '@/core/db/db';
import type { ScreenRules, Settings } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { getSettings, subscribeAll } from '@/core/pipeline';
import { currentTimeZone, dayOf, nowMs } from '@/core/time';
import { ENTERTAINMENT_APPS, YOUTUBE_PACKAGES } from '@/data/entertainmentApps';
import type { ScreenBridge } from './bridge';
import { BREAK_MS } from './reminders';
import { getRules } from './store';

/**
 * The rules handed to the phone's reminder service (task 11.7) — read by ScreenLogic.java while
 * ASCEND itself isn't running. Written after every change that matters (rules, settings, focus
 * sessions, breaks) and at startup. No usage data in it — only the rules.
 */
export interface ScreenSnapshot {
  enabled: boolean;
  remindersOn: boolean;
  limitMin: number | null;
  windDown: string;
  dayStartHour: number;
  tz: string;
  quiet: { start: string; end: string } | null;
  /** Entertainment packages (built-in + added, minus removed). */
  packages: string[];
  /** Built-in app names (lower case) for apps under another package. */
  labels: string[];
  removed: string[];
  youtube: string[];
  /** A focus session running now: YouTube doesn't count inside it. */
  focusStartMs: number;
  focusUntilMs: number;
  /** YouTube seconds inside today's finished focus sessions. */
  youtubeFocusSec: number;
  breaksDay: string;
  breaksCount: number;
  breakUntilMs: number;
}

export interface SnapshotInputs {
  rules: ScreenRules | undefined;
  settings: Pick<Settings, 'day_start_hour' | 'quiet_hours' | 'notifications'>;
  tz: string;
  focus: { startMs: number; untilMs: number } | null;
  youtubeFocusSec: number;
  breaks: { day: string; count: number; lastAtMs: number | null };
}

export function buildSnapshot(i: SnapshotInputs): ScreenSnapshot {
  const r = i.rules;
  const removed = r?.removed_apps ?? [];
  const builtIn = ENTERTAINMENT_APPS.flatMap((a) => a.packages);
  const packages = [...new Set([...builtIn, ...(r?.added_apps ?? [])])].filter(
    (p) => !removed.includes(p),
  );
  return {
    enabled: r?.enabled ?? false,
    remindersOn: r?.reminders ?? false,
    limitMin: r?.limit_min ?? null,
    windDown: i.settings.notifications.evening_time,
    dayStartHour: i.settings.day_start_hour,
    tz: i.tz,
    quiet: i.settings.quiet_hours,
    packages,
    labels: ENTERTAINMENT_APPS.flatMap((a) => a.labels),
    removed,
    youtube: [...YOUTUBE_PACKAGES],
    focusStartMs: i.focus?.startMs ?? 0,
    focusUntilMs: i.focus?.untilMs ?? 0,
    youtubeFocusSec: i.youtubeFocusSec,
    breaksDay: i.breaks.day,
    breaksCount: i.breaks.count,
    breakUntilMs: i.breaks.lastAtMs === null ? 0 : i.breaks.lastAtMs + BREAK_MS,
  };
}

/** Reads everything the snapshot needs from the database. */
export async function snapshotFromDb(db: AscendDB): Promise<ScreenSnapshot> {
  const settings = await getSettings(db);
  const tz = currentTimeZone();
  const now = nowMs();
  const day = dayOf(now, tz, settings.day_start_hour);
  const breaks = (await db.screen_events.where('day').equals(day).toArray()).filter(
    (e) => e.kind === 'break' && !e.deleted_at,
  );
  const lastBreak = breaks.reduce<number | null>(
    (m, e) => Math.max(m ?? 0, Date.parse(e.at)),
    null,
  );
  const running = (await db.focus_sessions.where('day').equals(day).toArray()).find(
    (s) => !s.deleted_at && s.ended_at === null,
  );
  const focus = running
    ? {
        startMs: Date.parse(running.started_at),
        untilMs: Date.parse(running.started_at) + running.planned_min * 60_000 + 60_000,
      }
    : null;
  const today = (await db.screen_days.where('day').equals(day).toArray()).filter(
    (d) => !d.deleted_at,
  );
  const youtubeFocusSec = today.reduce(
    (s, d) => s + YOUTUBE_PACKAGES.reduce((a, p) => a + (d.focus[p] ?? 0), 0),
    0,
  );
  return buildSnapshot({
    rules: await getRules(db),
    settings,
    tz,
    focus,
    youtubeFocusSec,
    breaks: { day, count: breaks.length, lastAtMs: lastBreak },
  });
}

const RELEVANT = new Set([
  'ScreenTimeChanged',
  'SettingsChanged',
  'SessionStarted',
  'SessionFinished',
  'DataImported',
  'DataSynced',
  'DayClosed',
]);

/** Keeps the phone's copy of the rules current. Returns a stop function. */
export function startSnapshotWriter(bridge: ScreenBridge, db: AscendDB): () => void {
  if (!bridge.available()) return () => undefined;
  let last = '';
  const write = async () => {
    try {
      const json = JSON.stringify(await snapshotFromDb(db));
      if (json === last) return;
      last = json;
      await bridge.setRules(json);
    } catch (error) {
      logError(error, 'screen.snapshot');
    }
  };
  void write();
  return subscribeAll((event) => {
    if (RELEVANT.has(event.type)) void write();
  });
}

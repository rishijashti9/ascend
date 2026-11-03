import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { ScreenDay, ScreenEvent } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { getSettings, subscribeAll } from '@/core/pipeline';
import { combineDays, entertainmentSeconds, topApps, type AppUsage } from '@/core/screentime/apps';
import {
  observeState,
  observeWindow,
  suggestLimit,
  type LimitSuggestion,
  type ObserveState,
} from '@/core/screentime/observe';
import { MAX_BREAKS_PER_DAY } from '@/core/screentime/reminders';
import { getRules, lockStatus, rulesState, type ScreenState } from '@/core/screentime/store';
import { addDays, currentTimeZone, dayOf, nowMs, weekStartOf, type DayString } from '@/core/time';

/** What the Screen time card, screen and settings show (Phase 11). */
export interface ScreenView {
  status: 'loading' | 'ready';
  /** Null until screen time was first switched on. */
  rules: ScreenState | null;
  lock: { active: boolean; endMs: number | null };
  today: DayString;
  todaySec: number;
  todayTop: AppUsage[];
  /** This week (from the week start) per day, and in total. */
  week: { day: DayString; sec: number }[];
  weekSec: number;
  weekTop: AppUsage[];
  /** Every app seen in the last 3 weeks (for adding/removing entertainment apps). */
  weekApps: AppUsage[];
  /** Days that have any reading (phone off all day = none). */
  hasData: boolean;
  observe: ObserveState;
  suggestion: LimitSuggestion | null;
  /** Open incidents (the Today banner). */
  incidents: ScreenEvent[];
  breaksLeft: number;
}

const EMPTY: ScreenView = {
  status: 'loading',
  rules: null,
  lock: { active: false, endMs: null },
  today: '',
  todaySec: 0,
  todayTop: [],
  week: [],
  weekSec: 0,
  weekTop: [],
  weekApps: [],
  hasData: false,
  observe: { phase: 'off' },
  suggestion: null,
  incidents: [],
  breaksLeft: MAX_BREAKS_PER_DAY,
};

export const screenStore = createStore<ScreenView>(() => EMPTY);

export function useScreen<T>(selector: (s: ScreenView) => T): T {
  return useStore(screenStore, selector);
}

function byDay(days: ScreenDay[]): Map<DayString, ScreenDay[]> {
  const map = new Map<DayString, ScreenDay[]>();
  for (const d of days) {
    if (d.deleted_at) continue;
    map.set(d.day, [...(map.get(d.day) ?? []), d]);
  }
  return map;
}

export async function loadScreen(db: AscendDB = defaultDb): Promise<void> {
  try {
    const stored = await getRules(db);
    const settings = await getSettings(db);
    const today = dayOf(nowMs(), currentTimeZone(), settings.day_start_hour);
    if (!stored) {
      screenStore.setState({ ...EMPTY, status: 'ready', today });
      return;
    }
    const rules = rulesState(stored);
    const from = addDays(today, -21);
    const days = byDay(
      await db.screen_days.where('day').between(from, today, true, true).toArray(),
    );
    const entOf = (day: DayString) => entertainmentSeconds(combineDays(days.get(day) ?? []), rules);

    const weekStart = weekStartOf(today, settings.week_start);
    const weekDays: DayString[] = [];
    for (let d = weekStart; d <= today; d = addDays(d, 1)) weekDays.push(d);
    const week = weekDays.map((day) => ({ day, sec: entOf(day) }));
    const weekTotals = combineDays(weekDays.flatMap((d) => days.get(d) ?? []));
    const todayTotals = combineDays(days.get(today) ?? []);

    let observe: ObserveState = { phase: 'off' };
    let suggestion: LimitSuggestion | null = null;
    if (rules.enabled) {
      const window = rules.observe_start_day ? observeWindow(rules.observe_start_day, today) : [];
      const withData = window.filter((d) => days.has(d));
      observe = observeState(rules.observe_start_day, today, rules.limit_min, withData.length);
      if (observe.phase === 'ready') suggestion = suggestLimit(withData.map(entOf));
    }

    const incidents = (await db.screen_events.where('kind').equals('incident').toArray()).filter(
      (e) => !e.deleted_at && !e.resolved_at,
    );
    const breaks = (await db.screen_events.where('day').equals(today).toArray()).filter(
      (e) => e.kind === 'break' && !e.deleted_at,
    ).length;

    screenStore.setState({
      status: 'ready',
      rules,
      lock: await lockStatus(db),
      today,
      todaySec: entOf(today),
      todayTop: topApps(todayTotals, rules),
      week,
      weekSec: week.reduce((s, d) => s + d.sec, 0),
      weekTop: topApps(weekTotals, rules),
      weekApps: topApps(combineDays([...days.values()].flat()), rules, 40),
      hasData: days.size > 0,
      observe,
      suggestion,
      incidents,
      breaksLeft: Math.max(0, MAX_BREAKS_PER_DAY - breaks),
    });
  } catch (error) {
    logError(error, 'screen.load');
  }
}

const RELOAD = new Set([
  'ScreenTimeChanged',
  'SettingsChanged',
  'DataSynced',
  'DataImported',
  'DataReset',
  'DayClosed',
]);

export async function startScreenStore(db: AscendDB = defaultDb): Promise<() => void> {
  const stop = subscribeAll((event) => {
    if (RELOAD.has(event.type)) void loadScreen(db);
  });
  await loadScreen(db);
  return stop;
}

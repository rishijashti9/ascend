import type {
  Habit,
  InstanceStatus,
  LearningEvent,
  Measure,
  Settings,
  Stat,
} from '@/core/db/types';
import type { DayString } from '@/core/time';

/**
 * Everything the Adaptive System reads (SPEC 6.7 A) — numbers and patterns only, never
 * journal text. Built once from the database (`load.ts`), then every model is pure.
 */
export interface InstanceObs {
  id: string;
  habitId: string;
  day: DayString;
  status: InstanceStatus;
  measure: Measure;
  target: number | null;
  min: number | null;
  /** Logged amount for numeric quests (minutes, count, steps, sleep hours). */
  value: number | null;
  completedAt: string | null;
  core: boolean;
  lowEnergy: boolean;
  stat: Stat;
  /** The wake-up check-in's times say when you woke, not when you get things done. */
  wake: boolean;
  /** A workout quest (auto source workout) — for the health gap analysis. */
  workout?: boolean;
}

export interface FocusObs {
  day: DayString;
  startedAt: string;
  minutes: number;
  /** Linked to a quest (its minutes are already in that quest's value). */
  linked: boolean;
}

export interface AdaptiveInput {
  today: DayString;
  tz: string;
  settings: Settings;
  startDay: DayString | null;
  habits: Habit[];
  /** Daily-quest instances of closed and current days within the window, oldest first. */
  instances: InstanceObs[];
  focus: FocusObs[];
  sleep: { day: DayString; value: number }[];
  /** Daily steps from the Body log (manual or Health Connect). */
  steps?: { day: DayString; value: number }[];
  weight: { day: DayString; value: number }[];
  /** Daily check-in energy (1–5) — used on-device only, never sent anywhere. */
  energy: { day: DayString; value: number }[];
  mood: { day: DayString; value: number }[];
  lowEnergyDays: DayString[];
  /** Learning events within the window (suggestions, notifications, weeks, resets, forgets). */
  events: LearningEvent[];
}

/** Day from which a habit's data counts (latest reset of that habit or of everything). */
export function learnFrom(events: readonly LearningEvent[], habitId: string | null): DayString {
  let from = '';
  for (const e of events) {
    if (e.kind !== 'reset' || e.deleted_at) continue;
    if (e.ref_id === null || e.ref_id === habitId) if (e.day > from) from = e.day;
  }
  return from;
}

/** Item keys cleared on "What the System knows about you" (with the day they were cleared). */
export function forgotten(events: readonly LearningEvent[]): Map<string, DayString> {
  const map = new Map<string, DayString>();
  for (const e of events) {
    if (e.kind === 'forget' && !e.deleted_at && (map.get(e.type) ?? '') < e.day)
      map.set(e.type, e.day);
  }
  return map;
}

/** Day from which an item learns: the latest overall reset or the day it was cleared. */
export function learnSince(events: readonly LearningEvent[], key: string): DayString {
  const reset = learnFrom(events, null);
  const cleared = forgotten(events).get(key) ?? '';
  return cleared > reset ? cleared : reset;
}

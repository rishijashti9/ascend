import { createStore, useStore } from 'zustand';
import { habitModels, type HabitModel } from '@/core/adaptive/habits';
import { loadAdaptiveInput, type AdaptiveInput } from '@/core/adaptive/input';
import {
  completionWindow,
  focusWindow,
  weeklyCapacity,
  type Capacity,
  type HourWindow,
} from '@/core/adaptive/patterns';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';
import { currentTimeZone } from '@/core/time';

/**
 * The Adaptive System's current picture (SPEC 6.7 A), recomputed from the records shortly
 * after anything changes. Nothing here is stored — it's always derived.
 */
export interface AdaptiveState {
  input: AdaptiveInput | null;
  models: ReadonlyMap<string, HabitModel>;
  focus: HourWindow | null;
  completion: HourWindow | null;
  capacity: Capacity | null;
}

const EMPTY: AdaptiveState = {
  input: null,
  models: new Map(),
  focus: null,
  completion: null,
  capacity: null,
};

export const adaptiveStore = createStore<AdaptiveState>(() => EMPTY);

export function useAdaptive<T>(selector: (state: AdaptiveState) => T): T {
  return useStore(adaptiveStore, selector);
}

export function computeAdaptive(input: AdaptiveInput): AdaptiveState {
  return {
    input,
    models: habitModels(input),
    focus: focusWindow(input),
    completion: completionWindow(input),
    capacity: weeklyCapacity(input),
  };
}

export async function loadAdaptive(database: AscendDB = defaultDb): Promise<void> {
  try {
    adaptiveStore.setState(computeAdaptive(await loadAdaptiveInput(database, currentTimeZone())));
  } catch (error) {
    logError(error, 'adaptive.load');
  }
}

/** Debounced: a burst of changes (a sync, a plan) is one recompute. */
export async function startAdaptive(
  database: AscendDB = defaultDb,
  delayMs = 1500,
): Promise<() => void> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = subscribeAll(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void loadAdaptive(database), delayMs);
  });
  await loadAdaptive(database);
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

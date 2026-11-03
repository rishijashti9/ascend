import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import {
  difficultySuggestion,
  type Suggestion,
  type SuggestionKind,
} from '@/core/engine/difficulty';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';
import { snoozeKey } from '@/core/pipeline/actions/difficulty';
import { adaptiveStore } from './adaptive';

/** Today's difficulty suggestion (SPEC 6.7 A adaptive difficulty), if any. */
interface SuggestionState {
  suggestion: Suggestion | null;
}

export const suggestionStore = createStore<SuggestionState>(() => ({ suggestion: null }));

export function useSuggestion<T>(selector: (state: SuggestionState) => T): T {
  return useStore(suggestionStore, selector);
}

const KINDS: SuggestionKind[] = ['low_energy', 'ease', 'raise'];

/** Derived from the Adaptive System's picture plus this device's "Not now" snoozes. */
export async function loadSuggestion(database: AscendDB = defaultDb): Promise<void> {
  try {
    const input = adaptiveStore.getState().input;
    if (!input) {
      suggestionStore.setState({ suggestion: null });
      return;
    }
    const snoozes = await Promise.all(KINDS.map((k) => database.meta.get(snoozeKey(k))));
    const snoozedUntil = Object.fromEntries(
      KINDS.flatMap((k, i) => {
        const v = snoozes[i]?.value;
        return typeof v === 'string' ? [[k, v]] : [];
      }),
    );
    suggestionStore.setState({ suggestion: difficultySuggestion({ input, snoozedUntil }) });
  } catch (error) {
    logError(error, 'suggestion.load');
  }
}

/** Start after `startAdaptive` (it supplies the data). */
export async function startSuggestion(database: AscendDB = defaultDb): Promise<() => void> {
  const offEvents = subscribeAll(() => loadSuggestion(database));
  const offAdaptive = adaptiveStore.subscribe(() => void loadSuggestion(database));
  await loadSuggestion(database);
  return () => {
    offEvents();
    offAdaptive();
  };
}

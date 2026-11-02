import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import {
  difficultySuggestion,
  type Suggestion,
  type SuggestionKind,
} from '@/core/engine/difficulty';
import { logError } from '@/core/errorLog';
import { appDayOf, isoNow, subscribeAll } from '@/core/pipeline';
import { snoozeKey } from '@/core/pipeline/actions/difficulty';
import { addDays } from '@/core/time';

/** Today's difficulty suggestion (SPEC 6.1), if any. */
export interface SuggestionState {
  suggestion: Suggestion | null;
}

export const suggestionStore = createStore<SuggestionState>(() => ({ suggestion: null }));

export function useSuggestion<T>(selector: (state: SuggestionState) => T): T {
  return useStore(suggestionStore, selector);
}

const KINDS: SuggestionKind[] = ['low_energy', 'ease', 'raise'];

export async function loadSuggestion(database: AscendDB = defaultDb): Promise<void> {
  try {
    const suggestion = await database.transaction(
      'r',
      ['settings', 'days', 'quest_instances', 'habits', 'meta'],
      async () => {
        const today = await appDayOf(database, isoNow());
        const from = addDays(today, -7);
        const [days, instances, habits, snoozes] = await Promise.all([
          database.days.where('id').between(from, today, true, true).toArray(),
          database.quest_instances.where('day').between(from, today, true, true).toArray(),
          database.habits.toArray(),
          Promise.all(KINDS.map((k) => database.meta.get(snoozeKey(k)))),
        ]);
        const snoozedUntil = Object.fromEntries(
          KINDS.flatMap((k, i) => {
            const v = snoozes[i]?.value;
            return typeof v === 'string' ? [[k, v]] : [];
          }),
        );
        return difficultySuggestion({ today, days, instances, habits, snoozedUntil });
      },
    );
    suggestionStore.setState({ suggestion });
  } catch (error) {
    logError(error, 'suggestion.load');
  }
}

export async function startSuggestion(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadSuggestion(database));
  await loadSuggestion(database);
  return unsubscribe;
}

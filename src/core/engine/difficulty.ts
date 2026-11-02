import type { DayRecord, DayString, Habit, QuestInstance } from '@/core/db/types';
import { addDays } from '@/core/time';
import { isRecoveryId } from './instances';
import { isDone } from './progress';

/**
 * Difficulty suggestions (SPEC 6.1, 7 "low-energy mode"), pure. Looked at once per day over the
 * days already closed (today never counts — it isn't over):
 * - under 50% of daily quests done on each of the last 3 days → suggest the minimum versions
 *   and making the hardest numeric quests a little smaller;
 * - every daily quest done in full on each of the last 7 days → suggest raising one a little;
 * - low energy 4+ days in a row (today included) → a gentle check-in, no changes.
 * At most one suggestion at a time, in that order of care: low energy, ease, raise.
 */
export type SuggestionKind = 'low_energy' | 'ease' | 'raise';

export interface HabitChange {
  habitId: string;
  title: string;
  measure: Habit['measure'];
  from: number;
  to: number;
}

export interface Suggestion {
  kind: SuggestionKind;
  /** Target changes to apply (ease: smaller; raise: one habit, larger). Empty for low energy. */
  changes: HabitChange[];
}

export interface DifficultyInput {
  today: DayString;
  days: readonly Pick<DayRecord, 'day' | 'low_energy' | 'deleted_at'>[];
  instances: readonly Pick<
    QuestInstance,
    'id' | 'source_type' | 'source_id' | 'day' | 'status' | 'deleted_at'
  >[];
  habits: readonly Pick<
    Habit,
    'id' | 'title' | 'measure' | 'target_value' | 'min_value' | 'status' | 'auto_source' | 'order'
  >[];
  /** Day until which each kind stays hidden (dismissed or applied). */
  snoozedUntil: Partial<Record<SuggestionKind, DayString>>;
}

export const SNOOZE_DAYS: Record<SuggestionKind, number> = { low_energy: 7, ease: 7, raise: 14 };

/** Measures whose target can be nudged (sleep is a health number, not a challenge). */
const ADJUSTABLE = new Set<Habit['measure']>(['minutes', 'count', 'steps']);

/** A tidy number near `v`: minutes in 5s, steps in 500s, counts whole. */
function tidy(measure: Habit['measure'], v: number): number {
  const step = measure === 'minutes' ? 5 : measure === 'steps' ? 500 : 1;
  return Math.max(step, Math.round(v / step) * step);
}

export function smallerTarget(h: Pick<Habit, 'measure' | 'target_value' | 'min_value'>) {
  if (!h.target_value) return null;
  const to = Math.max(h.min_value ?? 0, tidy(h.measure, h.target_value * 0.75));
  return to < h.target_value ? to : null;
}

export function largerTarget(h: Pick<Habit, 'measure' | 'target_value'>) {
  if (!h.target_value) return null;
  const step = h.measure === 'minutes' ? 5 : h.measure === 'steps' ? 500 : 1;
  return Math.max(h.target_value + step, tidy(h.measure, h.target_value * 1.1));
}

export function difficultySuggestion(input: DifficultyInput): Suggestion | null {
  const { today } = input;
  const snoozed = (k: SuggestionKind) => (input.snoozedUntil[k] ?? '') >= today;

  const byDay = new Map<DayString, Pick<QuestInstance, 'source_id' | 'status'>[]>();
  for (const i of input.instances) {
    if (i.deleted_at !== null || i.source_type !== 'habit' || isRecoveryId(i.id)) continue;
    if (i.status === 'skipped') continue;
    const list = byDay.get(i.day) ?? [];
    list.push(i);
    byDay.set(i.day, list);
  }
  const lastDays = (n: number) => Array.from({ length: n }, (_, k) => addDays(today, -1 - k));
  const low = new Set(
    input.days.filter((d) => d.deleted_at === null && d.low_energy).map((d) => d.day),
  );

  // 1. Low energy 4 days in a row, today included.
  if (!snoozed('low_energy') && [today, ...lastDays(3)].every((d) => low.has(d))) {
    return { kind: 'low_energy', changes: [] };
  }

  const active = input.habits
    .filter((h) => h.status === 'active' && ADJUSTABLE.has(h.measure) && h.target_value)
    .sort((a, b) => a.order - b.order);

  // 2. Under half done on each of the last 3 days.
  const three = lastDays(3);
  if (
    !snoozed('ease') &&
    three.every((d) => {
      const list = byDay.get(d);
      return (
        list && list.length > 0 && list.filter((i) => isDone(i.status)).length / list.length < 0.5
      );
    })
  ) {
    const missedTwice = (id: string) =>
      three.filter((d) => byDay.get(d)?.some((i) => i.source_id === id && !isDone(i.status)))
        .length >= 2;
    const changes = active.flatMap((h): HabitChange[] => {
      const to = smallerTarget(h);
      return to !== null && h.target_value && missedTwice(h.id)
        ? [{ habitId: h.id, title: h.title, measure: h.measure, from: h.target_value, to }]
        : [];
    });
    return { kind: 'ease', changes };
  }

  // 3. Everything done in full on each of the last 7 days → raise one quest a little.
  const seven = lastDays(7);
  if (
    !snoozed('raise') &&
    seven.every((d) => {
      const list = byDay.get(d);
      return list && list.length > 0 && list.every((i) => i.status === 'done_full');
    })
  ) {
    const pick = active.find((h) => h.auto_source !== 'sleep');
    const to = pick ? largerTarget(pick) : null;
    if (pick?.target_value && to !== null) {
      return {
        kind: 'raise',
        changes: [
          {
            habitId: pick.id,
            title: pick.title,
            measure: pick.measure,
            from: pick.target_value,
            to,
          },
        ],
      };
    }
  }
  return null;
}

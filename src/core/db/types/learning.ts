import type { BaseRecord, DayString, IsoTime } from './common';

/**
 * Phase 8 (SPEC 6.7). What the Adaptive System learns from. Numbers and patterns only —
 * never journal or free text. Synced, so learning follows the user to every device.
 *
 * - `suggestion`: a card the System showed; outcome shown / accepted / edited / rejected / ignored
 * - `notification`: a reminder; outcome scheduled / delivered / opened
 * - `app_open`: the app came to the front (outcome null)
 * - `week`: planned vs actual for a closed week (id `week:<week start>`)
 * - `reset`: "reset learning" — models ignore older data for `ref_id` (a habit id, or null = all)
 * - `forget`: an item cleared on "What the System knows about you" (`type` = item key)
 */
export type LearningKind = 'suggestion' | 'notification' | 'app_open' | 'week' | 'reset' | 'forget';

export type SuggestionOutcome = 'shown' | 'accepted' | 'edited' | 'rejected' | 'ignored';
export type NotificationOutcome = 'scheduled' | 'delivered' | 'opened';

export interface LearningEvent extends BaseRecord {
  kind: LearningKind;
  /** Suggestion type (e.g. `difficulty_ease`), notification kind (e.g. `wake`), item key… */
  type: string;
  outcome: SuggestionOutcome | NotificationOutcome | null;
  /** When it happened (for a scheduled notification: when it is due). */
  at: IsoTime;
  day: DayString;
  /** What it was about (habit, goal, proposal, notification key), or null. */
  ref_id: string | null;
  /** Numbers only, e.g. `{ minutes_to_action: 4 }` or `{ planned_min: 900, done_min: 640 }`. */
  values: Record<string, number> | null;
}

/**
 * A compact summary of one week or month whose detail was removed by compaction (SPEC 6.7 D).
 * `data` holds everything that matters long-term (shape: `core/compaction`).
 */
export interface Summary extends BaseRecord {
  period_type: 'week' | 'month';
  /** Week start day (`YYYY-MM-DD`) or month (`YYYY-MM`). */
  period: string;
  data: Record<string, unknown>;
}

/** One compaction run, kept as in-app history and synced so peers drop the same detail. */
export interface Compaction extends BaseRecord {
  /** Detail on days before this day was summarised. */
  cutoff_day: DayString;
  /** Records removed per table. */
  removed: Record<string, number>;
  /** Approximate space saved (JSON bytes). */
  bytes_saved: number;
  photos_removed: boolean;
}

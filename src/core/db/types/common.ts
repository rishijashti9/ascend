import type { DayString, Weekday } from '@/core/time';

export type { DayString, Weekday };

/** ISO-8601 UTC timestamp, always from `Date.toISOString()` (sorts as text). */
export type IsoTime = string;

/** Fields every stored record has (SPEC section 10). */
export interface BaseRecord {
  /** UUID made on the device, or a deterministic id (quest instances, days, singletons). */
  id: string;
  created_at: IsoTime;
  updated_at: IsoTime;
  /** Soft delete: set instead of removing the row. Null while the record is live. */
  deleted_at: IsoTime | null;
  /** Schema version the record was last written with (used when importing old backups). */
  schema_version: number;
  /** Hybrid logical clock of the last write, for last-write-wins sync (Phase 7). */
  hlc: string;
}

export type Stat = 'STR' | 'INT' | 'WIL';
export const STATS: readonly Stat[] = ['STR', 'INT', 'WIL'];

export type Difficulty = 'easy' | 'normal' | 'hard' | 'epic';
export type Measure = 'check' | 'minutes' | 'count' | 'steps' | 'sleep_hours';
export type PlannedBy = 'me' | 'rules' | 'ai';

/** What a habit or quest can link up to (SPEC principle 4). */
export type GoalType = 'dream' | 'main_quest' | 'milestone';

export interface GoalLink {
  linked_goal_type: GoalType | null;
  linked_goal_id: string | null;
}

/** Free-form answers from the Goal Planner interview, kept so questions are never asked twice. */
export type PlannerContext = Record<string, unknown>;

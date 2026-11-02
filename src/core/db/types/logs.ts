import type { BaseRecord, DayString, IsoTime, Stat } from './common';

/**
 * Per-day record. `low_energy` is Rishi's choice (syncs normally); every other field
 * is derived by the progress engine and recomputed, never merged (SPEC 9).
 */
export interface DayRecord extends BaseRecord {
  /** id === day */
  day: DayString;
  timezone: string;
  low_energy: boolean;
  /** Times low-energy was switched on/off today, for honesty stats. */
  low_energy_set_at: IsoTime | null;
  active: boolean;
  neutral: boolean;
  daily_clear: boolean;
  shield_used: boolean;
  shields_after: number;
  repaired: boolean;
  streak_at_start: number;
  streak_after: number;
  /** Set when the day rollover closes the day; null while it is today or not yet closed. */
  closed_at: IsoTime | null;
}

export interface FocusSession extends BaseRecord {
  quest_instance_id: string | null;
  /** For sessions not linked to a quest: which stat earns 1 XP per minute. */
  stat: Stat | null;
  skill_ids: string[];
  planned_min: number;
  break_min: number;
  actual_min: number;
  completed: boolean;
  face_down: boolean;
  started_at: IsoTime;
  ended_at: IsoTime | null;
  day: DayString;
}

export interface BodyLog extends BaseRecord {
  day: DayString;
  weight: number | null;
  waist: number | null;
  sleep_hours: number | null;
  steps: number | null;
  workout_notes: string | null;
  photo_id: string | null;
  source: 'manual' | 'health_connect';
  /** True when Rishi edited a value; manual edits win over Health Connect. */
  manual_override: boolean;
}

/** Body photo kept on this device only. Never synced, never in the JSON export. */
export interface Photo extends BaseRecord {
  day: DayString;
  blob: Blob;
  mime: string;
}

export type ReviewType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Review extends BaseRecord {
  type: ReviewType;
  /** daily `YYYY-MM-DD` · weekly week-start day · monthly `YYYY-MM` · yearly `YYYY` */
  period: string;
  energy: number | null;
  mood: number | null;
  win: string | null;
  lesson: string | null;
  text: string | null;
  /** Structured answers for weekly/monthly flows (went well, didn't, etc.). */
  answers: Record<string, string>;
}

export type XpReason =
  | 'quest_full'
  | 'quest_min'
  | 'quest_late'
  | 'quest_topup'
  | 'quest_correction'
  | 'focus'
  | 'bonus';

/**
 * Append-only source of truth for XP. Stores only the BASE award; streak bonus and
 * soft cap are applied when computing totals (SPEC 4.8). Never updated or deleted.
 */
export interface XpEvent extends BaseRecord {
  day: DayString;
  occurred_at: IsoTime;
  /** Stat credited, or null for player-only bonuses. */
  stat: Stat | null;
  /** May be negative for a same-day correction. */
  base_amount: number;
  reason: XpReason;
  /** Unique, e.g. `instance_id:full:0`. Same event written twice is stored once. */
  idempotency_key: string;
  ref_type: 'quest_instance' | 'focus_session' | 'achievement' | null;
  ref_id: string | null;
}

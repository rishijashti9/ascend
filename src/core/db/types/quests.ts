import type {
  BaseRecord,
  DayString,
  Difficulty,
  GoalLink,
  IsoTime,
  Measure,
  PlannedBy,
  Stat,
  Weekday,
} from './common';

export type HabitStatus = 'active' | 'paused' | 'archived';
export type AutoSource = 'none' | 'steps' | 'sleep' | 'workout' | 'wake_checkin';

/** A recurring daily quest. Edits apply from today forward (instances keep snapshots). */
export interface Habit extends BaseRecord, GoalLink {
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  /** Weekdays it is scheduled on (0 = Sunday). */
  schedule: Weekday[];
  /** Words for check quests, e.g. "30 min workout" / "10 push-ups". */
  full_version: string;
  min_version: string;
  measure: Measure;
  /** Numeric measures only: full target and minimum (null for `check`). */
  target_value: number | null;
  min_value: number | null;
  /** Core habits decide whether a day is active (max 3). */
  core: boolean;
  auto_source: AutoSource;
  skill_ids: string[];
  status: HabitStatus;
  planned_by: PlannedBy;
  order: number;
}

export type QuestType = 'weekly' | 'side' | 'recovery';
export type QuestStatus = 'active' | 'done' | 'not_done' | 'archived';

/** Weekly, side and recovery quests. */
export interface Quest extends BaseRecord, GoalLink {
  type: QuestType;
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  measure: Measure;
  target_value: number | null;
  min_value: number | null;
  skill_ids: string[];
  /** Weekly quests: Monday (or chosen week start) of their week. */
  week_start: DayString | null;
  /** Side and recovery quests: the day they belong to (null = no due day). */
  due_day: DayString | null;
  status: QuestStatus;
  planned_by: PlannedBy;
  carried_over_from: string | null;
  /** Recovery quests: the missed day this quest can repair (null = no repair possible). */
  repairs_day: DayString | null;
  order: number;
}

export type InstanceStatus =
  'pending' | 'done_full' | 'done_min' | 'done_late' | 'skipped' | 'missed';
export type CompletedVia = 'tap' | 'widget' | 'health' | 'focus' | 'job_log' | 'notification';

/**
 * One scheduled occurrence of a habit or quest. Deterministic id:
 * daily `habit_id:day` · weekly `quest_id:week_start` · side/recovery `quest_id`.
 * Snapshots freeze what the quest was on that day, so later edits never change history.
 */
export interface QuestInstance extends BaseRecord {
  source_type: 'habit' | 'quest';
  source_id: string;
  /** For weekly instances: the week-start day. */
  day: DayString;
  status: InstanceStatus;
  title_snapshot: string;
  stat_snapshot: Stat;
  difficulty_snapshot: Difficulty;
  measure_snapshot: Measure;
  target_snapshot: number | null;
  min_snapshot: number | null;
  full_version_snapshot: string;
  min_version_snapshot: string;
  core_snapshot: boolean;
  auto_source_snapshot: AutoSource;
  completed_at: IsoTime | null;
  completed_via: CompletedVia | null;
  /** Increases on every same-day un-tick, so idempotency keys stay unique (SPEC 4.8). */
  award_revision: number;
}

export type ProgressSource = 'manual' | 'focus' | 'health_connect' | 'job_log' | 'widget';

/** Progress is stored as separate entries, never one overwritten number (SPEC 4.8). */
export interface ProgressEntry extends BaseRecord {
  quest_instance_id: string;
  day: DayString;
  source: ProgressSource;
  amount: number;
  occurred_at: IsoTime;
  /** Optional link to what produced it (e.g. a focus session id). */
  ref_id: string | null;
}

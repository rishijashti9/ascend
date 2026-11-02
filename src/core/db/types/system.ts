import type { ThemePreference } from '@/app/theme';
import type { BaseRecord, DayString, GoalType, IsoTime, Weekday } from './common';

export interface Profile extends BaseRecord {
  /** Singleton: id === 'profile' */
  name: string;
  /** Day 1. Null until onboarding finishes. */
  start_day: DayString | null;
  onboarded_at: IsoTime | null;
  /** Key of the chosen unlocked title (achievement), or null. */
  display_title: string | null;
}

export interface NotificationSettings {
  wake_checkin: boolean;
  morning_briefing: boolean;
  quest_reminders: boolean;
  evening_winddown: boolean;
  evening_time: string; // HH:MM
  job_followups: boolean;
  browser_notifications: boolean;
}

export interface Settings extends BaseRecord {
  /** Singleton: id === 'settings' */
  day_start_hour: number;
  week_start: Weekday;
  wake_time: string; // HH:MM
  wake_window_min: number;
  /** After this time the wake-up quest is missed for the day (DECISIONS 1b). */
  wake_late_cutoff: string; // HH:MM
  theme: ThemePreference;
  notifications: NotificationSettings;
  quiet_hours: { start: string; end: string } | null;
  focus_presets: { work_min: number; break_min: number }[];
  ai_enabled: boolean;
  /** Monthly AI spending limit in USD. */
  ai_monthly_budget: number;
  auto_plan: boolean;
  health_connect_enabled: boolean;
  photo_sync: boolean;
  jobs_enabled: boolean;
}

export interface AchievementUnlocked extends BaseRecord {
  achievement_key: string;
  unlocked_at: IsoTime;
}

export interface Skill extends BaseRecord {
  branch: string;
  name: string;
  parent_id: string | null;
  order: number;
  manual_level_override: number | null;
  status: 'active' | 'archived';
}

export interface SkillEvidence extends BaseRecord {
  skill_id: string;
  type: 'session' | 'quest' | 'project';
  ref_id: string | null;
  minutes: number;
  note: string | null;
  link: string | null;
  day: DayString;
}

export type JobStage =
  'saved' | 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected' | 'ghosted';

export interface JobApplication extends BaseRecord {
  company: string;
  role: string;
  link: string | null;
  source: string | null;
  applied_at: DayString | null;
  stage: JobStage;
  stage_history: { stage: JobStage; at: IsoTime }[];
  salary_range: string | null;
  notes: string | null;
  follow_up_at: DayString | null;
  linked_quest_instance_id: string | null;
}

export interface PlanChange {
  entity: string; // table name
  id: string;
  before: unknown; // null when created
  after: unknown; // null when removed
}

export interface PlanHistory extends BaseRecord {
  goal_type: GoalType | null;
  goal_id: string | null;
  trigger: string;
  summary: string;
  changes: PlanChange[];
  source: 'rules' | 'ai';
  undone_at: IsoTime | null;
}

/** Planner output waiting for approval (or auto-applied with Undo). */
export interface PlanProposal extends BaseRecord {
  goal_type: GoalType | null;
  goal_id: string | null;
  trigger: string;
  summary: string;
  items: unknown[];
  status: 'pending' | 'applied' | 'rejected';
  source: 'rules' | 'ai';
  /** Apply automatically at this time if not reviewed (weekly proposals). */
  auto_apply_at: IsoTime | null;
  plan_history_id: string | null;
}

/** Actions queued by the Android widget or notifications, processed when the app opens. */
export interface PendingAction extends BaseRecord {
  action: string;
  payload: unknown;
  /** The real tap time; this is what counts, not processing time. */
  occurred_at: IsoTime;
  source: 'widget' | 'notification';
  processed_at: IsoTime | null;
}

/** Small key/value store (last rollover, cache versions, persistence result…). */
export interface MetaEntry {
  id: string;
  value: unknown;
}

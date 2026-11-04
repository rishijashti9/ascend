import type { ThemePreference } from '@/app/theme';
import type { ThemeId } from '@/config/themes';

/** Settings → Effects (Phase 12). */
export type EffectsLevel = 'full' | 'light' | 'off';
import type { BaseRecord, DayString, GoalType, IsoTime, Weekday } from './common';

export interface Profile extends BaseRecord {
  /** Singleton: id === 'profile' */
  name: string;
  /** Day 1. Null until onboarding finishes. */
  start_day: DayString | null;
  onboarded_at: IsoTime | null;
  /** Key of the chosen unlocked title (achievement), or null. */
  display_title: string | null;
  /** Growth Compass (Phase 8, optional — older records simply have none). */
  compass?: CompassProfile;
}

/** Growth Compass answers kept on the profile (synced, never sent to any online AI). */
export interface CompassProfile {
  /** Career discovery answers (interest item → 0/1/2, strength ids, value ids). */
  discovery?: {
    interests: Record<string, 0 | 1 | 2>;
    strengths: string[];
    values: string[];
    at: IsoTime;
  };
  /** The career the user is working towards (knowledge-pack id). */
  target_career?: string | null;
  /** Guided health check-in (task 8.19). */
  health?: Record<string, unknown>;
}

export interface NotificationSettings {
  wake_checkin: boolean;
  morning_briefing: boolean;
  quest_reminders: boolean;
  evening_winddown: boolean;
  evening_time: string; // HH:MM
  /** Core-quest reminder time (HH:MM); absent = 18:00 (Phase 8 made it adjustable). */
  reminder_time?: string;
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
  /** Phases 1–11 light/dark choice — replaced by `ui_theme` (kept so old records stay valid). */
  theme: ThemePreference;
  /** Phase 12: the chosen theme (absent = the default, ELEVATE). */
  ui_theme?: ThemeId;
  /** Phase 12: visual effects level (absent = full; system "reduce motion" always means off). */
  effects?: EffectsLevel;
  /** Phase 12: subtle sound + haptics on quest complete and level-up (absent = off). */
  sound_haptics?: boolean;
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

/** Which side of the 70/30 study balance a branch counts for (SPEC 6.5). */
export type SkillTrack = 'ai_robotics' | 'games' | 'other';

/**
 * A skill in the skill tree. Branches are plain names shared by their skills; every skill of a
 * branch has the same `track` (changing a branch updates all of them). Seeded skills use
 * deterministic ids (`skill:<branch>:<name>`), so two devices seed the same records.
 */
export interface Skill extends BaseRecord {
  branch: string;
  track: SkillTrack;
  name: string;
  parent_id: string | null;
  order: number;
  /** 0–5 set by Rishi; null = computed from evidence. */
  manual_level_override: number | null;
  status: 'active' | 'archived';
}

/**
 * Stored proof for a skill: finished projects (note + link). Focus sessions and quests are not
 * copied here — their minutes are computed from the sessions and quests themselves.
 */
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

import type { BaseRecord, DayString, IsoTime, PlannerContext, Stat } from './common';

export type GoalStatus = 'active' | 'paused' | 'done' | 'archived';

export interface Dream extends BaseRecord {
  title: string;
  why: string;
  status: GoalStatus;
  order: number;
  planner_context: PlannerContext;
}

export interface MainQuest extends BaseRecord {
  dream_id: string;
  title: string;
  why: string;
  stat: Stat;
  target_date: DayString | null;
  status: GoalStatus;
  order: number;
  planner_context: PlannerContext;
  /** Last ~30-day check-in (Goal Planner follow-up). */
  last_checkin_day: DayString | null;
}

export type MilestoneStatus = 'upcoming' | 'active' | 'paused' | 'done' | 'archived';
export type MilestoneTargetType = 'metric' | 'count' | 'manual';

/** Where a milestone's current value is read from (progress is calculated, never typed). */
export type MilestoneSource =
  | {
      kind: 'body_metric';
      metric: 'weight' | 'waist';
      direction: 'down' | 'up';
      start_value: number;
    }
  | { kind: 'linked_quests' }
  | { kind: 'job_applications'; stage: 'applied' | 'interview' | 'offer' }
  | { kind: 'focus_minutes' };

export interface Milestone extends BaseRecord {
  main_quest_id: string;
  title: string;
  size_weight: number;
  target_type: MilestoneTargetType;
  target_value: number | null;
  current_source: MilestoneSource | null;
  /** Planner's estimate of weekly quests needed (manual milestones' % uses this). */
  estimated_weekly_quests: number | null;
  target_date: DayString | null;
  status: MilestoneStatus;
  done_at: IsoTime | null;
  planner_context: PlannerContext;
  order: number;
}

import type {
  DayString,
  Difficulty,
  GoalType,
  Measure,
  MilestoneSource,
  MilestoneTargetType,
  Stat,
  Weekday,
} from '@/core/db/types';

/**
 * Goal Planner types (SPEC 6.3). The rule engine fills plan templates (data files) from the
 * interview answers; the result is a list of proposal items Rishi approves (or edits) first.
 */

// ---- Interview ----

export type QuestionKind = 'chips' | 'slider' | 'yesno' | 'date' | 'text';

export interface Question {
  /** Key under which the answer is stored in the goal's planner_context (never asked twice). */
  id: string;
  label: string;
  kind: QuestionKind;
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  default?: string | number | boolean;
  /** Typing is always optional (SPEC 6.3). */
  optional?: boolean;
}

export type Answers = Record<string, unknown>;

// ---- Templates ----

export interface PlanMilestone {
  title: string;
  /** How long it usually takes, in weeks (scaled to fit a deadline). */
  weeks: number;
  /** Small / Medium / Large → 1 / 2 / 3. */
  weight: 1 | 2 | 3;
  target_type: MilestoneTargetType;
  target_value: number | null;
  current_source: MilestoneSource | null;
  /** Manual milestones: weekly quests it should take. */
  estimated_weekly_quests: number | null;
  /** Weekly quest ideas for this milestone, used in order. */
  weekly: readonly string[];
}

export interface PlanHabit {
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  measure: Measure;
  target_value: number | null;
  min_value: number | null;
  full_version: string;
  min_version: string;
  schedule?: Weekday[];
}

export interface TemplatePlan {
  milestones: PlanMilestone[];
  habits: PlanHabit[];
  /** Weekly quests per week while working on a milestone. */
  weeklyPerWeek: number;
}

export interface TemplateContext {
  goalTitle: string;
  today: DayString;
  deadline: DayString | null;
}

export interface PlanTemplate {
  id: string;
  name: string;
  /** Lowercase words that suggest this template from a goal's title. */
  keywords: readonly string[];
  stat: Stat;
  /** Template-specific questions (the shared ones are added by the engine). */
  questions: readonly Question[];
  build(answers: Answers, ctx: TemplateContext): TemplatePlan;
}

// ---- Proposals ----

/** A goal created in the same plan is referenced as `ref:<item id>` until it exists. */
export type Ref = string;

export interface HabitData {
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  measure: Measure;
  target_value: number | null;
  min_value: number | null;
  full_version: string;
  min_version: string;
  schedule: Weekday[];
  linked_goal_type: GoalType | null;
  linked_goal_id: string | Ref | null;
}

export type ProposalItem = { id: string; reason: string; selected: boolean } & (
  | {
      kind: 'milestone.create';
      data: {
        main_quest_id: string;
        title: string;
        size_weight: number;
        target_type: MilestoneTargetType;
        target_value: number | null;
        current_source: MilestoneSource | null;
        estimated_weekly_quests: number | null;
        target_date: DayString | null;
        status: 'active' | 'upcoming';
      };
    }
  | {
      kind: 'quest.create';
      data: {
        type: 'weekly';
        title: string;
        stat: Stat;
        difficulty: Difficulty;
        week_start: DayString;
        linked_goal_type: 'milestone' | 'main_quest';
        linked_goal_id: string | Ref;
        carried_over_from: string | null;
        /** Carried-over quests keep their skills (task 9.2b). */
        skill_ids?: string[];
        /** "Send N applications" quests are counted (task 9.5). */
        measure?: 'count';
        target_value?: number;
      };
    }
  | { kind: 'habit.create'; data: HabitData }
  | {
      kind: 'habit.update';
      habitId: string;
      title: string;
      changes: {
        target_value?: number;
        min_value?: number;
        linked_goal_type?: GoalType | null;
        linked_goal_id?: string | null;
      };
    }
  | { kind: 'habit.pause' | 'habit.archive' | 'habit.restore'; habitId: string; title: string }
  | { kind: 'quest.archive'; questId: string; title: string }
  | {
      kind: 'milestone.setStatus';
      milestoneId: string;
      title: string;
      status: 'active' | 'upcoming' | 'paused' | 'archived';
    }
  | {
      kind: 'mainQuest.setStatus';
      mainQuestId: string;
      title: string;
      status: 'active' | 'paused' | 'archived' | 'done';
    }
);

export type ProposalKind = ProposalItem['kind'];

export interface Analysis {
  /** Minutes per day the active daily quests already ask for (estimate). */
  dailyLoadMin: number;
  /** Share of daily quests done over the last 14 closed days (null = not enough data). */
  completionRate: number | null;
  activeMainQuests: number;
  neglectedStat: Stat | null;
  /** Plain-words warnings shown before the interview. */
  conflicts: string[];
  /** Real minutes done ÷ minutes asked per week (learned; null = not known yet). */
  capacityRatio?: number | null;
}

export interface Plan {
  templateId: string;
  summary: string;
  analysis: Analysis;
  items: ProposalItem[];
}

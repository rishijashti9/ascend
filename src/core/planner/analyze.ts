import type { Capacity } from '@/core/adaptive/patterns';
import type { JobStats } from '@/core/engine/jobs';
import type {
  DayString,
  Habit,
  MainQuest,
  Milestone,
  Quest,
  QuestInstance,
  Stat,
} from '@/core/db/types';
import { STATS } from '@/core/db/types';
import { isDone } from '@/core/engine/progress';
import { addDays } from '@/core/time';
import { DEFAULT_TEMPLATE, PLAN_TEMPLATES } from '@/data/planTemplates';
import { DONE_LOOKS_LIKE } from '@/data/planTemplates/shared';
import type { Analysis, Answers, PlanTemplate, Question } from './types';

/** Everything the planner looks at (SPEC 6.3 step 1). */
export interface PlannerState {
  today: DayString;
  weekStart: DayString;
  mainQuests: readonly MainQuest[];
  milestones: readonly Milestone[];
  habits: readonly Habit[];
  quests: readonly Quest[];
  /** Daily-quest instances of recent days (for the completion rate). */
  instances: readonly Pick<QuestInstance, 'source_type' | 'status' | 'day' | 'deleted_at'>[];
  /** Job search stats while the job tracker is switched on (task 9.5), else null/absent. */
  jobStats?: JobStats | null;
  /** Real weekly capacity learned by the Adaptive System (SPEC 6.7 A), else null/absent. */
  capacity?: Capacity | null;
  /** This week's focus goal (main quest id) — its steps come first in the weekly plan. */
  focusGoalId?: string | null;
}

/** Learned capacity, only when it's at least "likely". */
export function knownCapacity(state: Pick<PlannerState, 'capacity'>): Capacity | null {
  const c = state.capacity;
  return c && c.confidence !== 'early' && c.plannedMinutes > 0 ? c : null;
}

/** Above this many minutes of daily quests a day, the planner suggests trimming (≈6 h). */
export const DAILY_LOAD_LIMIT_MIN = 360;
const TOO_MANY_MAIN_QUESTS = 4;

/** Rough minutes a habit asks for on a day it's scheduled. */
export function estimateMinutes(h: Pick<Habit, 'measure' | 'target_value'>): number {
  switch (h.measure) {
    case 'minutes':
      return h.target_value ?? 0;
    case 'check':
      return 20;
    case 'count':
      return 15;
    case 'steps':
      return 30;
    default:
      return 0; // sleep isn't extra time
  }
}

const hours = (min: number) =>
  min >= 60 ? `${Math.round(min / 6) / 10} h` : `${Math.round(min)} min`;

export function activeHabits(state: Pick<PlannerState, 'habits'>): Habit[] {
  return state.habits.filter((h) => h.status === 'active' && h.deleted_at === null);
}

export function analyze(
  state: PlannerState,
  goal?: Pick<MainQuest, 'id' | 'target_date'>,
): Analysis {
  const habits = activeHabits(state);
  const dailyLoadMin = Math.round(
    habits.reduce((sum, h) => sum + (estimateMinutes(h) * h.schedule.length) / 7, 0),
  );

  const from = addDays(state.today, -14);
  const recent = state.instances.filter(
    (i) =>
      i.source_type === 'habit' && i.deleted_at === null && i.day >= from && i.day < state.today,
  );
  const completionRate =
    recent.length >= 10 ? recent.filter((i) => isDone(i.status)).length / recent.length : null;

  const activeMainQuests = state.mainQuests.filter(
    (q) => q.status === 'active' && q.deleted_at === null,
  ).length;
  const perStat: Record<Stat, number> = { STR: 0, INT: 0, WIL: 0 };
  for (const h of habits) perStat[h.stat]++;
  const neglectedStat = habits.length > 0 ? (STATS.find((s) => perStat[s] === 0) ?? null) : null;

  const conflicts: string[] = [];
  if (activeMainQuests >= TOO_MANY_MAIN_QUESTS) {
    conflicts.push(
      `You have ${activeMainQuests} active main quests. Consider pausing one so each gets real time.`,
    );
  }
  if (dailyLoadMin > DAILY_LOAD_LIMIT_MIN) {
    conflicts.push(
      `Your daily quests already ask for about ${Math.round(dailyLoadMin / 6) / 10} hours a day.`,
    );
  }
  const capacity = knownCapacity(state);
  if (capacity && capacity.ratio < 0.8) {
    conflicts.push(
      `Lately you really do about ${hours(capacity.doneMinutes / 7)} a day of the ${hours(capacity.plannedMinutes / 7)} your quests ask for — the plan is sized to that.`,
    );
  }
  if (completionRate !== null && completionRate < 0.6) {
    conflicts.push(
      `Recent completion is ${Math.round(completionRate * 100)}% — the plan will start light.`,
    );
  }
  if (goal?.target_date && goal.target_date <= state.today) {
    conflicts.push('The deadline has already passed — set a new one in the interview.');
  }
  if (neglectedStat) {
    conflicts.push(`No daily quest trains ${neglectedStat} at the moment.`);
  }
  return {
    dailyLoadMin,
    completionRate,
    activeMainQuests,
    neglectedStat,
    conflicts,
    capacityRatio: capacity ? capacity.ratio : null,
  };
}

/** Lowercase word tokens ("MS in AI/Robotics" → ms, in, ai, robotics; keeps "c++"). */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);
}

/** The template whose keywords best match the goal title (ties: first in the list). */
export function matchTemplate(title: string, context: Answers = {}): PlanTemplate {
  const chosen = context.template;
  if (typeof chosen === 'string') {
    const found = PLAN_TEMPLATES.find((t) => t.id === chosen);
    if (found) return found;
  }
  const words = new Set(tokens(title));
  let best = DEFAULT_TEMPLATE;
  let bestScore = 0;
  for (const t of PLAN_TEMPLATES) {
    const score = t.keywords.filter((k) => words.has(k)).length;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

const DEADLINE: Question = {
  id: 'deadline',
  label: 'Deadline (optional)',
  kind: 'date',
  optional: true,
};

/**
 * The interview (SPEC 6.3 step 2): 3–6 mostly tap-to-answer questions, skipping anything
 * already answered for this goal (planner_context), so nothing is asked twice.
 */
export function interviewFor(
  template: PlanTemplate,
  goal: Pick<MainQuest, 'target_date' | 'planner_context'>,
): Question[] {
  const all = [...template.questions, ...(goal.target_date ? [] : [DEADLINE]), DONE_LOOKS_LIKE];
  return all.filter((q) => goal.planner_context[q.id] === undefined).slice(0, 6);
}

/** Default answers (so "confirm everything" is one tap). */
export function defaultAnswers(questions: readonly Question[]): Answers {
  return Object.fromEntries(
    questions.filter((q) => q.default !== undefined).map((q) => [q.id, q.default]),
  );
}

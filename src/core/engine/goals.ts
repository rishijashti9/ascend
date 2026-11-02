import type {
  BodyLog,
  Dream,
  FocusSession,
  Habit,
  JobApplication,
  JobStage,
  MainQuest,
  Milestone,
  Quest,
  QuestInstance,
} from '@/core/db/types';
import { isDone } from './progress';

/**
 * Goal progress (pure) — SPEC 6.6 "Goal progress is calculated, not typed".
 * - metric: current ÷ target from body logs (start → target, either direction)
 * - count: completed linked quests (or job applications) ÷ target
 * - manual: completed linked weekly quests ÷ the planner's estimate, capped at 90% until done
 * - a milestone is 100% only when it is marked done
 * - main quest % = done milestones weighted by size_weight ÷ total weight
 * - dream % = average of its active (and finished) main quests
 */
export interface GoalData {
  habits: readonly Pick<Habit, 'id' | 'linked_goal_type' | 'linked_goal_id'>[];
  quests: readonly Pick<Quest, 'id' | 'linked_goal_type' | 'linked_goal_id' | 'type'>[];
  instances: readonly Pick<
    QuestInstance,
    'id' | 'source_type' | 'source_id' | 'status' | 'deleted_at'
  >[];
  bodyLogs: readonly Pick<BodyLog, 'day' | 'weight' | 'waist' | 'deleted_at'>[];
  jobs: readonly Pick<JobApplication, 'stage' | 'stage_history' | 'deleted_at'>[];
  sessions: readonly Pick<FocusSession, 'quest_instance_id' | 'actual_min' | 'deleted_at'>[];
}

export interface MilestoneProgress {
  /** 0–1. */
  progress: number;
  /** Current value toward the target (metric/count), or completed weekly quests (manual). */
  current: number;
  /** Target reached (metric/count) — Rishi confirms before it counts as done. */
  reached: boolean;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const STAGE_ORDER: JobStage[] = ['saved', 'applied', 'assessment', 'interview', 'offer'];

/** Instance ids of everything linked to this milestone (its habits' and quests' instances). */
function linkedDoneInstances(m: Pick<Milestone, 'id'>, data: GoalData, weeklyOnly = false) {
  const linked = (x: { linked_goal_type: string | null; linked_goal_id: string | null }) =>
    x.linked_goal_type === 'milestone' && x.linked_goal_id === m.id;
  const sources = new Set<string>([
    ...data.quests
      .filter((q) => linked(q) && (!weeklyOnly || q.type === 'weekly'))
      .map((q) => q.id),
    ...(weeklyOnly ? [] : data.habits.filter(linked).map((h) => h.id)),
  ]);
  return data.instances.filter(
    (i) => i.deleted_at === null && sources.has(i.source_id) && isDone(i.status),
  );
}

export function milestoneProgress(
  m: Pick<
    Milestone,
    'id' | 'status' | 'target_type' | 'target_value' | 'current_source' | 'estimated_weekly_quests'
  >,
  data: GoalData,
): MilestoneProgress {
  const src = m.current_source;
  let current: number;
  let target = m.target_value ?? 0;
  let progress: number;

  if (m.target_type === 'metric' && src?.kind === 'body_metric') {
    const latest = data.bodyLogs
      .filter((l) => l.deleted_at === null && l[src.metric] !== null)
      .sort((a, b) => a.day.localeCompare(b.day))
      .at(-1);
    current = latest?.[src.metric] ?? src.start_value;
    const span = target - src.start_value;
    progress = span === 0 ? 1 : clamp((current - src.start_value) / span);
  } else if (m.target_type === 'count') {
    if (src?.kind === 'job_applications') {
      const minIndex = STAGE_ORDER.indexOf(src.stage);
      current = data.jobs.filter(
        (j) =>
          j.deleted_at === null &&
          j.stage_history.some((h) => STAGE_ORDER.indexOf(h.stage) >= minIndex),
      ).length;
    } else if (src?.kind === 'focus_minutes') {
      const ids = new Set(linkedInstanceIds(m, data));
      current = data.sessions
        .filter((s) => s.deleted_at === null && s.quest_instance_id && ids.has(s.quest_instance_id))
        .reduce((sum, s) => sum + s.actual_min, 0);
    } else {
      current = linkedDoneInstances(m, data).length;
    }
    progress = target > 0 ? clamp(current / target) : 0;
  } else {
    // manual: completed linked weekly quests ÷ estimate, never above 90% until confirmed.
    current = linkedDoneInstances(m, data, true).length;
    target = m.estimated_weekly_quests ?? 0;
    progress = target > 0 ? Math.min(0.9, current / target) : 0;
  }

  const reached = m.target_type !== 'manual' && progress >= 1;
  if (m.status === 'done') return { progress: 1, current, reached: true };
  return { progress: reached ? 1 : Math.min(progress, 0.99), current, reached };
}

/** All instance ids of habits/quests linked to the milestone (for focus minutes). */
function linkedInstanceIds(m: Pick<Milestone, 'id'>, data: GoalData): string[] {
  const linked = (x: { linked_goal_type: string | null; linked_goal_id: string | null }) =>
    x.linked_goal_type === 'milestone' && x.linked_goal_id === m.id;
  const sources = new Set([
    ...data.quests.filter(linked).map((q) => q.id),
    ...data.habits.filter(linked).map((h) => h.id),
  ]);
  return data.instances.filter((i) => sources.has(i.source_id)).map((i) => i.id);
}

const counts = (status: string) => status !== 'archived';

export function mainQuestProgress(
  mq: Pick<MainQuest, 'id' | 'status'>,
  milestones: readonly Pick<Milestone, 'main_quest_id' | 'status' | 'size_weight'>[],
): number {
  if (mq.status === 'done') return 1;
  const own = milestones.filter((m) => m.main_quest_id === mq.id && counts(m.status));
  const total = own.reduce((sum, m) => sum + Math.max(0, m.size_weight), 0);
  if (total === 0) return 0;
  const done = own
    .filter((m) => m.status === 'done')
    .reduce((sum, m) => sum + Math.max(0, m.size_weight), 0);
  return done / total;
}

export function dreamProgress(
  dream: Pick<Dream, 'id' | 'status'>,
  mainQuests: readonly Pick<MainQuest, 'id' | 'dream_id' | 'status'>[],
  progressOf: (mainQuestId: string) => number,
): number {
  if (dream.status === 'done') return 1;
  const own = mainQuests.filter(
    (q) => q.dream_id === dream.id && (q.status === 'active' || q.status === 'done'),
  );
  if (own.length === 0) return 0;
  return own.reduce((sum, q) => sum + progressOf(q.id), 0) / own.length;
}

import { GAME } from '@/config/game';
import type {
  BodyLog,
  DayRecord,
  FocusSession,
  Habit,
  JobApplication,
  MainQuest,
  Milestone,
  Quest,
  QuestInstance,
  Review,
} from '@/core/db/types';
import { isRecoveryId } from './instances';
import { isDone } from './progress';
import type { ProgressState } from './progressState';

/**
 * The numbers achievements are judged on (SPEC 4.7), computed from stored records, pure.
 * Every achievement in src/data/achievements.ts is "one of these ≥ a goal".
 */
export interface AchievementFacts {
  activeDays: number;
  dailyClears: number;
  longestStreak: number;
  recoveriesDone: number;
  lowEnergyActiveDays: number;
  wakeOnTime: number;
  workoutStreak: number;
  habitStreak: number;
  level: number;
  rankIndex: number;
  strLevel: number;
  intLevel: number;
  wilLevel: number;
  lowestStatLevel: number;
  questsDone: number;
  weeklyDone: number;
  sideDone: number;
  focusCompleted: number;
  focusMinutes: number;
  longestSession: number;
  faceDownSessions: number;
  milestonesDone: number;
  mainQuestsDone: number;
  checkIns: number;
  weeklyReviews: number;
  bodyLogDays: number;
  jobApplications: number;
}

export interface FactsInput {
  progress: Pick<ProgressState, 'level' | 'rank' | 'stats' | 'streak' | 'habitStreaks' | 'perDay'>;
  days: readonly Pick<DayRecord, 'day' | 'active' | 'low_energy' | 'deleted_at'>[];
  instances: readonly Pick<
    QuestInstance,
    'id' | 'source_type' | 'source_id' | 'status' | 'auto_source_snapshot' | 'deleted_at'
  >[];
  habits: readonly Pick<Habit, 'id' | 'auto_source'>[];
  quests: readonly Pick<Quest, 'id' | 'type'>[];
  sessions: readonly Pick<
    FocusSession,
    'actual_min' | 'completed' | 'face_down' | 'ended_at' | 'deleted_at'
  >[];
  milestones: readonly Pick<Milestone, 'status' | 'deleted_at'>[];
  mainQuests: readonly Pick<MainQuest, 'status' | 'deleted_at'>[];
  reviews: readonly Pick<Review, 'type' | 'deleted_at'>[];
  bodyLogs: readonly Pick<
    BodyLog,
    'weight' | 'waist' | 'sleep_hours' | 'steps' | 'workout_notes' | 'deleted_at'
  >[];
  jobs: readonly Pick<JobApplication, 'applied_at' | 'deleted_at'>[];
}

const live = <T extends { deleted_at: string | null }>(rows: readonly T[]) =>
  rows.filter((r) => r.deleted_at === null);

export function computeFacts(input: FactsInput): AchievementFacts {
  const { progress } = input;
  const instances = live(input.instances);
  const done = instances.filter((i) => isDone(i.status));
  const questType = new Map(input.quests.map((q) => [q.id, q.type]));
  const workout = new Set(input.habits.filter((h) => h.auto_source === 'workout').map((h) => h.id));
  const streakOf = (ids: Iterable<string>) =>
    Math.max(0, ...[...ids].map((id) => progress.habitStreaks[id]?.longest ?? 0));
  const sessions = live(input.sessions).filter((s) => s.ended_at !== null);
  const completed = sessions.filter((s) => s.completed);
  const reviews = live(input.reviews);
  const levels = [progress.stats.STR.level, progress.stats.INT.level, progress.stats.WIL.level];

  return {
    activeDays: progress.streak.daysActive,
    dailyClears: Object.values(progress.perDay).filter((d) => d.dailyClear).length,
    longestStreak: progress.streak.longest,
    recoveriesDone: done.filter((i) => isRecoveryId(i.id)).length,
    lowEnergyActiveDays: live(input.days).filter((d) => d.low_energy && d.active).length,
    wakeOnTime: done.filter(
      (i) => i.auto_source_snapshot === 'wake_checkin' && i.status === 'done_full',
    ).length,
    workoutStreak: streakOf(workout),
    habitStreak: streakOf(Object.keys(progress.habitStreaks)),
    level: progress.level.level,
    rankIndex: GAME.ranks.findIndex((r) => r.rank === progress.rank),
    strLevel: progress.stats.STR.level,
    intLevel: progress.stats.INT.level,
    wilLevel: progress.stats.WIL.level,
    lowestStatLevel: Math.min(...levels),
    questsDone: done.filter((i) => !isRecoveryId(i.id)).length,
    weeklyDone: done.filter((i) => questType.get(i.source_id) === 'weekly').length,
    sideDone: done.filter((i) => questType.get(i.source_id) === 'side').length,
    focusCompleted: completed.length,
    focusMinutes: sessions.reduce((t, s) => t + s.actual_min, 0),
    longestSession: Math.max(0, ...completed.map((s) => s.actual_min)),
    faceDownSessions: sessions.filter((s) => s.face_down).length,
    milestonesDone: live(input.milestones).filter((m) => m.status === 'done').length,
    mainQuestsDone: live(input.mainQuests).filter((m) => m.status === 'done').length,
    checkIns: reviews.filter((r) => r.type === 'daily').length,
    weeklyReviews: reviews.filter((r) => r.type === 'weekly').length,
    bodyLogDays: live(input.bodyLogs).filter(
      (b) =>
        b.weight !== null ||
        b.waist !== null ||
        b.sleep_hours !== null ||
        b.steps !== null ||
        !!b.workout_notes,
    ).length,
    jobApplications: live(input.jobs).filter((j) => j.applied_at !== null).length,
  };
}

/** How far along an achievement is: value toward its goal (0–1). */
export function achievementProgress(
  def: { metric: keyof AchievementFacts; goal: number },
  facts: AchievementFacts,
): { value: number; progress: number; met: boolean } {
  const value = facts[def.metric];
  return { value, progress: Math.min(1, value / def.goal), met: value >= def.goal };
}

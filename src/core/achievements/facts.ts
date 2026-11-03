import { loadExpanded } from '@/core/compaction/expanded';
import type { AscendDB, TableName } from '@/core/db/db';
import { computeFacts, type AchievementFacts } from '@/core/engine/achievements';
import { computeProgress } from '@/core/engine/progressState';
import { appDayOf } from '@/core/pipeline/helpers';
import { isoNow } from '@/core/pipeline/records';

/** Every table the achievement facts are read from. */
export const FACT_TABLES: TableName[] = [
  'settings',
  'days',
  'xp_events',
  'quest_instances',
  'habits',
  'quests',
  'focus_sessions',
  'milestones',
  'main_quests',
  'reviews',
  'body_logs',
  'job_applications',
  'summaries',
];

/** Reads the facts achievements are judged on. Call inside a transaction over FACT_TABLES. */
export async function readFacts(db: AscendDB, at: string = isoNow()): Promise<AchievementFacts> {
  const [days, xpEvents, live, today, old] = await Promise.all([
    db.days.toArray(),
    db.xp_events.toArray(),
    db.quest_instances.toArray(),
    appDayOf(db, at),
    loadExpanded(db),
  ]);
  // Compacted history counts too (SPEC 6.7 D).
  const instances = [...live, ...old.instances];
  const progress = computeProgress({ days, xpEvents, instances, today, compactedXp: old.dayXp });
  return computeFacts({
    progress,
    days,
    instances,
    habits: await db.habits.toArray(),
    quests: await db.quests.toArray(),
    sessions: [...(await db.focus_sessions.toArray()), ...old.sessions],
    milestones: await db.milestones.toArray(),
    mainQuests: await db.main_quests.toArray(),
    reviews: await db.reviews.toArray(),
    bodyLogs: await db.body_logs.toArray(),
    jobs: await db.job_applications.toArray(),
    extraBodyDays: old.bodyDays,
  });
}

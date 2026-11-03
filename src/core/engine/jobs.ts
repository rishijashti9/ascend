import type { DayString, JobApplication, JobStage } from '@/core/db/types';
import { addDays, weekStartOf, type Weekday } from '@/core/time';

/**
 * Job search stats (SPEC 6.5, pure): applications per week, response rate and the stage where
 * applications end most often. The Goal Planner uses the same numbers (task 9.5).
 */

type Job = Pick<
  JobApplication,
  'id' | 'stage' | 'stage_history' | 'applied_at' | 'follow_up_at' | 'deleted_at'
>;

/** Stages after "applied" that mean the company answered (a rejection is an answer too). */
const RESPONSE: readonly JobStage[] = ['assessment', 'interview', 'offer', 'rejected'];
/** Where an application can end before an offer. */
export type DropStage = 'applied' | 'assessment' | 'interview';
const DROP_ORDER: readonly DropStage[] = ['applied', 'assessment', 'interview'];
export const WEEKS_SHOWN = 8;

export interface JobStats {
  /** Applications sent (stage reached "applied" at some point). */
  applied: number;
  /** Applied ones that got an answer. */
  responded: number;
  /** responded ÷ applied, or null with no applications. */
  responseRate: number | null;
  interviews: number;
  offers: number;
  /** Applications per week, oldest first, the last WEEKS_SHOWN weeks (this week included). */
  perWeek: { day: DayString; value: number }[];
  /** How many applications ended (rejected / ghosted) at each stage. */
  drops: Record<DropStage, number>;
  /** The stage where most ended, or null when none has ended yet. */
  mostDrop: DropStage | null;
  /** Current count per stage (open pipeline). */
  byStage: Record<JobStage, number>;
}

const live = (jobs: readonly Job[]) => jobs.filter((j) => j.deleted_at === null);
const stagesOf = (j: Job): JobStage[] => [...j.stage_history.map((h) => h.stage), j.stage];
const reached = (j: Job, s: JobStage) => stagesOf(j).includes(s);

/** The furthest stage an ended application got to before it ended. */
export function dropStageOf(j: Job): DropStage | null {
  if (j.stage !== 'rejected' && j.stage !== 'ghosted') return null;
  if (j.applied_at === null && !reached(j, 'applied')) return null;
  let last: DropStage = 'applied';
  for (const s of DROP_ORDER) if (reached(j, s)) last = s;
  return last;
}

export function jobStats(jobs: readonly Job[], today: DayString, weekStartsOn: Weekday): JobStats {
  const all = live(jobs);
  const sent = all.filter((j) => j.applied_at !== null || reached(j, 'applied'));
  const responded = sent.filter((j) => RESPONSE.some((s) => reached(j, s))).length;

  const thisWeek = weekStartOf(today, weekStartsOn);
  const perWeek = Array.from({ length: WEEKS_SHOWN }, (_, i) => ({
    day: addDays(thisWeek, -7 * (WEEKS_SHOWN - 1 - i)),
    value: 0,
  }));
  for (const j of sent) {
    if (!j.applied_at) continue;
    const w = weekStartOf(j.applied_at, weekStartsOn);
    const bucket = perWeek.find((b) => b.day === w);
    if (bucket) bucket.value += 1;
  }

  const drops: Record<DropStage, number> = { applied: 0, assessment: 0, interview: 0 };
  for (const j of all) {
    const d = dropStageOf(j);
    if (d) drops[d] += 1;
  }
  const most = DROP_ORDER.reduce<DropStage | null>(
    (best, s) => (drops[s] > 0 && (best === null || drops[s] > drops[best]) ? s : best),
    null,
  );

  const byStage = Object.fromEntries(
    (['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'ghosted'] as const).map(
      (s) => [s, all.filter((j) => j.stage === s).length],
    ),
  ) as Record<JobStage, number>;

  return {
    applied: sent.length,
    responded,
    responseRate: sent.length > 0 ? responded / sent.length : null,
    interviews: sent.filter((j) => reached(j, 'interview')).length,
    offers: sent.filter((j) => reached(j, 'offer')).length,
    perWeek,
    drops,
    mostDrop: most,
    byStage,
  };
}

/** Open applications whose follow-up day has come (closed stages never need one). */
export function followUpsDue(jobs: readonly Job[], today: DayString): Job[] {
  return live(jobs)
    .filter(
      (j) =>
        j.follow_up_at !== null &&
        j.follow_up_at <= today &&
        j.stage !== 'offer' &&
        j.stage !== 'rejected' &&
        j.stage !== 'ghosted',
    )
    .sort((a, b) => (a.follow_up_at ?? '').localeCompare(b.follow_up_at ?? ''));
}

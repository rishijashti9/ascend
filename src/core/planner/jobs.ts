import type { JobStats } from '@/core/engine/jobs';

/**
 * The Goal Planner and the job tracker (SPEC 6.5, task 9.5): the job stats turn into one
 * concrete weekly step when a pattern shows, and the planner's "Send N applications" quests
 * are counted quests, so every logged application ticks one off.
 */

export type JobSuggestionKind = 'interview' | 'assessment' | 'response';

export interface JobSuggestion {
  kind: JobSuggestionKind;
  title: string;
  reason: string;
}

/** Endings at one stage before the planner calls it a pattern. */
export const DROP_PATTERN = 3;
/** Applications needed before a low response rate means something. */
export const RESPONSE_MIN_APPLIED = 10;
export const LOW_RESPONSE_RATE = 0.15;

/** One suggestion from the job stats, most specific first, or null when nothing stands out. */
export function jobSuggestion(stats: JobStats | null | undefined): JobSuggestion | null {
  if (!stats) return null;
  const { drops, mostDrop } = stats;
  if (mostDrop === 'interview' && drops.interview >= DROP_PATTERN) {
    return {
      kind: 'interview',
      title: 'One mock interview',
      reason: `${drops.interview} applications ended at the interview — a practice round helps.`,
    };
  }
  if (mostDrop === 'assessment' && drops.assessment >= DROP_PATTERN) {
    return {
      kind: 'assessment',
      title: 'Practise one timed technical assessment',
      reason: `${drops.assessment} applications ended at the assessment — timed practice helps.`,
    };
  }
  if (
    stats.applied >= RESPONSE_MIN_APPLIED &&
    stats.responseRate !== null &&
    stats.responseRate < LOW_RESPONSE_RATE
  ) {
    return {
      kind: 'response',
      title: 'Tailor the CV to one target role',
      reason: `${stats.responded} of ${stats.applied} applications got an answer — a sharper CV can change that.`,
    };
  }
  return null;
}

/** "Send 5 tailored applications" → a count quest with target 5 (each logged application = 1). */
export function applicationCount(title: string): { measure: 'count'; target_value: number } | null {
  const m = /^send (\d+)\b.*\bapplications?\b/i.exec(title);
  const n = m ? Number(m[1]) : 0;
  return n > 0 ? { measure: 'count', target_value: n } : null;
}

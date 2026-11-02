import type { DayString, MainQuest, Milestone } from '@/core/db/types';
import { diffDays } from '@/core/time';

/**
 * Goal follow-ups (SPEC 6.3 step 5), pure:
 * - deadline risk: the active milestone is clearly behind its schedule (or the main quest's
 *   deadline has passed) → 2–3 one-tap options;
 * - 30-day check-in: "Is this goal still important to you?"
 */
export type Nudge =
  | {
      kind: 'risk';
      mainQuestId: string;
      milestoneId: string | null;
      message: string;
    }
  | { kind: 'checkin'; mainQuestId: string; message: string };

export const CHECKIN_DAYS = 30;
/** How far behind schedule counts as "at risk" (share of the milestone's time). */
const BEHIND_BY = 0.25;

/** Day a milestone started: when the previous one was done, else when it was created. */
function startOf(
  m: Milestone,
  all: readonly Milestone[],
  dayOfIso: (iso: string) => DayString,
): DayString {
  const previous = all
    .filter((x) => x.main_quest_id === m.main_quest_id && x.order < m.order && x.done_at)
    .sort((a, b) => b.order - a.order)[0];
  return dayOfIso(previous?.done_at ?? m.created_at);
}

export function goalNudges(input: {
  today: DayString;
  mainQuests: readonly MainQuest[];
  milestones: readonly Milestone[];
  milestoneProgress: Record<string, { progress: number }>;
  /** Converts a stored ISO time to its app day. */
  dayOfIso: (iso: string) => DayString;
}): Nudge[] {
  const { today, milestones, milestoneProgress, dayOfIso } = input;
  const nudges: Nudge[] = [];

  for (const q of input.mainQuests) {
    if (q.status !== 'active' || q.deleted_at !== null) continue;

    if (q.target_date && q.target_date < today) {
      nudges.push({
        kind: 'risk',
        mainQuestId: q.id,
        milestoneId: null,
        message: `The deadline for ${q.title} has passed. Extend it, add time, or reduce the scope.`,
      });
    } else {
      const active = milestones
        .filter(
          (m) =>
            m.main_quest_id === q.id &&
            m.status === 'active' &&
            m.deleted_at === null &&
            m.target_date,
        )
        .sort((a, b) => a.order - b.order)[0];
      if (active?.target_date) {
        const start = startOf(active, milestones, dayOfIso);
        const span = Math.max(1, diffDays(start, active.target_date));
        const elapsed = diffDays(start, today);
        const progress = milestoneProgress[active.id]?.progress ?? 0;
        if (elapsed >= 7 && progress < Math.min(1, elapsed / span) - BEHIND_BY) {
          nudges.push({
            kind: 'risk',
            mainQuestId: q.id,
            milestoneId: active.id,
            message: `“${active.title}” is behind schedule (${Math.round(progress * 100)}% done, ${Math.round(Math.min(1, elapsed / span) * 100)}% of its time used).`,
          });
        }
      }
    }

    const last = q.last_checkin_day ?? dayOfIso(q.created_at);
    if (diffDays(last, today) >= CHECKIN_DAYS) {
      nudges.push({
        kind: 'checkin',
        mainQuestId: q.id,
        message: `Is ${q.title} still important to you?`,
      });
    }
  }
  return nudges;
}

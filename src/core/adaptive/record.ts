import type {
  LearningEvent,
  LearningKind,
  NotificationOutcome,
  SuggestionOutcome,
} from '@/core/db/types';
import { appDayOf } from '@/core/pipeline/helpers';
import { newBase } from '@/core/pipeline/records';
import type { ActionContext } from '@/core/pipeline/registry';

/**
 * Writes one learning event (SPEC 6.7 A) inside the caller's transaction — the caller's
 * action must list `learning_events` in its tables. Numbers only: `values` never holds text.
 */
export async function writeLearning(
  ctx: ActionContext,
  e: {
    kind: LearningKind;
    type: string;
    outcome?: SuggestionOutcome | NotificationOutcome | null;
    ref_id?: string | null;
    values?: Record<string, number> | null;
    id?: string;
    at?: string;
  },
): Promise<LearningEvent> {
  const at = e.at ?? ctx.occurredAt;
  const event: LearningEvent = {
    ...newBase(e.id, ctx.processedAt),
    kind: e.kind,
    type: e.type,
    outcome: e.outcome ?? null,
    at,
    day: await appDayOf(ctx.db, at),
    ref_id: e.ref_id ?? null,
    values: e.values ?? null,
  };
  await ctx.db.learning_events.put(event);
  return event;
}

/** Suggestion type of a plan proposal, from its trigger (`weekly:2026-11-02` → `plan_weekly`). */
export const planSuggestionType = (trigger: string): string =>
  trigger.startsWith('difficulty:')
    ? `difficulty_${trigger.split(':')[1] ?? ''}`
    : `plan_${trigger.split(':')[0] ?? 'other'}`;

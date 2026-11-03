import { useEffect } from 'react';
import { logError } from '@/core/errorLog';
import { recordAction } from '@/core/pipeline';

/**
 * Records that a suggestion card was shown (SPEC 6.7 A: the Adaptive System learns which
 * suggestions help). Once per type + ref + day — the action ignores repeats. Pass `null` as
 * the type while nothing is shown.
 */
export function useShown(type: string | null, ref: string | null = null): void {
  useEffect(() => {
    if (!type) return;
    void recordAction({ type: 'learning.shown', payload: { type, ref_id: ref } }).catch(
      (error: unknown) => logError(error, 'learning.shown'),
    );
  }, [type, ref]);
}

/** Records an answer that has no action of its own (fire and forget). */
export function recordAnswer(
  type: string,
  ref: string | null,
  outcome: 'accepted' | 'edited' | 'rejected',
): void {
  void recordAction({ type: 'learning.answer', payload: { type, ref_id: ref, outcome } }).catch(
    (error: unknown) => logError(error, 'learning.answer'),
  );
}

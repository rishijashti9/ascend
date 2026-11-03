import { logError } from '@/core/errorLog';
import { recordAction } from '@/core/pipeline';

/**
 * Learning bookkeeping at startup and whenever the app comes back to the front (SPEC 6.7 A):
 * the app open itself, and suggestions left unanswered on earlier days become `ignored`.
 * Never blocks or breaks anything — failures are only logged.
 */
export function startLearningRecorder(): () => void {
  const tick = () => {
    void recordAction({ type: 'learning.appOpen', payload: {} })
      .then(() => recordAction({ type: 'learning.closeDays', payload: {} }))
      .then(() => recordAction({ type: 'learning.closeWeeks', payload: {} }))
      .catch((error: unknown) => logError(error, 'learning.appOpen'));
  };
  tick();
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}

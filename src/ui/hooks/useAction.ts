import { useCallback, useState } from 'react';
import { logError } from '@/core/errorLog';
import { recordAction, RuleError, type Action } from '@/core/pipeline';

/**
 * Runs an action from a screen: tracks "busy" (so a double tap can't fire twice) and turns
 * rule errors into a message that's safe to show. Unexpected errors are logged.
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: Action): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await recordAction(action);
      return true;
    } catch (e) {
      if (e instanceof RuleError) setError(e.message);
      else {
        logError(e, `action:${action.type}`);
        setError('That didn’t save. Please try again.');
      }
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error };
}

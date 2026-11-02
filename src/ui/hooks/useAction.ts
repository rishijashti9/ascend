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

  const execute = useCallback(
    async <R>(action: Action): Promise<{ ok: true; value: R | undefined } | { ok: false }> => {
      setBusy(true);
      setError(null);
      try {
        return { ok: true, value: (await recordAction<R>(action)).value };
      } catch (e) {
        if (e instanceof RuleError) setError(e.message);
        else {
          logError(e, `action:${action.type}`);
          setError('That didn’t save. Please try again.');
        }
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** Runs the action; true if it saved. */
  const run = useCallback(async (action: Action) => (await execute(action)).ok, [execute]);

  /** Runs the action and returns its result (undefined if it failed — the error is shown). */
  const runFor = useCallback(
    async <R>(action: Action): Promise<R | undefined> => {
      const r = await execute<R>(action);
      return r.ok ? r.value : undefined;
    },
    [execute],
  );

  return { run, runFor, busy, error };
}

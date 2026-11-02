import type { Action } from '@/core/pipeline';
import { useAction } from '@/ui/hooks/useAction';
import { useXpFloat } from '@/ui/hooks/useXpFloat';

export type Act = (action: Action) => Promise<boolean>;

/** Runs an action and floats the XP it really earned. Shared by every quest card. */
export function useQuestAction() {
  const { run, busy, error } = useAction();
  const { float, track } = useXpFloat();
  const act: Act = (action) => track(() => run(action));
  return { act, busy, error, float };
}

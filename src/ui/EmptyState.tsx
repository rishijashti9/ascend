import type { ReactNode } from 'react';
import { Robot } from './Robot';

/**
 * A friendly empty state (SPEC 8, Phase 12): the System companion, one calm line that tells you
 * the next step, and an optional action.
 */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="inset flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center">
      <Robot size={44} />
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-muted text-sm">{children}</p>
        {action}
      </div>
    </div>
  );
}

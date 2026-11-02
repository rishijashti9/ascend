import type { Settings } from '@/core/db/types';
import { useAction } from '@/ui/hooks/useAction';
import { Card } from './sections';

/** Auto-plan mode (SPEC 6.2): routine follow-ups applied automatically, always with Undo. */
export function PlannerSettings({ settings }: { settings: Settings }) {
  const { run, busy, error } = useAction();
  const on = settings.auto_plan;
  return (
    <Card title="Goal Planner">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium" id="auto-plan-label">
            Auto-plan
          </p>
          <p className="text-muted text-sm">
            When a milestone is finished, start the next one and plan its week automatically — shown
            in Plan history with Undo. New goals, deadline changes and pausing or archiving always
            wait for your approval.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="auto-plan-label"
          disabled={busy}
          onClick={() => void run({ type: 'settings.update', payload: { auto_plan: !on } })}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-accent-fill' : 'bg-surface-2 border-border border'}`}
        >
          <span
            className={`bg-surface absolute top-1 size-6 rounded-full shadow transition-[left] ${on ? 'left-7' : 'left-1'}`}
          />
        </button>
      </div>
      <p className="text-muted text-xs">
        The weekly plan is always applied on the week’s first day (with Undo), so a week is never
        empty.
      </p>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}

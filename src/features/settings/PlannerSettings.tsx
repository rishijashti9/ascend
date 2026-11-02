import type { Settings } from '@/core/db/types';
import { useAction } from '@/ui/hooks/useAction';
import { Switch } from '@/ui/Switch';
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
        <Switch
          on={on}
          labelledBy="auto-plan-label"
          disabled={busy}
          onChange={(v) => void run({ type: 'settings.update', payload: { auto_plan: v } })}
        />
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

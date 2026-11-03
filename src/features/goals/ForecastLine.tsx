import { CONFIDENCE_LABEL } from '@/core/adaptive/model';
import { useGoals } from '@/core/state/goals';

/** "At your pace … around 15 Dec · likely" (SPEC 6.7 A) — shown once there's a pace to go on. */
export function ForecastLine({ id }: { id: string }) {
  const f = useGoals((s) => s.forecasts[id]);
  if (!f || f.confidence === 'early') return null;
  return (
    <p
      className={`text-xs ${f.lateBy !== null && f.lateBy > 7 ? 'text-warning-text' : 'text-muted'}`}
    >
      {f.why} <span className="text-muted">· {CONFIDENCE_LABEL[f.confidence]}</span>
    </p>
  );
}

/** This week's focus goal, one line (Today's "This week" and the weekly review). */
export function FocusGoalLine({ prefix = 'Focus this week' }: { prefix?: string }) {
  const focus = useGoals((s) => s.focusGoal);
  const title = useGoals((s) => s.mainQuests.find((q) => q.id === focus?.mainQuestId)?.title);
  if (!focus || !title) return null;
  return (
    <p className="text-sm">
      <span className="text-muted">{prefix}: </span>
      <span className="font-medium">{title}</span>
      <span className="text-muted"> — {focus.why}</span>
    </p>
  );
}

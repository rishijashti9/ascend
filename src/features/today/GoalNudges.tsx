import { ChevronRight } from 'lucide-react';
import { useGoalNudgeRows } from './suggestionHooks';
import { Link } from 'react-router';

/**
 * "Goals that need a look" on Today (SPEC 6.3): main quests without a plan yet (e.g. the ones
 * saved during onboarding), goals behind schedule, and monthly check-ins. Up to 3 links.
 */
export function GoalNudges() {
  const rows = useGoalNudgeRows();
  if (rows.length === 0) return null;

  return (
    <nav aria-label="Goals that need a look" className="panel flex flex-col">
      {rows.map((r) => (
        <Link key={r.id} to={r.to} className="flex min-h-11 items-center gap-2 px-4 py-2 text-sm">
          <span className="flex-1">
            {r.title}: {r.note}
          </span>
          <ChevronRight aria-hidden size={16} className="text-muted" />
        </Link>
      ))}
    </nav>
  );
}

import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import { useGoals } from '@/core/state/goals';
import { useNudges } from '@/features/goals/useNudges';

/** A short "goals that need a look" list on Today, linking to each goal (SPEC 6.3 follow-ups). */
export function GoalNudges() {
  const nudges = useNudges();
  const mainQuests = useGoals((s) => s.mainQuests);
  if (!isEnabled('goals') || nudges.length === 0) return null;
  const ids = [...new Set(nudges.map((n) => n.mainQuestId))].slice(0, 3);
  return (
    <nav
      aria-label="Goals that need a look"
      className="border-border bg-surface flex flex-col rounded-lg border"
    >
      {ids.map((id) => {
        const q = mainQuests.find((x) => x.id === id);
        const risk = nudges.some((n) => n.mainQuestId === id && n.kind === 'risk');
        return (
          <Link
            key={id}
            to={`/goals/${id}`}
            className="flex min-h-11 items-center gap-2 px-4 py-2 text-sm"
          >
            <span className="flex-1">
              {q?.title}: {risk ? 'behind schedule' : 'monthly check-in'}
            </span>
            <ChevronRight aria-hidden size={16} className="text-muted" />
          </Link>
        );
      })}
    </nav>
  );
}

import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import { useGoals } from '@/core/state/goals';
import { useNudges } from '@/features/goals/useNudges';

/**
 * "Goals that need a look" on Today (SPEC 6.3): main quests without a plan yet (e.g. the ones
 * saved during onboarding), goals behind schedule, and monthly check-ins. Up to 3 links.
 */
export function GoalNudges() {
  const nudges = useNudges();
  const mainQuests = useGoals((s) => s.mainQuests);
  const milestones = useGoals((s) => s.milestones);
  const proposals = useGoals((s) => s.proposals);
  if (!isEnabled('goals')) return null;

  const unplanned = mainQuests.filter(
    (q) =>
      q.status === 'active' &&
      !milestones.some((m) => m.main_quest_id === q.id && m.status !== 'archived') &&
      !proposals.some((p) => p.goal_id === q.id),
  );
  const rows = [
    ...unplanned.map((q) => ({
      id: q.id,
      title: q.title,
      note: 'needs a plan',
      to: `/goals/${q.id}?plan=new`,
    })),
    ...[...new Set(nudges.map((n) => n.mainQuestId))].map((id) => ({
      id,
      title: mainQuests.find((x) => x.id === id)?.title ?? '',
      note: nudges.some((n) => n.mainQuestId === id && n.kind === 'risk')
        ? 'behind schedule'
        : 'monthly check-in',
      to: `/goals/${id}`,
    })),
  ]
    .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
    .slice(0, 3);
  if (rows.length === 0) return null;

  return (
    <nav
      aria-label="Goals that need a look"
      className="border-border bg-surface flex flex-col rounded-lg border"
    >
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

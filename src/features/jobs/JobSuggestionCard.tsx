import { Sparkles } from 'lucide-react';
import type { JobStats } from '@/core/engine/jobs';
import { jobSuggestion } from '@/core/planner/jobs';
import { useAppState } from '@/core/state/app';
import { useJobs } from '@/core/state/jobs';
import { useQuests } from '@/core/state/quests';
import { useToday } from '@/core/state/today';
import { weekStartOf, type Weekday } from '@/core/time';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { recordAnswer, useShown } from '@/ui/hooks/useShown';

/**
 * The Goal Planner reading the job stats (SPEC 6.5): when a pattern shows (e.g. many endings at
 * the interview), one concrete step for this week, added with one tap or put off for 2 weeks.
 * With a job-search goal, the weekly plan adds the same step by itself.
 */
export function JobSuggestionCard({ stats }: { stats: JobStats }) {
  const suggestion = jobSuggestion(stats);
  const snoozed = useJobs((s) => s.snoozed);
  const weekly = useQuests((s) => s.weekly);
  const today = useToday((s) => s.day);
  const weekStartsOn = useAppState((s) => (s.settings?.week_start ?? 1) as Weekday);
  const { run, busy, error } = useAction();
  const week = today ? weekStartOf(today, weekStartsOn) : null;
  const visible =
    !!suggestion &&
    !!today &&
    (snoozed[suggestion.kind] ?? '') <= today &&
    !weekly.some(
      (q) => q.title === suggestion.title && q.week_start === week && q.deleted_at === null,
    );
  useShown(visible ? `job_${suggestion.kind}` : null);
  if (!visible) return null;

  return (
    <section aria-label="Planner suggestion" className="panel flex flex-col gap-2 p-4">
      <p className="text-accent-text flex items-center gap-1 text-xs font-semibold tracking-wide uppercase">
        <Sparkles aria-hidden size={14} /> Goal Planner
      </p>
      <p>{suggestion.reason}</p>
      <p className="text-muted text-sm">Suggested for this week: “{suggestion.title}”.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => {
            recordAnswer(`job_${suggestion.kind}`, null, 'accepted');
            void run({
              type: 'quest.create',
              payload: {
                type: 'weekly',
                title: suggestion.title,
                stat: 'INT',
                difficulty: 'normal',
                planned_by: 'rules',
              },
            });
          }}
        >
          Add to this week
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run({ type: 'job.snoozeSuggestion', payload: { kind: suggestion.kind } })
          }
        >
          Not now
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

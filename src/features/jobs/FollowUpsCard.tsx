import { Link } from 'react-router';
import { followUpsDue } from '@/core/engine/jobs';
import { useAppState } from '@/core/state/app';
import { useJobs } from '@/core/state/jobs';
import { useToday } from '@/core/state/today';
import { formatDay } from '@/features/goals/format';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';

const SHOWN = 3;

/** Today: applications whose follow-up day has come (SPEC 6.5), with one-tap answers. */
export function FollowUpsCard() {
  const on = useAppState((s) => s.settings?.jobs_enabled ?? false);
  const jobs = useJobs((s) => s.jobs);
  const today = useToday((s) => s.day);
  const { run, busy, error } = useAction();
  if (!on || !today) return null;
  const due = followUpsDue(jobs, today);
  if (due.length === 0) return null;
  const byId = new Map(jobs.map((j) => [j.id, j]));

  return (
    <section aria-label="Follow-ups" className="panel flex flex-col gap-3 p-4">
      <h2 className="text-sm font-medium">
        {due.length === 1 ? 'Time to follow up' : `${due.length} applications to follow up`}
      </h2>
      <ul className="flex flex-col gap-3">
        {due.slice(0, SHOWN).map((d) => {
          const job = byId.get(d.id);
          if (!job) return null;
          return (
            <li key={job.id} className="flex flex-col gap-2">
              <p className="text-sm">
                <span className="font-medium">{job.company}</span> · {job.role}
                {job.applied_at && (
                  <span className="text-muted"> · applied {formatDay(job.applied_at)}</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run({ type: 'job.followedUp', payload: { id: job.id, next: 'week' } })
                  }
                >
                  Done — again in a week
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run({ type: 'job.followedUp', payload: { id: job.id, next: 'none' } })
                  }
                >
                  No more reminders
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {due.length > SHOWN && (
        <Link to="/jobs" className="text-accent-text text-sm">
          {due.length - SHOWN} more in Jobs
        </Link>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

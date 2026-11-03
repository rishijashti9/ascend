import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { JobApplication } from '@/core/db/types';
import { jobStats } from '@/core/engine/jobs';
import { useAppState } from '@/core/state/app';
import { useJobs } from '@/core/state/jobs';
import { useToday } from '@/core/state/today';
import type { Weekday } from '@/core/time';
import { Button } from '@/ui/Button';
import { JobCard } from './JobCard';
import { JobForm } from './JobForm';
import { JobStats } from './JobStats';
import { JobSuggestionCard } from './JobSuggestionCard';
import { COLUMNS } from './labels';

/**
 * Jobs (SPEC 7.10, 6.5): the application pipeline — a list on mobile, columns (board) on
 * desktop — plus simple stats. Hidden until the Job tracker is switched on in Settings.
 */
export function JobsPage() {
  const settings = useAppState((s) => s.settings);
  const jobs = useJobs((s) => s.jobs);
  const status = useJobs((s) => s.status);
  const today = useToday((s) => s.day);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  if (!settings || !today || status !== 'ready') return null;

  if (!settings.jobs_enabled) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <p className="text-muted">
          The job tracker is switched off.{' '}
          <Link to="/settings" className="text-accent-text underline">
            Switch it on in Settings
          </Link>{' '}
          when your search starts.
        </p>
      </div>
    );
  }

  const stats = jobStats(jobs, today, (settings.week_start ?? 1) as Weekday);
  const columns = COLUMNS.map((c) => ({
    ...c,
    jobs: jobs.filter((j) => c.stages.includes(j.stage)),
  }));
  const onEdit = (j: JobApplication) => {
    setAdding(false);
    setEditing(j);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Jobs</h1>
        {!adding && (
          <Button
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus aria-hidden size={16} /> Add application
          </Button>
        )}
      </div>

      {adding && <JobForm today={today} onDone={() => setAdding(false)} />}
      {editing && (
        <JobForm key={editing.id} job={editing} today={today} onDone={() => setEditing(null)} />
      )}

      {jobs.length === 0 && !adding ? (
        <p className="text-muted">
          No applications yet. Add one when you apply — each gives INT XP through an “Applied”
          quest, and a follow-up reminder a week later.
        </p>
      ) : (
        <>
          <JobSuggestionCard stats={stats} />
          <JobStats stats={stats} />

          {/* Mobile: one list in sections; Closed collapsed. */}
          <div className="flex flex-col gap-4 lg:hidden">
            {columns.map((c) => {
              if (c.jobs.length === 0) return null;
              const closed = c.key === 'closed';
              return (
                <section
                  key={c.key}
                  aria-label={`${c.label} (list)`}
                  className="flex flex-col gap-2"
                >
                  {closed ? (
                    <button
                      type="button"
                      aria-expanded={showClosed}
                      onClick={() => setShowClosed((s) => !s)}
                      className="text-muted min-h-11 self-start text-sm font-medium"
                    >
                      {c.label} ({c.jobs.length}) {showClosed ? '▴' : '▾'}
                    </button>
                  ) : (
                    <h2 className="text-muted text-sm font-medium">
                      {c.label} ({c.jobs.length})
                    </h2>
                  )}
                  {(!closed || showClosed) &&
                    c.jobs.map((j) => <JobCard key={j.id} job={j} today={today} onEdit={onEdit} />)}
                </section>
              );
            })}
          </div>

          {/* Desktop: the board. */}
          <div className="hidden gap-3 lg:grid lg:grid-cols-6">
            {columns.map((c) => (
              <section
                key={c.key}
                aria-label={`${c.label} (board)`}
                className="bg-surface-2 flex min-h-40 flex-col gap-2 rounded-lg p-2"
              >
                <h2 className="text-muted px-1 text-sm font-medium">
                  {c.label} ({c.jobs.length})
                </h2>
                {c.jobs.map((j) => (
                  <JobCard key={j.id} job={j} today={today} onEdit={onEdit} />
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

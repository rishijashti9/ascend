import { ExternalLink, Pencil } from 'lucide-react';
import type { JobApplication, JobStage } from '@/core/db/types';
import { JOB_STAGES } from '@/core/pipeline/actions/jobs';
import { formatDay } from '@/features/goals/format';
import { useAction } from '@/ui/hooks/useAction';
import { STAGE_LABEL } from './labels';

/** One application: what, when, the next follow-up, and its stage (changed in one tap). */
export function JobCard({
  job,
  today,
  onEdit,
}: {
  job: JobApplication;
  today: string;
  onEdit: (job: JobApplication) => void;
}) {
  const { run, busy, error } = useAction();
  const due = job.follow_up_at !== null && job.follow_up_at <= today;
  return (
    <article
      aria-label={`${job.company}, ${job.role}`}
      className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-3"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{job.company}</h3>
          <p className="text-muted truncate text-sm">{job.role}</p>
        </div>
        {job.link && (
          <a
            href={job.link}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open the ${job.company} posting`}
            className="text-muted flex size-11 items-center justify-center rounded-md"
          >
            <ExternalLink aria-hidden size={16} />
          </a>
        )}
        <button
          type="button"
          aria-label={`Edit ${job.company}`}
          onClick={() => onEdit(job)}
          className="text-muted flex size-11 items-center justify-center rounded-md"
        >
          <Pencil aria-hidden size={16} />
        </button>
      </div>
      <p className="text-muted text-xs">
        {job.applied_at ? `Applied ${formatDay(job.applied_at)}` : 'Not applied yet'}
        {job.source && ` · ${job.source}`}
        {job.salary_range && ` · ${job.salary_range}`}
      </p>
      {job.follow_up_at && (
        <p className={`text-xs ${due ? 'text-warning-text font-medium' : 'text-muted'}`}>
          {due ? 'Follow up now' : `Follow up ${formatDay(job.follow_up_at)}`}
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">Stage</span>
        <select
          value={job.stage}
          disabled={busy}
          onChange={(e) =>
            void run({
              type: 'job.setStage',
              payload: { id: job.id, stage: e.target.value as JobStage },
            })
          }
          className="border-border bg-surface text-text min-h-11 flex-1 rounded-md border px-2"
        >
          {JOB_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </article>
  );
}

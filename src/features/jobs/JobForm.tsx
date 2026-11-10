import { useState, type FormEvent } from 'react';
import type { JobApplication } from '@/core/db/types';
import { Button } from '@/ui/Button';
import { Select, TextInput } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';

interface Values {
  company: string;
  role: string;
  link: string;
  source: string;
  salary_range: string;
  notes: string;
  applied_at: string;
  follow_up_at: string;
}

const EMPTY: Values = {
  company: '',
  role: '',
  link: '',
  source: '',
  salary_range: '',
  notes: '',
  applied_at: '',
  follow_up_at: '',
};

function valuesOf(j: JobApplication): Values {
  return {
    company: j.company,
    role: j.role,
    link: j.link ?? '',
    source: j.source ?? '',
    salary_range: j.salary_range ?? '',
    notes: j.notes ?? '',
    applied_at: j.applied_at ?? '',
    follow_up_at: j.follow_up_at ?? '',
  };
}

/** Add an application, or edit one (with delete). Empty fields are simply left out. */
export function JobForm({
  job,
  today,
  onDone,
}: {
  job?: JobApplication;
  today: string;
  onDone: () => void;
}) {
  const { run, busy, error } = useAction();
  const [v, setV] = useState<Values>(job ? valuesOf(job) : EMPTY);
  const [stage, setStage] = useState<'applied' | 'saved'>('applied');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof Values) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  const orNull = (s: string) => (s.trim() ? s.trim() : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const common = {
      company: v.company,
      role: v.role,
      link: orNull(v.link),
      source: orNull(v.source),
      salary_range: orNull(v.salary_range),
      notes: orNull(v.notes),
      follow_up_at: orNull(v.follow_up_at),
    };
    const ok = job
      ? await run({
          type: 'job.update',
          payload: {
            id: job.id,
            changes: {
              ...common,
              ...(job.applied_at && v.applied_at ? { applied_at: v.applied_at } : {}),
            },
          },
        })
      : await run({
          type: 'job.create',
          payload: {
            ...common,
            stage,
            applied_at: stage === 'applied' ? orNull(v.applied_at) : null,
          },
        });
    if (ok) onDone();
  }

  const showApplied = job ? job.applied_at !== null : stage === 'applied';

  return (
    <form
      onSubmit={(e) => void submit(e)}
      aria-label={job ? `Edit ${job.company}` : 'New application'}
      className="panel outline-accent outline-2 flex flex-col gap-3 p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput label="Company" value={v.company} maxLength={80} onChange={set('company')} />
        <TextInput label="Role" value={v.role} maxLength={100} onChange={set('role')} />
        {!job && (
          <Select
            label="Stage"
            value={stage}
            onChange={(e) => setStage(e.target.value as 'applied' | 'saved')}
            options={[
              { value: 'applied', label: 'Applied' },
              { value: 'saved', label: 'Saved — not applied yet' },
            ]}
          />
        )}
        {showApplied && (
          <TextInput
            label="Applied on"
            type="date"
            max={today}
            value={v.applied_at}
            hint={job ? undefined : 'Leave empty for today.'}
            onChange={set('applied_at')}
          />
        )}
        <TextInput
          label="Link (optional)"
          type="url"
          inputMode="url"
          value={v.link}
          placeholder="https://…"
          onChange={set('link')}
        />
        <TextInput
          label="Source (optional)"
          value={v.source}
          maxLength={60}
          placeholder="LinkedIn, referral, lab website…"
          onChange={set('source')}
        />
        <TextInput
          label="Salary range (optional)"
          value={v.salary_range}
          maxLength={60}
          onChange={set('salary_range')}
        />
        <TextInput
          label="Follow up on (optional)"
          type="date"
          value={v.follow_up_at}
          hint={job ? undefined : 'Leave empty: 7 days after applying.'}
          onChange={set('follow_up_at')}
        />
      </div>
      <TextInput
        label="Notes (optional)"
        value={v.notes}
        maxLength={2000}
        onChange={set('notes')}
      />
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !v.company.trim() || !v.role.trim()}>
          {job ? 'Save' : 'Add application'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {job &&
          (confirmDelete ? (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run({ type: 'job.delete', payload: { id: job.id } }).then(
                  (ok) => ok && onDone(),
                )
              }
            >
              Delete for good
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete…
            </Button>
          ))}
      </div>
    </form>
  );
}

import { useState } from 'react';
import type { GoalStatus, MilestoneStatus } from '@/core/db/types';
import type { Action } from '@/core/pipeline';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/ProgressBar';

const LABEL: Record<GoalStatus | MilestoneStatus, string> = {
  active: 'Active',
  upcoming: 'Upcoming',
  paused: 'Paused',
  done: 'Done',
  archived: 'Archived',
};

export function StatusChip({ status }: { status: GoalStatus | MilestoneStatus }) {
  if (status === 'active') return null;
  const tone = status === 'done' ? 'text-success-text' : 'text-muted';
  return (
    <span className={`border-border rounded-md border px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {LABEL[status]}
    </span>
  );
}

export function ProgressLine({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <ProgressBar value={value} label={label} className="h-2 flex-1" />
      <span className="text-muted w-10 text-right text-sm tabular-nums">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

/**
 * Status buttons for a goal: pause/resume, finish (with a confirmation), archive/restore.
 * Nothing is ever deleted here — archive keeps history (SPEC 5).
 */
export function StatusActions({
  status,
  makeAction,
  run,
  busy,
  name,
}: {
  status: GoalStatus | MilestoneStatus;
  makeAction: (status: GoalStatus | MilestoneStatus) => Action;
  run: (a: Action) => Promise<boolean>;
  busy: boolean;
  name: string;
}) {
  const [confirmFinish, setConfirmFinish] = useState(false);
  const go = (s: GoalStatus | MilestoneStatus) => void run(makeAction(s));

  if (confirmFinish) {
    return (
      <div
        role="alertdialog"
        aria-label={`Mark ${name} done?`}
        className="bg-surface-2 flex flex-col gap-2 rounded-md p-3"
      >
        <p className="text-sm">Mark “{name}” as done?</p>
        <div className="flex gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              setConfirmFinish(false);
              go('done');
            }}
          >
            Yes, it’s done
          </Button>
          <Button variant="secondary" onClick={() => setConfirmFinish(false)}>
            Not yet
          </Button>
        </div>
      </div>
    );
  }
  // `contents`: the buttons flow inline with whatever the parent row already holds (e.g. Edit).
  return (
    <div className="contents">
      {status === 'upcoming' && (
        <Button variant="ghost" disabled={busy} onClick={() => go('active')}>
          Start now
        </Button>
      )}
      {(status === 'active' || status === 'upcoming') && (
        <Button variant="ghost" disabled={busy} onClick={() => setConfirmFinish(true)}>
          Mark done
        </Button>
      )}
      {status === 'active' && (
        <Button variant="ghost" disabled={busy} onClick={() => go('paused')}>
          Pause
        </Button>
      )}
      {(status === 'paused' || status === 'done') && (
        <Button variant="ghost" disabled={busy} onClick={() => go('active')}>
          {status === 'paused' ? 'Resume' : 'Reopen'}
        </Button>
      )}
      {status !== 'archived' ? (
        <Button variant="ghost" disabled={busy} onClick={() => go('archived')}>
          Archive
        </Button>
      ) : (
        <Button variant="ghost" disabled={busy} onClick={() => go('active')}>
          Restore
        </Button>
      )}
    </div>
  );
}

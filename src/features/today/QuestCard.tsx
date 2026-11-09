import { Check, Undo2, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import type { InstanceStatus, Measure } from '@/core/db/types';
import { isDone } from '@/core/engine/progress';
import type { TodayQuest } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/ProgressBar';
import { StatChip } from '@/ui/stats';
import { XpFloat } from '@/ui/XpFloat';
import { useQuestAction, type Act } from './useQuestAction';

const UNIT: Record<Measure, string> = {
  check: '',
  minutes: 'min',
  count: '',
  steps: 'steps',
  sleep_hours: 'h',
};

const DONE_LABEL: Partial<Record<InstanceStatus, string>> = {
  done_full: 'Done · Full',
  done_min: 'Done · Minimum',
  done_late: 'Done · Late',
};

const fmt = (v: number, m: Measure) => `${v.toLocaleString()}${UNIT[m] ? ` ${UNIT[m]}` : ''}`;

/** Quick amounts for additive measures (one tap, no typing). */
const QUICK: Partial<Record<Measure, number[]>> = { minutes: [10, 25], count: [1, 5] };

export function StatusLine({
  status,
  pop = false,
  single = false,
}: {
  status: InstanceStatus;
  pop?: boolean;
  /** One-version quests just say "Done". */
  single?: boolean;
}) {
  if (isDone(status)) {
    return (
      <span className="text-success-text flex items-center gap-1 text-sm font-medium">
        <Check aria-hidden size={16} className={pop ? 'animate-check-pop' : ''} />
        {single ? 'Done' : DONE_LABEL[status]}
      </span>
    );
  }
  if (status === 'missed') return <span className="text-missed text-sm">Missed</span>;
  return null;
}

function NumericInput({ quest, act: run, busy }: { quest: TodayQuest; act: Act; busy: boolean }) {
  const { instance } = quest;
  const m = instance.measure_snapshot;
  const total = m === 'steps' || m === 'sleep_hours';
  const [value, setValue] = useState(total && quest.progress > 0 ? String(quest.progress) : '');
  const log = (amount: number) =>
    run({ type: 'quest.logProgress', payload: { instanceId: instance.id, amount } });
  const amount = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(amount) && amount >= 0;

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void log(amount).then((ok) => ok && !total && setValue(''));
      }}
    >
      {QUICK[m] && (
        <div className="flex gap-2">
          {QUICK[m].map((q) => (
            <Button
              key={q}
              variant="secondary"
              className="flex-1 sm:flex-none"
              disabled={busy}
              onClick={() => void log(q)}
            >
              +{fmt(q, m)}
            </Button>
          ))}
        </div>
      )}
      <div className="flex min-w-0 flex-1 gap-2">
        <label className="flex min-w-0 flex-1 flex-col">
          <span className="sr-only">
            {total ? `${instance.title_snapshot} total today` : `Add ${UNIT[m] || 'amount'}`}
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={m === 'sleep_hours' ? 0.5 : 1}
            placeholder={total ? `Total ${UNIT[m]}` : `Add ${UNIT[m] || 'amount'}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="control min-h-11 w-full px-3 text-base"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={busy || !valid}>
          {total ? 'Save' : 'Add'}
        </Button>
      </div>
    </form>
  );
}

/** One daily quest: Full/Minimum taps for check quests, progress input for numeric ones. */
export function QuestCard({
  quest,
  lowEnergy = false,
  note,
  risk,
}: {
  quest: TodayQuest;
  lowEnergy?: boolean;
  /** "At risk today" (SPEC 6.7 A): why this one tends to slip. */
  risk?: string;
  /** Extra line for weekly/side quests, e.g. the goal it serves or its due day. */
  note?: string;
}) {
  const { act: run, busy, error, float } = useQuestAction();
  const { instance, progress } = quest;
  const m = instance.measure_snapshot;
  const done = isDone(instance.status);
  const id = instance.id;
  // Weekly and side quests have one version: a single "Done" tap, or one target to reach.
  const single = instance.source_type === 'quest';
  // The Digital discipline quest completes itself after its day (Phase 11) — no buttons.
  const auto = instance.auto_source_snapshot === 'screen_time';

  return (
    <li
      className={`panel relative flex flex-col gap-3 p-4 transition-[outline-color] duration-(--dur) ${
        instance.status === 'missed' ? 'opacity-70' : ''
      } ${done ? 'outline-accent outline-2' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 className="display">{instance.title_snapshot}</h3>
            <StatChip stat={instance.stat_snapshot} />
          </div>
          {m === 'check' && !single && !auto && (
            <p className="text-muted text-sm">
              {instance.full_version_snapshot} · minimum: {instance.min_version_snapshot}
            </p>
          )}
          {auto && (
            <p className="text-muted text-sm">
              Completes itself when the day ends within your entertainment limit.
            </p>
          )}
          {m !== 'check' && (
            <p className="text-muted text-sm tabular-nums">
              {fmt(progress, m)} / {fmt(instance.target_snapshot ?? 0, m)}
              {!single && ` · minimum ${fmt(instance.min_snapshot ?? 0, m)}`}
            </p>
          )}
          {note && <p className="text-muted text-xs">{note}</p>}
          {risk && !done && (
            <p className="text-warning-text flex items-start gap-1 text-xs">
              <TrendingDown aria-hidden size={14} className="mt-px shrink-0" />
              <span>
                <span className="sr-only">At risk today: </span>
                {risk}
              </span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusLine status={instance.status} pop={float !== null} single={single} />
          {done && !auto && (
            <Button
              variant="ghost"
              className="px-2"
              aria-label={`Undo ${instance.title_snapshot}`}
              disabled={busy}
              onClick={() => void run({ type: 'quest.untick', payload: { instanceId: id } })}
            >
              <Undo2 aria-hidden size={18} />
            </Button>
          )}
        </div>
      </div>

      {m !== 'check' && (
        <ProgressBar
          value={progress / (instance.target_snapshot ?? 1)}
          fill={done ? 'bg-success' : 'bg-accent'}
          label={`${instance.title_snapshot} progress`}
        />
      )}

      {m === 'check' && single && !auto && instance.status === 'pending' && (
        <Button
          disabled={busy}
          onClick={() =>
            void run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } })
          }
        >
          Done
        </Button>
      )}
      {m === 'check' && !single && !auto && instance.status === 'pending' && (
        <div className={`flex gap-2 ${lowEnergy ? 'flex-row-reverse' : ''}`}>
          <Button
            variant={lowEnergy ? 'secondary' : 'primary'}
            className="flex-1"
            disabled={busy}
            onClick={() =>
              void run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } })
            }
          >
            Full
          </Button>
          <Button
            variant={lowEnergy ? 'primary' : 'secondary'}
            className="flex-1"
            disabled={busy}
            onClick={() =>
              void run({ type: 'quest.complete', payload: { instanceId: id, version: 'min' } })
            }
          >
            Minimum
          </Button>
        </div>
      )}
      {m === 'check' && !auto && instance.status === 'done_min' && (
        <Button
          variant="secondary"
          className="self-start"
          disabled={busy}
          onClick={() =>
            void run({ type: 'quest.complete', payload: { instanceId: id, version: 'full' } })
          }
        >
          Upgrade to Full
        </Button>
      )}
      {m !== 'check' && instance.status !== 'done_full' && instance.status !== 'missed' && (
        <NumericInput quest={quest} act={run} busy={busy} />
      )}

      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
      <XpFloat float={float} />
    </li>
  );
}

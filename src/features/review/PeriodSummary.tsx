import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Review } from '@/core/db/types';
import {
  periodOf,
  periodRange,
  periodStats,
  shiftPeriod,
  type PeriodType,
} from '@/core/engine/periodStats';
import { useAppState } from '@/core/state/app';
import { useFocus } from '@/core/state/focus';
import { useGoals } from '@/core/state/goals';
import { useProgress } from '@/core/state/progress';
import { useReviews } from '@/core/state/reviews';
import { currentTimeZone, dayOf } from '@/core/time';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';
import { periodLabel } from './format';
import { Stat } from './Stat';

const TEXTAREA = 'control w-full p-3 text-base';

function Reflection({
  type,
  period,
  existing,
}: {
  type: PeriodType;
  period: string;
  existing: Review | undefined;
}) {
  const [text, setText] = useState(existing?.text ?? '');
  const [saved, setSaved] = useState(false);
  const { run, busy, error } = useAction();
  const label = type === 'monthly' ? 'Looking back on this month' : 'Looking back on this year';
  return (
    <form
      aria-label="Reflection"
      className="panel flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ type: 'review.save', payload: { type, period, text } }).then(setSaved);
      }}
    >
      <Field label={label} hint="Optional. What changed, what you're proud of, what's next.">
        {(id) => (
          <textarea
            id={id}
            rows={4}
            maxLength={5000}
            value={text}
            onChange={(e) => {
              setSaved(false);
              setText(e.target.value);
            }}
            className={TEXTAREA}
          />
        )}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || (!existing && !text.trim())}>
          {existing ? 'Update reflection' : 'Save reflection'}
        </Button>
        {saved && (
          <span role="status" className="text-success-text text-sm">
            Saved
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Monthly and yearly summaries (SPEC 7.7): stats generated from the data, browsable back to the
 * first month / year of play, plus an optional reflection saved with the period.
 */
export function PeriodSummary({ type, today }: { type: PeriodType; today: string }) {
  const current = periodOf(type, today);
  const [period, setPeriod] = useState(current);
  const startDay = useAppState((s) => s.profile?.start_day ?? today);
  const dayStartHour = useAppState((s) => s.settings?.day_start_hour ?? 0);
  const perDay = useProgress((s) => s.progress?.perDay);
  const sessions = useFocus((s) => s.sessions);
  const milestones = useGoals((s) => s.milestones);
  const reviews = useReviews((s) => s.reviews);
  const first = periodOf(type, startDay);
  const existing = reviews.find((r) => r.type === type && r.period === period);

  const { from, to } = periodRange(type, period);
  const stats = perDay
    ? periodStats({
        from,
        to,
        today,
        startDay,
        perDay,
        sessions,
        milestoneDays: milestones.flatMap((m) =>
          m.status === 'done' && m.done_at
            ? [dayOf(Date.parse(m.done_at), currentTimeZone(), dayStartHour)]
            : [],
        ),
        checkIns: reviews,
      })
    : null;
  const name = periodLabel(type, period);
  const unit = type === 'monthly' ? 'month' : 'year';

  return (
    <div className="flex flex-col gap-5">
      <section aria-label={`Summary for ${name}`} className="panel flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Previous ${unit}`}
            disabled={period <= first}
            onClick={() => setPeriod(shiftPeriod(type, period, -1))}
            className="text-muted flex size-11 items-center justify-center rounded-md disabled:opacity-40"
          >
            <ChevronLeft aria-hidden size={20} />
          </button>
          <h2 className="display flex-1 text-center">{name}</h2>
          <button
            type="button"
            aria-label={`Next ${unit}`}
            disabled={period >= current}
            onClick={() => setPeriod(shiftPeriod(type, period, 1))}
            className="text-muted flex size-11 items-center justify-center rounded-md disabled:opacity-40"
          >
            <ChevronRight aria-hidden size={20} />
          </button>
        </div>
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Active days" value={`${stats.activeDays} of ${stats.daysSoFar}`} />
            <Stat label="Daily Clears" value={String(stats.dailyClears)} />
            <Stat label="XP" value={stats.xp.toLocaleString()} />
            <Stat
              label="Level"
              value={
                stats.levelEnd > stats.levelStart
                  ? `${stats.levelStart} → ${stats.levelEnd}`
                  : String(stats.levelEnd)
              }
            />
            <Stat label="Focus" value={`${Math.round((stats.focusMin / 60) * 10) / 10} h`} />
            <Stat label="Quests done" value={String(stats.questsDone)} />
            <Stat label="Milestones done" value={String(stats.milestonesDone)} />
            <Stat label="Best streak" value={`${stats.bestStreak} days`} />
          </div>
        )}
        {stats && stats.checkIns > 0 && (
          <p className="text-muted text-sm">
            {stats.checkIns} check-in{stats.checkIns === 1 ? '' : 's'}
            {stats.avgEnergy !== null && ` · average energy ${stats.avgEnergy}/5`}
            {stats.avgMood !== null && ` · average mood ${stats.avgMood}/5`}
          </p>
        )}
      </section>
      <Reflection key={`${type}:${period}`} type={type} period={period} existing={existing} />
    </div>
  );
}

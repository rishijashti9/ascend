import { Link } from 'react-router';
import type { AppUsage } from '@/core/screentime/apps';
import { formatMinutes } from '@/core/screentime/observe';
import { useScreen } from '@/core/state/screen';
import { ChartCard } from '@/ui/charts/ChartCard';
import { DailyBars } from '@/ui/charts/DailyBars';
import { shortDay } from '@/ui/charts/scale';
import { ProgressBar } from '@/ui/ProgressBar';
import { IncidentBanner } from './ScreenTimeCard';

/** More → Screen time (SPEC 6.8): today vs the limit, this week, top apps. Phone totals only. */
export function ScreenTimePage() {
  const s = useScreen((v) => v);
  const limit = s.rules?.limit_min ?? null;
  const todayMin = Math.round(s.todaySec / 60);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link
        to="/me"
        className="text-accent-text inline-flex min-h-11 items-center self-start text-sm font-semibold"
      >
        ← Me
      </Link>
      <h1 className="display text-2xl">Screen time</h1>
      <IncidentBanner />
      {!s.rules?.enabled ? (
        <p className="text-muted text-sm">
          Screen time is off. Switch it on in{' '}
          <Link className="text-accent-text underline" to="/settings#screen-time">
            Settings → Screen time
          </Link>{' '}
          (Android app).
        </p>
      ) : (
        <>
          <section aria-label="Today" className="panel flex flex-col gap-3 p-4">
            <h2 className="display">Entertainment today</h2>
            <p className="display text-3xl tabular-nums">
              {formatMinutes(todayMin)}
              {limit !== null && (
                <span className="text-muted text-base"> of {formatMinutes(limit)}</span>
              )}
            </p>
            {limit !== null && (
              <ProgressBar
                value={todayMin / limit}
                fill={todayMin >= limit ? 'bg-warning' : 'bg-accent'}
                label="Entertainment today vs limit"
              />
            )}
            {s.observe.phase === 'observing' && (
              <p className="text-muted text-sm">
                Observing quietly — day {s.observe.day} of 7. No reminders yet.
              </p>
            )}
            <TopApps apps={s.todayTop} empty="Nothing counted yet today." />
          </section>

          <ChartCard
            title="Entertainment this week"
            subtitle={`${formatMinutes(Math.round(s.weekSec / 60))} so far`}
            rows={s.week.map((d) => ({
              label: shortDay(d.day),
              value: formatMinutes(Math.round(d.sec / 60)),
            }))}
          >
            <DailyBars
              bars={s.week.map((d) => ({ day: d.day, value: Math.round(d.sec / 60) }))}
              unit="min"
              label="Entertainment minutes"
              target={limit !== null ? { value: limit, label: 'limit' } : null}
            />
          </ChartCard>

          <section aria-label="Top apps this week" className="panel flex flex-col gap-2 p-4">
            <h2 className="display">Top apps this week</h2>
            <TopApps apps={s.weekTop} empty="No readings this week yet." />
          </section>
          <p className="text-muted text-xs">
            Only daily totals per app are kept, on this phone and your own account — never what you
            did inside an app, and never sent to any AI. YouTube inside a focus session doesn’t
            count.
          </p>
        </>
      )}
    </div>
  );
}

function TopApps({ apps, empty }: { apps: AppUsage[]; empty: string }) {
  if (apps.length === 0) return <p className="text-muted text-sm">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {apps.map((a) => (
        <li key={a.pkg} className="flex items-center justify-between gap-2 py-1 text-sm">
          <span>
            {a.label}
            {a.entertainment && <span className="text-muted"> · entertainment</span>}
          </span>
          <span className="text-muted tabular-nums">
            {formatMinutes(Math.round(a.seconds / 60))}
          </span>
        </li>
      ))}
    </ul>
  );
}

import type { BodyLog, DayString } from '@/core/db/types';
import { useBody } from '@/core/state/body';
import { useGoals } from '@/core/state/goals';
import { useHabits } from '@/core/state/habits';
import { addDays } from '@/core/time';
import { formatDay } from '@/features/goals/format';
import { ChartCard } from '@/ui/charts/ChartCard';
import { DailyBars } from '@/ui/charts/DailyBars';
import { dailySeries } from '@/ui/charts/scale';
import { TrendLine } from '@/ui/charts/TrendLine';

type Metric = 'weight' | 'waist';

function points(logs: readonly BodyLog[], key: Metric, from: DayString) {
  return logs
    .filter((l) => l.day >= from && l[key] !== null)
    .map((l) => ({ day: l.day, value: l[key] as number }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Trend charts (SPEC 7.6): weight and waist over time, sleep and steps for 30 days. */
export function BodyTrends({ today }: { today: DayString }) {
  const logs = useBody((s) => s.logs);
  const milestones = useGoals((s) => s.milestones);
  const habits = useHabits((s) => s.habits);

  // A metric milestone in progress gives the target line (e.g. "Reach 72 kg").
  const targetFor = (metric: Metric) => {
    const m = milestones.find(
      (x) =>
        x.status === 'active' &&
        x.target_type === 'metric' &&
        x.current_source?.kind === 'body_metric' &&
        x.current_source.metric === metric &&
        x.target_value !== null,
    );
    return m?.target_value ? { value: m.target_value, label: `Target ${m.target_value}` } : null;
  };
  const habitTarget = (source: 'steps' | 'sleep', unit: string) => {
    const h = habits.find(
      (x) => x.status === 'active' && x.auto_source === source && x.target_value,
    );
    return h?.target_value
      ? { value: h.target_value, label: `Goal ${h.target_value.toLocaleString()}${unit}` }
      : null;
  };

  const from90 = addDays(today, -89);
  const from30 = addDays(today, -29);
  const series = (key: 'sleep_hours' | 'steps') =>
    dailySeries(
      from30,
      today,
      new Map(logs.flatMap((l) => (l[key] === null ? [] : [[l.day, l[key] as number] as const]))),
    );
  const weight = points(logs, 'weight', from90);
  const waist = points(logs, 'waist', from90);
  const sleep = series('sleep_hours');
  const steps = series('steps');
  const has = (s: { value: number | null }[]) => s.some((d) => d.value !== null);
  const rows = (list: { day: DayString; value: number | null }[], unit: string) =>
    list
      .filter((d) => d.value !== null)
      .reverse()
      .map((d) => ({
        label: formatDay(d.day),
        value: `${(d.value as number).toLocaleString()} ${unit}`,
      }));

  if (weight.length < 2 && waist.length < 2 && !has(sleep) && !has(steps)) {
    return <p className="text-muted text-sm">Charts appear after a few days of logging.</p>;
  }
  return (
    <section aria-label="Trends" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Trends</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {weight.length >= 2 && (
          <ChartCard title="Weight" subtitle="kg · last 90 days" rows={rows(weight, 'kg')}>
            <TrendLine points={weight} unit="kg" target={targetFor('weight')} label="Weight" />
          </ChartCard>
        )}
        {waist.length >= 2 && (
          <ChartCard title="Waist" subtitle="cm · last 90 days" rows={rows(waist, 'cm')}>
            <TrendLine points={waist} unit="cm" target={targetFor('waist')} label="Waist" />
          </ChartCard>
        )}
        {has(sleep) && (
          <ChartCard title="Sleep" subtitle="hours · last 30 days" rows={rows(sleep, 'h')}>
            <DailyBars bars={sleep} unit="h" target={habitTarget('sleep', ' h')} label="Sleep" />
          </ChartCard>
        )}
        {has(steps) && (
          <ChartCard title="Steps" subtitle="last 30 days" rows={rows(steps, 'steps')}>
            <DailyBars bars={steps} unit="steps" target={habitTarget('steps', '')} label="Steps" />
          </ChartCard>
        )}
      </div>
    </section>
  );
}

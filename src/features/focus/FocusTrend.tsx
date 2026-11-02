import { useFocus } from '@/core/state/focus';
import { useToday } from '@/core/state/today';
import { formatDay } from '@/features/goals/format';
import { ChartCard } from '@/ui/charts/ChartCard';
import { DailyBars } from '@/ui/charts/DailyBars';
import { dailySeries } from '@/ui/charts/scale';

/** Focused minutes per day this month (SPEC 4.6 charts). */
export function FocusTrend() {
  const sessions = useFocus((s) => s.sessions);
  const today = useToday((s) => s.day);
  if (!today) return null;
  const first = `${today.slice(0, 8)}01`;
  const perDay = new Map<string, number>();
  for (const s of sessions) {
    if (s.day >= first && s.day <= today)
      perDay.set(s.day, (perDay.get(s.day) ?? 0) + s.actual_min);
  }
  if (perDay.size === 0) return null;
  const bars = dailySeries(first, today, perDay);
  const month = new Date(`${first}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    timeZone: 'UTC',
  });
  return (
    <ChartCard
      title="Focus minutes"
      subtitle={`per day · ${month}`}
      rows={[...perDay.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([d, m]) => ({ label: formatDay(d), value: `${m} min` }))}
    >
      <DailyBars bars={bars} unit="min" label="Focus minutes" />
    </ChartCard>
  );
}

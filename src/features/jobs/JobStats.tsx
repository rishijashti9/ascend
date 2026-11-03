import type { JobStats as Stats } from '@/core/engine/jobs';
import { Stat } from '@/features/review/Stat';
import { ChartCard } from '@/ui/charts/ChartCard';
import { DailyBars } from '@/ui/charts/DailyBars';
import { shortDay } from '@/ui/charts/scale';
import { DROP_TEXT } from './labels';

/** Simple stats (SPEC 6.5): applications per week, response rate, where most applications end. */
export function JobStats({ stats }: { stats: Stats }) {
  const rate = stats.responseRate === null ? '—' : `${Math.round(stats.responseRate * 100)}%`;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section
        aria-label="Job search stats"
        className="border-border bg-surface shadow-card flex flex-col gap-3 rounded-lg border p-4"
      >
        <h2 className="text-muted text-sm font-medium">So far</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Applications" value={String(stats.applied)} />
          <Stat label="Response rate" value={rate} />
          <Stat label="Interviews" value={String(stats.interviews)} />
          <Stat label="Offers" value={String(stats.offers)} />
        </div>
        <p className="text-muted text-sm">
          {stats.mostDrop
            ? `${DROP_TEXT[stats.mostDrop]} (${stats.drops.applied} after applying, ${stats.drops.assessment} at the assessment, ${stats.drops.interview} at the interview).`
            : 'No application has ended yet.'}
        </p>
      </section>
      <ChartCard
        title="Applications per week"
        subtitle="Last 8 weeks; each bar starts on the date shown."
        rows={stats.perWeek.map((w) => ({
          label: `Week of ${shortDay(w.day)}`,
          value: String(w.value),
        }))}
      >
        {stats.perWeek.some((w) => w.value > 0) ? (
          <DailyBars bars={stats.perWeek} unit="" label="Applications per week, last 8 weeks" />
        ) : (
          <p className="text-muted py-6 text-center text-sm">
            No applications in the last 8 weeks.
          </p>
        )}
      </ChartCard>
    </div>
  );
}

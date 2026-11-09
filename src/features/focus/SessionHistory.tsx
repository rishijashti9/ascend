import { Smartphone } from 'lucide-react';
import { STATS } from '@/core/db/types';
import { useAppState } from '@/core/state/app';
import { useFocus } from '@/core/state/focus';
import { useToday } from '@/core/state/today';
import { weekStartOf } from '@/core/time';
import { formatDay } from '@/features/goals/format';
import { STAT_META } from '@/ui/statMeta';
import { FocusTrend } from './FocusTrend';
import { byDay, statOf, weekSummary } from './history';
import { EmptyState } from '@/ui/EmptyState';

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Session history (SPEC 7.5): this week at a glance, then every session by day. */
export function SessionHistory() {
  const sessions = useFocus((s) => s.sessions);
  const linked = useFocus((s) => s.linked);
  const day = useToday((s) => s.day);
  const weekStartsOn = useAppState((s) => s.settings?.week_start ?? 1);
  if (sessions.length === 0) {
    return (
      <EmptyState>No sessions yet. Your first one starts above — 25 minutes is plenty.</EmptyState>
    );
  }
  const week = weekSummary(sessions, day ? weekStartOf(day, weekStartsOn) : '0000-00-00', linked);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="This week" className="panel flex flex-col gap-3 p-4">
        <h2 className="display text-muted text-sm">This week</h2>
        <p>
          <span className="font-display text-2xl font-semibold tabular-nums">{week.minutes}</span>{' '}
          <span className="text-muted">
            min focused · {week.sessions} sessions, {week.completed} completed
          </span>
        </p>
        <ul className="grid grid-cols-3 gap-2">
          {STATS.map((s) => {
            const { icon: Icon, text, label } = STAT_META[s];
            return (
              <li key={s} className="flex flex-col">
                <span className={`flex items-center gap-1 text-xs font-medium ${text}`}>
                  <Icon aria-hidden size={14} /> {s}
                </span>
                <span className="tabular-nums" aria-label={`${label}: ${week.perStat[s]} minutes`}>
                  {week.perStat[s]} min
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <FocusTrend />
      <section aria-label="Session history" className="flex flex-col gap-3">
        <h2 className="display text-lg">History</h2>
        {byDay(sessions).map(([d, list]) => (
          <div key={d} className="flex flex-col gap-1">
            <h3 className="display text-muted text-sm">
              {d === day ? 'Today' : formatDay(d)} ·{' '}
              {list.reduce((sum, s) => sum + s.actual_min, 0)} min
            </h3>
            <ul className="panel divide-border flex flex-col divide-y">
              {list.map((s) => {
                const stat = statOf(s, linked);
                const what = s.quest_instance_id
                  ? (linked[s.quest_instance_id]?.title ?? 'Quest')
                  : stat
                    ? `${STAT_META[stat].label} focus`
                    : 'Focus';
                return (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="text-muted w-16 shrink-0 tabular-nums">
                      {time(s.started_at)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{what}</span>
                    {s.face_down && (
                      <Smartphone
                        aria-label="Phone face-down"
                        size={14}
                        className="text-muted shrink-0"
                      />
                    )}
                    <span className="shrink-0 tabular-nums">{s.actual_min} min</span>
                    <span
                      className={`w-20 shrink-0 text-right text-xs ${s.completed ? 'text-success-text' : 'text-muted'}`}
                    >
                      {s.completed ? 'Completed' : 'Ended early'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

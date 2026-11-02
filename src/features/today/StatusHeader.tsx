import { Flame, Shield } from 'lucide-react';
import { STATS } from '@/core/db/types';
import { useAppState } from '@/core/state/app';
import { useProgress } from '@/core/state/progress';
import { dayNumber } from '@/core/time';
import { ProgressBar } from '@/ui/ProgressBar';
import { STAT_META } from '@/ui/statMeta';

/** Level, XP bar, rank, streak and the three stats (SPEC 7.2). Read-only. */
export function StatusHeader({ day }: { day: string | null }) {
  const progress = useProgress((s) => s.progress);
  const profile = useAppState((s) => s.profile);
  if (!progress) return null;
  const { level, rank, streak, stats } = progress;
  const dayN =
    profile?.start_day && day && day >= profile.start_day
      ? dayNumber(profile.start_day, day)
      : null;

  return (
    <section
      aria-label="Status"
      className="border-border bg-surface shadow-card flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted text-sm">
            {profile?.name ?? 'Player'}
            {dayN !== null && <span className="tabular-nums"> · Day {dayN}</span>}
          </p>
          <p className="flex items-baseline gap-2">
            <span className="text-muted text-sm font-medium">Level</span>
            <span className="font-display text-2xl leading-none font-semibold tabular-nums">
              {level.level}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="border-border font-display rounded-md border px-2 py-0.5 text-sm font-semibold"
            aria-label={`Rank ${rank}`}
          >
            Rank {rank}
          </span>
          <span className="flex items-center gap-3 text-sm tabular-nums">
            <span
              className="flex items-center gap-1"
              aria-label={`Streak ${streak.streak} day${streak.streak === 1 ? '' : 's'}`}
            >
              <Flame aria-hidden size={16} className="text-warning-text" />
              {streak.streak}
            </span>
            {streak.shields > 0 && (
              <span
                className="text-muted flex items-center gap-1"
                aria-label={`${streak.shields} streak shield${streak.shields === 1 ? '' : 's'}`}
              >
                <Shield aria-hidden size={16} />
                {streak.shields}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <ProgressBar value={level.progress} label="XP toward next level" />
        <p className="text-muted flex justify-between text-xs tabular-nums">
          <span>
            {level.xpIntoLevel.toLocaleString()} / {level.xpForNext.toLocaleString()} XP
          </span>
          <span>{level.totalXp.toLocaleString()} total</span>
        </p>
      </div>

      <ul className="grid grid-cols-3 gap-3">
        {STATS.map((s) => {
          const { icon: Icon, text, fill, label } = STAT_META[s];
          return (
            <li key={s} className="flex flex-col gap-1">
              <span className={`flex items-center gap-1 text-xs font-medium ${text}`}>
                <Icon aria-hidden size={14} />
                {s}
                <span className="text-text ml-auto tabular-nums">{stats[s].level}</span>
              </span>
              <ProgressBar
                value={stats[s].progress}
                fill={fill}
                className="h-1.5"
                label={`${label} level ${stats[s].level}`}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

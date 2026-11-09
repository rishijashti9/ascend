import { Flame, Shield } from 'lucide-react';
import { STATS } from '@/core/db/types';
import { titleName } from '@/core/achievements/titles';
import { useAppState } from '@/core/state/app';
import { useProgress } from '@/core/state/progress';
import { dayNumber, weekdayOf } from '@/core/time';
import { ProgressBar } from '@/ui/ProgressBar';
import { STAT_META } from '@/ui/statMeta';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * The Today header (SPEC 7.2, Phase 12 ELEVATE): who and which day in big display type, level,
 * rank and streak as pills, the XP bar, and the three stats. Read-only.
 */
export function StatusHeader({ day }: { day: string | null }) {
  const progress = useProgress((s) => s.progress);
  const profile = useAppState((s) => s.profile);
  const settings = useAppState((s) => s.settings);
  if (!progress) return null;
  const title = titleName(profile?.display_title, settings);
  const { level, rank, streak, stats } = progress;
  const dayN =
    profile?.start_day && day && day >= profile.start_day
      ? dayNumber(profile.start_day, day)
      : null;

  return (
    <section aria-label="Status" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="display text-2xl">
            {dayN !== null ? <span className="tabular-nums">Day {dayN}</span> : 'Day 1 soon'}
          </p>
          <p className="text-muted truncate text-sm">
            {day ? `${WEEKDAYS[weekdayOf(day)]} · ` : ''}
            <span>{profile?.name ?? 'Player'}</span>
            {title && <span className="text-accent-text"> · {title}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="pill bg-tile-white text-on-tile-white px-3 py-1 text-sm font-bold tabular-nums">
            Lv {level.level}
          </span>
          <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
            <span aria-label={`Rank ${rank}`} className="pill bg-surface-2 px-3 py-1">
              Rank {rank}
            </span>
            <span
              className="pill bg-surface-2 flex items-center gap-1 px-3 py-1"
              aria-label={`Streak ${streak.streak} day${streak.streak === 1 ? '' : 's'}`}
            >
              <Flame aria-hidden size={14} className="text-warning-text" />
              {streak.streak}
            </span>
            {streak.shields > 0 && (
              <span
                className="pill bg-surface-2 text-muted flex items-center gap-1 px-3 py-1"
                aria-label={`${streak.shields} streak shield${streak.shields === 1 ? '' : 's'}`}
              >
                <Shield aria-hidden size={14} />
                {streak.shields}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <ProgressBar value={level.progress} label="XP toward next level" className="h-2.5" />
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
              <span className={`flex items-center gap-1 text-xs font-semibold ${text}`}>
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

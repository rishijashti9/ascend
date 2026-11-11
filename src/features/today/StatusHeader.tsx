import { Flame, Shield } from 'lucide-react';
import { titleName } from '@/core/achievements/titles';
import { useAppState } from '@/core/state/app';
import { useProgress } from '@/core/state/progress';
import { dayNumber, weekdayOf } from '@/core/time';
import { ProgressBar } from '@/ui/ProgressBar';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * The Today header (SPEC 7.2, Phase 12 ELEVATE): who and which day in big display type, level,
 * rank and streak as one row of pills, and the XP bar. Read-only. UX-3 (docs/product/
 * AUDIT-AND-PROPOSAL.md): compact, so the next action and today's quests come sooner — the three
 * stat levels live on Me → Progress, where they are explained.
 */
export function StatusHeader({ day }: { day: string | null }) {
  const progress = useProgress((s) => s.progress);
  const profile = useAppState((s) => s.profile);
  const settings = useAppState((s) => s.settings);
  if (!progress) return null;
  const title = titleName(profile?.display_title, settings);
  const { level, rank, streak } = progress;
  const dayN =
    profile?.start_day && day && day >= profile.start_day
      ? dayNumber(profile.start_day, day)
      : null;

  return (
    <section aria-label="Status" className="flex flex-col gap-3">
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

      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums">
        <span className="pill bg-tile-white text-on-tile-white px-3 py-1 font-bold">
          Lv {level.level}
        </span>
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
      </div>

      <div className="flex flex-col gap-1.5">
        <ProgressBar value={level.progress} label="XP toward next level" className="h-2" />
        <p className="text-muted flex justify-between text-xs tabular-nums">
          <span>
            {level.xpIntoLevel.toLocaleString()} / {level.xpForNext.toLocaleString()} XP
          </span>
          <span>{level.totalXp.toLocaleString()} total</span>
        </p>
      </div>
    </section>
  );
}

import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import { GAME } from '@/config/game';
import { STATS } from '@/core/db/types';
import { weakestStat, weeklyXp } from '@/core/engine/profile';
import { titleName } from '@/core/achievements/titles';
import { useAppState } from '@/core/state/app';
import { useFocus } from '@/core/state/focus';
import { useProgress } from '@/core/state/progress';
import { useToday } from '@/core/state/today';
import type { Weekday } from '@/core/time';
import { ChartCard } from '@/ui/charts/ChartCard';
import { DailyBars } from '@/ui/charts/DailyBars';
import { shortDay } from '@/ui/charts/scale';
import { ProgressBar } from '@/ui/ProgressBar';
import { STAT_META } from '@/ui/statMeta';
import { Stat } from '@/features/review/Stat';
import { AchievementList } from '@/features/achievements/AchievementList';
import { Heatmap } from './Heatmap';
import { TitlePicker } from './TitlePicker';
import { StatTriangle } from './StatTriangle';

/** Profile / Stats (SPEC 7.8): who you are in numbers. Achievements and titles (5.5–5.6) are included. */
export function ProfilePage() {
  const progress = useProgress((s) => s.progress);
  const profile = useAppState((s) => s.profile);
  const settings = useAppState((s) => s.settings);
  const weekStartsOn = useAppState((s) => (s.settings?.week_start ?? 1) as Weekday);
  const sessions = useFocus((s) => s.sessions);
  const today = useToday((s) => s.day);
  if (!progress || !today) return null;

  const { level, rank, streak, stats, perDay } = progress;
  const levels = { STR: stats.STR.level, INT: stats.INT.level, WIL: stats.WIL.level };
  const weakest = weakestStat(levels);
  const nextRank = GAME.ranks[GAME.ranks.findIndex((r) => r.rank === rank) + 1];
  const focusHours = Math.round(sessions.reduce((t, s) => t + s.actual_min, 0) / 6) / 10;
  const weeks = weeklyXp(perDay, today, weekStartsOn);
  const startDay = profile?.start_day ?? today;
  const title = titleName(profile?.display_title, settings);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <h1 className="display text-2xl">Profile</h1>

      <section aria-label="Player" className="panel flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="display text-lg">{profile?.name ?? 'Player'}</h2>
            {title && <p className="text-accent-text text-sm">{title}</p>}
          </div>
          <p className="text-right">
            <span className="display text-2xl tabular-nums">Level {level.level}</span>
            <span className="text-muted block text-sm">Rank {rank}</span>
          </p>
        </div>
        <ProgressBar
          value={level.progress}
          label={`${level.xpIntoLevel} of ${level.xpForNext} XP to level ${level.level + 1}`}
        />
        <p className="text-muted text-xs">
          {level.xpIntoLevel.toLocaleString()} / {level.xpForNext.toLocaleString()} XP to level{' '}
          {level.level + 1}
          {nextRank &&
            ` · Rank ${nextRank.rank} needs level ${nextRank.minLevel} and ${nextRank.minActiveDays} active days`}
        </p>
        <TitlePicker current={profile?.display_title ?? null} />
        {isEnabled('adaptive') && (
          <Link
            to="/me/knows"
            className="text-accent-text inline-flex min-h-11 items-center text-sm"
          >
            What the System knows about you →
          </Link>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total XP" value={level.totalXp.toLocaleString()} />
          <Stat label="Days active" value={String(streak.daysActive)} />
          <Stat label="Longest streak" value={`${streak.longest} days`} />
          <Stat label="Focus" value={`${focusHours} h`} />
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <StatTriangle levels={levels} />
          {weakest && (
            <p className="text-muted text-sm">
              {STAT_META[weakest].label} is behind the others — a {weakest} quest or two this week
              would even things out.
            </p>
          )}
        </div>
        <ChartCard
          title="XP per week"
          subtitle="Last 12 weeks; each bar starts on the date shown."
          rows={weeks.map((w) => ({
            label: `Week of ${shortDay(w.day)}`,
            value: `${w.value.toLocaleString()} XP`,
          }))}
        >
          {weeks.some((w) => w.value > 0) ? (
            <DailyBars bars={weeks} unit="XP" label="XP per week, last 12 weeks" />
          ) : (
            <p className="text-muted py-6 text-center text-sm">
              No XP yet — finish a quest and it shows up here.
            </p>
          )}
        </ChartCard>
      </div>

      <AchievementList />

      <Heatmap perDay={perDay} today={today} startDay={startDay} weekStartsOn={weekStartsOn} />

      <section aria-label="Stat levels" className="grid grid-cols-3 gap-3">
        {STATS.map((s) => {
          const Icon = STAT_META[s].icon;
          return (
            <div key={s} className="panel flex flex-col gap-1 p-3">
              <span className="flex items-center gap-1 text-sm font-medium">
                <Icon aria-hidden size={16} className={STAT_META[s].text} />
                {STAT_META[s].label}
              </span>
              <span className="display text-lg tabular-nums">Level {stats[s].level}</span>
              <span className="text-muted text-xs tabular-nums">
                {stats[s].totalXp.toLocaleString()} XP
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

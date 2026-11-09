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
import { STAT_META } from '@/ui/statMeta';
import { Stat } from '@/features/review/Stat';
import { AchievementList } from '@/features/achievements/AchievementList';
import { Heatmap } from './Heatmap';
import { TitlePicker } from './TitlePicker';
import { StatTriangle } from './StatTriangle';

/** Profile / Stats (SPEC 7.8): who you are in numbers. Achievements and titles (5.5–5.6) are included. */
/** Stat tiles in ELEVATE colours (black text on each — never the stat text colour). */
const STAT_TILE = { STR: 'tile-white', INT: 'tile-yellow', WIL: 'tile-violet' } as const;

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:max-w-none">
      {/* Me already shows the name and the Stats & achievements tab names this screen. */}
      <h1 className="sr-only">Stats and achievements</h1>

      {/* Desktop: the player block and the stat tiles side by side. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <section aria-label="Player" className="panel flex flex-col gap-3 p-3">
          <div className="tile tile-lime flex flex-col gap-2 p-4">
            <div className="flex items-end justify-between gap-3">
              <span className="display text-3xl tabular-nums">Level {level.level}</span>
              <span className="pill bg-on-tile-lime text-tile-lime px-3 py-1 text-sm font-bold">
                Rank {rank}
              </span>
            </div>
            <span
              role="progressbar"
              aria-label={`${level.xpIntoLevel} of ${level.xpForNext} XP to level ${level.level + 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level.progress * 100)}
              className="bg-on-tile-lime/15 block h-2.5 overflow-hidden rounded-full"
            >
              <span
                className="bg-on-tile-lime block h-full rounded-full"
                style={{ width: `${Math.round(level.progress * 100)}%` }}
              />
            </span>
            <p className="text-on-tile-muted text-xs">
              {level.xpIntoLevel.toLocaleString()} / {level.xpForNext.toLocaleString()} XP to level{' '}
              {level.level + 1}
              {nextRank &&
                ` · Rank ${nextRank.rank} needs level ${nextRank.minLevel} and ${nextRank.minActiveDays} active days`}
            </p>
          </div>
          {title && <p className="text-accent-text px-1 text-sm">{title}</p>}
          <TitlePicker current={profile?.display_title ?? null} />
          <div className="grid grid-cols-2 gap-3 px-1 sm:grid-cols-4">
            <Stat label="Total XP" value={level.totalXp.toLocaleString()} />
            <Stat label="Days active" value={String(streak.daysActive)} />
            <Stat label="Longest streak" value={`${streak.longest} days`} />
            <Stat label="Focus" value={`${focusHours} h`} />
          </div>
        </section>

        <section aria-label="Stat levels" className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          {STATS.map((s) => {
            const Icon = STAT_META[s].icon;
            return (
              <div key={s} className={`tile ${STAT_TILE[s]} flex flex-col gap-1 p-3`}>
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <Icon aria-hidden size={16} />
                  {STAT_META[s].label}
                </span>
                <span className="display text-xl tabular-nums">Level {stats[s].level}</span>
                <span className="text-on-tile-muted text-xs tabular-nums">
                  {stats[s].totalXp.toLocaleString()} XP
                </span>
              </div>
            );
          })}
        </section>
      </div>

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
    </div>
  );
}

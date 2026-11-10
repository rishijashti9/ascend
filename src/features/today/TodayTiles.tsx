import { isEnabled } from '@/config/features';
import { useAdaptive } from '@/core/state/adaptive';
import { useAppState } from '@/core/state/app';
import { useBody } from '@/core/state/body';
import { useProgress } from '@/core/state/progress';
import { useScreen } from '@/core/state/screen';
import { useSkills } from '@/core/state/skills';
import { useToday } from '@/core/state/today';
import { careerGap } from '@/core/compass/gap';
import { careerById } from '@/core/compass/pack';
import type { NextAction } from '@/core/adaptive/today';
import { isDone } from '@/core/engine/progress';
import { formatMinutes } from '@/core/screentime/observe';
import { weekStartOf, type Weekday } from '@/core/time';
import { ProgressBar } from '@/ui/ProgressBar';
import { Tile } from '@/ui/Surface';

/**
 * Today's live tiles (Phase 12 dashboard): today's quests, Body, Skill, Roadmap and Screen time —
 * each one tap from its screen, each showing real numbers (or the next step when there are none).
 */
export function TodayTiles({
  onQuests,
  next,
}: {
  onQuests: () => void;
  /** The one next action (the same one Today shows as "Now"), or null. */
  next: NextAction | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <QuestsTile onQuests={onQuests} next={next} />
      {isEnabled('body') && <BodyTile />}
      {isEnabled('skills') && <SkillTile />}
      {isEnabled('compass') && <RoadmapTile />}
      {isEnabled('screenTime') && <ScreenTile />}
    </div>
  );
}

/**
 * Today's quests at a glance. Its "Next" is the SAME next action as Today's "Now" card (UX-2,
 * docs/product/AUDIT-AND-PROPOSAL.md P1): one answer to "what should I do next?", and only
 * quests that can still be done (never a wake-up whose window has closed, or tonight's sleep).
 */
function QuestsTile({ onQuests, next }: { onQuests: () => void; next: NextAction | null }) {
  const daily = useToday((s) => s.daily);
  const done = daily.filter((q) => isDone(q.instance.status)).length;
  const open = daily.filter((q) => !isDone(q.instance.status) && q.instance.status !== 'missed');
  const core = daily.filter((q) => q.instance.core_snapshot);
  const coreOpen = open.filter((q) => q.instance.core_snapshot).length;
  const coreAllDone = core.length > 0 && core.every((q) => isDone(q.instance.status));
  const nextQuest = next ? daily.find((q) => q.instance.id === next.instanceId) : undefined;
  const left =
    nextQuest &&
    nextQuest.instance.measure_snapshot === 'minutes' &&
    nextQuest.instance.target_snapshot
      ? `${Math.max(0, nextQuest.instance.target_snapshot - nextQuest.progress)} min left`
      : null;
  // Only say something about core quests when there are some today (none on Day 1).
  const coreNote = coreOpen > 0 ? `${coreOpen} core open` : coreAllDone ? 'core done' : null;
  return (
    <button
      type="button"
      onClick={onQuests}
      className="tile tile-lime col-span-2 flex flex-col gap-2 p-4 text-left transition-transform duration-(--dur) active:scale-[0.98]"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="display text-lg">Today’s quests</span>
        <span className="display text-3xl tabular-nums">
          {done}/{daily.length}
        </span>
      </span>
      {next ? (
        <span className="text-sm">
          <span className="font-semibold">Next: {next.title}</span>
          {(left || coreNote) && (
            <span className="text-on-tile-muted block">
              {[left, coreNote].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
      ) : (
        <span className="text-sm font-semibold">
          {!daily.length
            ? 'A rest day.'
            : open.length === 0
              ? 'Everything is done for today.'
              : 'Nothing else to do right now.'}
        </span>
      )}
      <span className="bg-on-tile-lime/15 block h-2 overflow-hidden rounded-full">
        <span
          className="bg-on-tile-lime block h-full rounded-full"
          style={{ width: `${daily.length ? Math.round((done / daily.length) * 100) : 0}%` }}
        />
      </span>
    </button>
  );
}

function BodyTile() {
  const day = useToday((s) => s.day);
  const logs = useBody((s) => s.logs);
  const str = useProgress((s) => s.progress?.stats.STR.level);
  const log = logs.find((l) => l.day === day);
  const parts = [
    log?.sleep_hours != null ? `${log.sleep_hours}h sleep` : null,
    log?.steps != null ? `${log.steps.toLocaleString()} steps` : null,
  ].filter(Boolean);
  return (
    <Tile tone="white" to="/me/body">
      <span className="text-on-tile-muted text-xs font-bold tracking-wide uppercase">
        Body · STR {str ?? 0}
      </span>
      <span className="display mt-4 text-lg">Body</span>
      <span className="text-on-tile-muted text-sm">
        {parts.length ? parts.join(' · ') : 'Log sleep and steps'}
      </span>
    </Tile>
  );
}

function SkillTile() {
  const day = useToday((s) => s.day);
  const weekStartsOn = useAppState((s) => (s.settings?.week_start ?? 1) as Weekday);
  const skills = useSkills((s) => s.skills);
  const progress = useSkills((s) => s.progress);
  const contributions = useSkills((s) => s.contributions);
  const from = day ? weekStartOf(day, weekStartsOn) : '';
  const perSkill = new Map<string, number>();
  for (const c of contributions) {
    if (!day || c.day < from || c.day > day) continue;
    perSkill.set(c.skillId, (perSkill.get(c.skillId) ?? 0) + c.minutes);
  }
  const [topId, topMin] = [...perSkill.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const top = topId ? skills.find((s) => s.id === topId) : undefined;
  const weekMin = [...perSkill.values()].reduce((a, b) => a + b, 0);
  return (
    <Tile tone="yellow" to="/growth/skills">
      <span className="text-on-tile-muted text-xs font-bold tracking-wide uppercase">
        Skill{top ? ` · Lv ${progress.get(top.id)?.level ?? 0}` : ''}
      </span>
      <span className="display mt-4 truncate text-lg">{top?.name ?? 'Skills'}</span>
      <span className="text-on-tile-muted text-sm">
        {weekMin > 0
          ? `${formatMinutes(topMin ?? 0)} this week · ${formatMinutes(weekMin)} in all`
          : 'Tag a focus session with a skill'}
      </span>
    </Tile>
  );
}

function RoadmapTile() {
  const day = useToday((s) => s.day);
  const targetId = useAppState((s) => s.profile?.compass?.target_career ?? null);
  const tree = useSkills((s) => s.skills);
  const progress = useSkills((s) => s.progress);
  const capacity = useAdaptive((s) => s.capacity);
  const career = targetId ? careerById(targetId) : undefined;
  if (!career || !day) {
    return (
      <Tile tone="violet" to="/growth/roadmap">
        <span className="text-xs font-bold tracking-wide uppercase">Roadmap</span>
        <span className="display mt-4 text-lg">Find your path</span>
        <span className="text-sm">Careers that fit you, step by step</span>
      </Tile>
    );
  }
  const gap = careerGap(career, tree, (id) => progress.get(id)?.level ?? 0, capacity, day);
  const pct = gap.items.length ? Math.round((gap.done / gap.items.length) * 100) : 100;
  const next = gap.items.find((i) => i.hoursLeft > 0);
  return (
    <Tile tone="violet" to="/growth/roadmap">
      <span className="text-xs font-bold tracking-wide uppercase">Roadmap · {career.title}</span>
      <span className="display mt-4 text-3xl tabular-nums">{pct}%</span>
      <span className="text-sm font-semibold">
        {next ? `Next: ${next.skill.name}` : 'Every needed skill reached'}
      </span>
      <ProgressBar value={pct / 100} fill="bg-on-tile-violet" label="Readiness" className="h-1.5" />
    </Tile>
  );
}

function ScreenTile() {
  const rules = useScreen((s) => s.rules);
  const todaySec = useScreen((s) => s.todaySec);
  if (!rules?.enabled) return null;
  const limit = rules.limit_min;
  const min = Math.round(todaySec / 60);
  return (
    <Tile tone="grey" to="/me/screen-time">
      <span className="text-xs font-bold tracking-wide uppercase opacity-80">Screen time</span>
      <span className="display mt-4 text-lg tabular-nums">
        {limit === null ? 'Observing' : `${formatMinutes(min)}`}
      </span>
      <span className="text-sm opacity-80">
        {limit === null ? 'No reminders this week' : `of ${formatMinutes(limit)} today`}
      </span>
    </Tile>
  );
}

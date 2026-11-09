import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { GAME } from '@/config/game';
import { trackBalance } from '@/core/engine/skills';
import { useAppState } from '@/core/state/app';
import { useSkills } from '@/core/state/skills';
import { useToday } from '@/core/state/today';
import { addDays, weekStartOf, type Weekday } from '@/core/time';
import { shortDay } from '@/ui/charts/scale';
import { balanceNote, formatMinutes } from './format';

/**
 * The 70/30 study balance (SPEC 6.5): AI & Robotics vs Games minutes in a week, from the
 * minutes credited to skills. Numbers are always written out, never colour alone.
 */
export function BalanceCard() {
  const today = useToday((s) => s.day);
  const weekStartsOn = useAppState((s) => (s.settings?.week_start ?? 1) as Weekday);
  const skills = useSkills((s) => s.skills);
  const contributions = useSkills((s) => s.contributions);
  const [back, setBack] = useState(0);
  if (!today) return null;

  const thisWeek = weekStartOf(today, weekStartsOn);
  const from = addDays(thisWeek, -7 * back);
  const to = addDays(from, 6);
  const { minutes, aiShare } = trackBalance(contributions, skills, from, to);
  const target = Math.round(GAME.skills.balanceTarget * 100);
  const ai = aiShare === null ? null : Math.round(aiShare * 100);
  const earliest = contributions.reduce((d, c) => (c.day < d ? c.day : d), today);
  const canGoBack = from > earliest;

  return (
    <section aria-label="Study balance" className="panel flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="display text-muted text-sm">
          {back === 0 ? 'Study balance this week' : `Week of ${shortDay(from)}`}
        </h2>
        <div className="flex">
          <button
            type="button"
            aria-label="Previous week"
            disabled={!canGoBack}
            onClick={() => setBack((b) => b + 1)}
            className="text-muted hover:text-text hover:bg-surface-2 flex size-11 items-center justify-center rounded-full disabled:opacity-30"
          >
            <ChevronLeft aria-hidden size={18} />
          </button>
          <button
            type="button"
            aria-label="Next week"
            disabled={back === 0}
            onClick={() => setBack((b) => Math.max(0, b - 1))}
            className="text-muted hover:text-text hover:bg-surface-2 flex size-11 items-center justify-center rounded-full disabled:opacity-30"
          >
            <ChevronRight aria-hidden size={18} />
          </button>
        </div>
      </div>

      {ai === null ? (
        <p className="text-muted text-sm">
          No AI & Robotics or Games study time linked to skills{' '}
          {back === 0 ? 'this week yet' : 'that week'}. Link your study quests to skills, or tag a
          focus session, and the split shows up here (aim {target} / {100 - target}).
        </p>
      ) : (
        <>
          <p className="display text-lg tabular-nums">
            {ai} / {100 - ai}
            <span className="text-muted ml-2 text-sm font-normal">
              aim {target} / {100 - target}
            </span>
          </p>
          <div
            className="bg-surface-2 relative flex h-4 w-full overflow-hidden rounded-full"
            role="img"
            aria-label={`AI & Robotics ${ai}%, Games ${100 - ai}%, aim ${target}%`}
          >
            <div className="bg-accent h-full" style={{ width: `${ai}%` }} />
            <div className="bg-int h-full flex-1" />
            <div
              aria-hidden
              className="bg-text absolute top-0 h-full w-0.5"
              style={{ left: `${target}%` }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted flex items-center gap-1 text-xs">
                <span aria-hidden className="bg-accent size-2 rounded-full" /> AI & Robotics
              </dt>
              <dd className="tabular-nums">{formatMinutes(minutes.ai_robotics)}</dd>
            </div>
            <div>
              <dt className="text-muted flex items-center gap-1 text-xs">
                <span aria-hidden className="bg-int size-2 rounded-full" /> Games
              </dt>
              <dd className="tabular-nums">{formatMinutes(minutes.games)}</dd>
            </div>
            {minutes.other > 0 && (
              <div>
                <dt className="text-muted text-xs">Other skills</dt>
                <dd className="tabular-nums">{formatMinutes(minutes.other)}</dd>
              </div>
            )}
          </dl>
          <p className="text-muted text-xs">{balanceNote(ai, target)}</p>
        </>
      )}
    </section>
  );
}
